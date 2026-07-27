import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PortExposure,
  PortListener,
  PortSnapshot,
  PortType,
  ProcessOwnerType,
} from "../../shared/ports";
import {
  loadLocale,
  localizeWarning,
  translate,
  type Locale,
  type MessageKey,
} from "./i18n";

type SortKey = "port-asc" | "port-desc" | "name" | "owner" | "scope";

const isPanelMode =
  new URLSearchParams(window.location.search).get("mode") === "panel";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

function formatScanTime(value: string | undefined, locale: Locale, t: Translator): string {
  if (!value) return t("notScanned");
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function exposureLabel(
  exposure: PortListener["exposure"],
  t: Translator,
): string {
  switch (exposure) {
    case "local":
      return t("localOnly");
    case "network":
      return t("networkFacing");
    default:
      return t("unknownScope");
  }
}

function portTypeLabel(portType: PortType, t: Translator): string {
  switch (portType) {
    case "system":
      return t("system");
    case "service":
      return t("service");
    case "dynamic":
      return t("dynamic");
  }
}

function ownerTypeLabel(
  ownerType: ProcessOwnerType | undefined,
  t: Translator,
): string {
  switch (ownerType) {
    case "system":
      return t("system");
    case "service":
      return t("service");
    case "application":
      return t("application");
    case "development":
      return t("development");
    default:
      return t("unknown");
  }
}

export function App(): React.JSX.Element {
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const [snapshot, setSnapshot] = useState<PortSnapshot>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PortListener>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [copiedCommandId, setCopiedCommandId] = useState<string>();
  const [portTypeFilter, setPortTypeFilter] = useState<PortType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<ProcessOwnerType | "all">(
    "all",
  );
  const [scopeFilter, setScopeFilter] = useState<PortExposure | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("port-asc");
  const scanningRef = useRef(false);
  const t = useCallback<Translator>(
    (key, values) => translate(locale, key, values),
    [locale],
  );

  const refresh = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setLoading(true);
    setError(undefined);

    try {
      const nextSnapshot = await window.hostLens.listPorts();
      setSnapshot(nextSnapshot);
      setSelected((current) =>
        current
          ? nextSnapshot.listeners.find((listener) => listener.id === current.id)
          : isPanelMode
            ? undefined
            : nextSnapshot.listeners[0],
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("unableToScan"));
    } finally {
      scanningRef.current = false;
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("hostlens.locale", locale);

    const syncLocale = (event: StorageEvent): void => {
      if (
        event.key === "hostlens.locale" &&
        (event.newValue === "en" ||
          event.newValue === "ja" ||
          event.newValue === "zh-CN")
      ) {
        setLocale(event.newValue);
      }
    };

    window.addEventListener("storage", syncLocale);
    return () => window.removeEventListener("storage", syncLocale);
  }, [locale]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setInterval> | undefined;

    const updateRefreshSchedule = (): void => {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = undefined;

      if (document.visibilityState === "visible") {
        void refresh();
        refreshTimer = setInterval(() => void refresh(), 5_000);
      }
    };

    document.addEventListener("visibilitychange", updateRefreshSchedule);
    updateRefreshSchedule();

    return () => {
      document.removeEventListener("visibilitychange", updateRefreshSchedule);
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [refresh]);

  const filteredListeners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (snapshot?.listeners ?? [])
      .filter((listener) => {
        if (portTypeFilter !== "all" && listener.portType !== portTypeFilter) {
          return false;
        }
        if (ownerFilter !== "all" && listener.ownerType !== ownerFilter) {
          return false;
        }
        if (scopeFilter !== "all" && listener.exposure !== scopeFilter) {
          return false;
        }

        if (!normalizedQuery) return true;
        return [
          listener.port.toString(),
          listener.displayName,
          listener.processName,
          listener.projectName,
          listener.address,
          listener.command,
          listener.executable,
          listener.workingDirectory,
          ...listener.parentChain.flatMap((ancestor) => [
            ancestor.processName,
            ancestor.executable,
          ]),
          listener.source,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        switch (sortKey) {
          case "port-desc":
            return right.port - left.port;
          case "name":
            return (left.displayName ?? left.processName).localeCompare(
              right.displayName ?? right.processName,
            );
          case "owner":
            return ownerTypeLabel(left.ownerType, t).localeCompare(
              ownerTypeLabel(right.ownerType, t),
              locale,
            );
          case "scope":
            return exposureLabel(left.exposure, t).localeCompare(
              exposureLabel(right.exposure, t),
              locale,
            );
          case "port-asc":
          default:
            return left.port - right.port;
        }
      });
  }, [
    ownerFilter,
    locale,
    portTypeFilter,
    query,
    scopeFilter,
    snapshot,
    sortKey,
    t,
  ]);

  useEffect(() => {
    if (isPanelMode) return;

    if (filteredListeners.length === 0) {
      setSelected(undefined);
      return;
    }

    if (!selected || !filteredListeners.some(({ id }) => id === selected.id)) {
      setSelected(filteredListeners[0]);
    }
  }, [filteredListeners, selected]);

  const networkCount =
    snapshot?.listeners.filter((listener) => listener.exposure === "network").length ?? 0;
  const localCount =
    snapshot?.listeners.filter((listener) => listener.exposure === "local").length ?? 0;

  const copyCommand = useCallback(async (listener: PortListener) => {
    if (!listener.command) return;

    await window.hostLens.copyText(listener.command);
    setCopiedCommandId(listener.id);
    window.setTimeout(() => {
      setCopiedCommandId((current) =>
        current === listener.id ? undefined : current,
      );
    }, 1_500);
  }, []);

  return (
    <main className={`panel ${isPanelMode ? "quick-view" : "full-app"}`}>
      <header className="header">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="brand-copy">
          <p className="eyebrow">HOSTLENS</p>
          <h1>Ports</h1>
        </div>
        <label className="language-picker">
          <span className="visually-hidden">{t("language")}</span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            aria-label={t("language")}
            title={t("language")}
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </label>
        <button
          className="icon-button"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label={t("refresh")}
          title={t("refresh")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
          </svg>
        </button>
      </header>

      <section className="summary" aria-label={t("portSummary")}>
        <div>
          <strong>{snapshot?.listeners.length ?? "—"}</strong>
          <span>{t("listening")}</span>
        </div>
        <div>
          <strong>{localCount}</strong>
          <span>{t("localOnly")}</span>
        </div>
        <div className={networkCount > 0 ? "attention" : undefined}>
          <strong>{networkCount}</strong>
          <span>{t("networkFacing")}</span>
        </div>
      </section>

      <label className="search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPorts")}
        />
      </label>

      {!isPanelMode ? (
        <section className="filter-bar" aria-label={t("filtersAndSorting")}>
          <label>
            <span>{t("portType")}</span>
            <select
              value={portTypeFilter}
              onChange={(event) =>
                setPortTypeFilter(event.target.value as PortType | "all")
              }
            >
              <option value="all">{t("allTypes")}</option>
              <option value="system">{t("systemRange")}</option>
              <option value="service">{t("serviceRange")}</option>
              <option value="dynamic">{t("dynamicRange")}</option>
            </select>
          </label>
          <label>
            <span>{t("owner")}</span>
            <select
              value={ownerFilter}
              onChange={(event) =>
                setOwnerFilter(
                  event.target.value as ProcessOwnerType | "all",
                )
              }
            >
              <option value="all">{t("allOwners")}</option>
              <option value="system">{t("system")}</option>
              <option value="service">{t("service")}</option>
              <option value="application">{t("application")}</option>
              <option value="development">{t("development")}</option>
              <option value="unknown">{t("unknown")}</option>
            </select>
          </label>
          <label>
            <span>{t("scope")}</span>
            <select
              value={scopeFilter}
              onChange={(event) =>
                setScopeFilter(event.target.value as PortExposure | "all")
              }
            >
              <option value="all">{t("allScopes")}</option>
              <option value="local">{t("localOnly")}</option>
              <option value="network">{t("networkFacing")}</option>
              <option value="unknown">{t("unknown")}</option>
            </select>
          </label>
          <label>
            <span>{t("sort")}</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              <option value="port-asc">{t("portLowHigh")}</option>
              <option value="port-desc">{t("portHighLow")}</option>
              <option value="name">{t("processName")}</option>
              <option value="owner">{t("ownerType")}</option>
              <option value="scope">{t("scope")}</option>
            </select>
          </label>
          <output>
            {t("resultCount", { count: filteredListeners.length })}
          </output>
        </section>
      ) : null}

      <div className="workspace">
        <section className="content">
          {error ? (
            <div className="empty-state error-state">
              <strong>{t("scanFailed")}</strong>
              <p>{error}</p>
            </div>
          ) : filteredListeners.length === 0 && !loading ? (
            <div className="empty-state">
              <strong>
                {query.trim() ? t("noMatchingPorts") : t("noTcpListeners")}
              </strong>
              <p>
                {query.trim()
                  ? t("trySearchOrFilters")
                  : t("checkAgain")}
              </p>
            </div>
          ) : (
            <div className="port-list" aria-busy={loading}>
              {filteredListeners.map((listener) => (
                <button
                  className={`port-row ${selected?.id === listener.id ? "selected" : ""}`}
                  key={listener.id}
                  type="button"
                  onClick={() => setSelected(listener)}
                >
                  <div className={`port-number ${listener.exposure}`}>
                    <strong>{listener.port}</strong>
                    <span>{portTypeLabel(listener.portType, t)}</span>
                  </div>
                  <div className="port-main">
                    <div className="port-title">
                      <strong>{listener.displayName ?? listener.processName}</strong>
                      <span>{listener.protocol.toUpperCase()}</span>
                      <span className={`owner-badge ${listener.ownerType ?? "unknown"}`}>
                        {ownerTypeLabel(listener.ownerType, t)}
                      </span>
                    </div>
                    {listener.command ? (
                      <p className="port-command" title={listener.command}>
                        {listener.command}
                      </p>
                    ) : null}
                    <p className="port-meta">
                      {listener.processName} · {listener.address} ·{" "}
                      {exposureLabel(listener.exposure, t)}
                    </p>
                  </div>
                  <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </section>

        {selected ? (
          <section className="detail-card" aria-label={t("selectedPortDetails")}>
            <div className="detail-heading">
              <div>
                <span>{selected.protocol.toUpperCase()} {selected.port}</span>
                <strong>{selected.displayName ?? selected.processName}</strong>
                {selected.displayName &&
                selected.displayName !== selected.processName ? (
                  <small>{t("process")}: {selected.processName}</small>
                ) : null}
              </div>
              {isPanelMode ? (
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setSelected(undefined)}
                  aria-label={t("closeDetails")}
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="command-block">
              <div className="command-label-row">
                <span>{t("command")}</span>
                <button
                  type="button"
                  className="copy-command-button"
                  disabled={!selected.command}
                  onClick={() => void copyCommand(selected)}
                >
                  {copiedCommandId === selected.id ? t("copied") : t("copy")}
                </button>
              </div>
              <code className="full-command" tabIndex={0}>
                {selected.command ?? t("commandUnavailable")}
              </code>
            </div>
            <dl className="metadata-grid">
              <div>
                <dt>PID</dt>
                <dd>{selected.pid ?? t("unavailable")}</dd>
              </div>
              <div>
                <dt>{t("parentPid")}</dt>
                <dd>{selected.parentPid ?? t("unavailable")}</dd>
              </div>
              <div>
                <dt>{t("user")}</dt>
                <dd>{selected.user ?? t("unavailable")}</dd>
              </div>
              <div>
                <dt>{t("portType")}</dt>
                <dd>{portTypeLabel(selected.portType, t)}</dd>
              </div>
              <div>
                <dt>{t("owner")}</dt>
                <dd>{ownerTypeLabel(selected.ownerType, t)}</dd>
              </div>
              <div>
                <dt>{t("scope")}</dt>
                <dd>{exposureLabel(selected.exposure, t)}</dd>
              </div>
              <div>
                <dt>{t("observation")}</dt>
                <dd>
                  {selected.observationStatus === "complete"
                    ? t("completeObservation")
                    : t("partialObservation", {
                        count: selected.unavailableFields.length,
                      })}
                </dd>
              </div>
            </dl>
            <div className="detail-paths">
              <div>
                <span>{t("executable")}</span>
                <code>{selected.executable ?? t("unavailable")}</code>
              </div>
              <div>
                <span>{t("workingDirectory")}</span>
                <code>{selected.workingDirectory ?? t("unavailable")}</code>
              </div>
            </div>
            <section className="observation-section">
              <h2>{t("parentChain")}</h2>
              {selected.parentChain.length > 0 ? (
                <ol className="parent-chain">
                  {selected.parentChain.map((ancestor) => (
                    <li key={ancestor.pid} title={ancestor.executable}>
                      <strong>{ancestor.processName}</strong>
                      <span>PID {ancestor.pid}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{t("noParentChain")}</p>
              )}
            </section>
            <section className="observation-section">
              <h2>{t("evidence")}</h2>
              <ul className="evidence-list">
                {selected.evidence.map((item) => (
                  <li key={`${item.source}-${item.fields.join("-")}`}>
                    <strong>{item.source}</strong>
                    <span title={item.fields.join(", ")}>
                      {t("evidenceFields", { count: item.fields.length })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        ) : !isPanelMode ? (
          <section className="detail-card detail-placeholder">
            {t("selectPort")}
          </section>
        ) : null}
      </div>

      {snapshot?.warnings[0] ? (
        <div className="warning-strip" title={snapshot.warnings.join("\n")}>
          <span>!</span>
          {localizeWarning(locale, snapshot.warnings[0])}
        </div>
      ) : null}

      {isPanelMode ? (
        <nav className="panel-actions" aria-label={t("hostLensActions")}>
          <button
            className="primary-action"
            type="button"
            onClick={() => void window.hostLens.openMainWindow()}
          >
            {t("openApp")}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {t("refresh")}
          </button>
          <button
            type="button"
            onClick={() => void window.hostLens.quitApp()}
          >
            {t("quit")}
          </button>
        </nav>
      ) : null}

      <footer>
        <span className={loading ? "status-dot scanning" : "status-dot"} />
        {loading
          ? t("scanning")
          : t("updated", {
              time: formatScanTime(snapshot?.scannedAt, locale, t),
            })}
        <span className="sample-badge">
          {snapshot?.warnings.some((warning) => warning.includes("sample data"))
            ? t("sampleData")
            : t("live")}
        </span>
      </footer>
    </main>
  );
}
