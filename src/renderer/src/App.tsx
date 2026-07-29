import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createListenerSummary,
  type SummaryLabels,
} from "../../shared/listener-summary";
import type {
  HostLensState,
  LaunchSourceKind,
  ListenerChange,
  ObservationConfidence,
  PortExposure,
  PortListener,
  PortSnapshot,
  PortType,
  ProcessOwnerType,
} from "../../shared/ports";
import { ServicesView } from "./ServicesView";
import { HostOverviewView } from "./HostOverviewView";
import {
  loadLocale,
  localizeWarning,
  translate,
  type Locale,
  type MessageKey,
} from "./i18n";

type SortKey = "port-asc" | "port-desc" | "name" | "owner" | "scope";
type InspectorView = "overview" | "ports" | "services";
type CopyFeedback = "command" | "full-summary" | "sanitized-summary" | "export";

const isPanelMode =
  new URLSearchParams(window.location.search).get("mode") === "panel";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

function formatScanTime(
  value: string | undefined,
  locale: Locale,
  t: Translator,
): string {
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
  if (exposure === "local") return t("localOnly");
  if (exposure === "network") return t("networkFacing");
  return t("unknownScope");
}

function portTypeLabel(portType: PortType, t: Translator): string {
  if (portType === "system") return t("system");
  if (portType === "service") return t("service");
  return t("dynamic");
}

function ownerTypeLabel(ownerType: ProcessOwnerType, t: Translator): string {
  if (ownerType === "system") return t("system");
  if (ownerType === "service") return t("service");
  if (ownerType === "application") return t("application");
  if (ownerType === "development") return t("development");
  return t("unknown");
}

function confidenceLabel(
  confidence: ObservationConfidence,
  t: Translator,
): string {
  if (confidence === "high") return t("highConfidence");
  if (confidence === "medium") return t("mediumConfidence");
  return t("lowConfidence");
}

function sourceKindLabel(kind: LaunchSourceKind, t: Translator): string {
  if (kind === "package-script") return t("sourcePackageScript");
  if (kind === "launchd") return t("sourceLaunchd");
  if (kind === "homebrew") return t("sourceHomebrew");
  if (kind === "docker") return t("sourceDocker");
  if (kind === "native-app") return t("sourceNativeApp");
  if (kind === "manual") return t("sourceManual");
  return t("sourceUnknown");
}

function changeLabel(change: ListenerChange, t: Translator): string {
  if (change.kind === "new") return t("newListener");
  if (change.kind === "changed") return t("changedListener");
  return t("closedListener");
}

function changeListener(change: ListenerChange): PortListener | undefined {
  return change.after ?? change.before;
}

function bindingExplanation(listener: PortListener, t: Translator): string {
  if (listener.exposure === "local") {
    return t("localBindingExplanation", {
      name: listener.identity.displayName,
    });
  }
  if (listener.exposure === "network") {
    return t("networkBindingExplanation", {
      name: listener.identity.displayName,
    });
  }
  return t("unknownBindingExplanation");
}

function summaryLabels(t: Translator): SummaryLabels {
  return {
    title: `HostLens Ports · ${t("currentStateObservation")}`,
    process: t("process"),
    socket: t("listening"),
    exposure: t("scope"),
    source: t("launchSource"),
    automaticStart: t("automaticStart"),
    confidence: t("identityConfidence"),
    collectedAt: t("collectedAt"),
    project: t("project"),
    workingDirectory: t("workingDirectory"),
    executable: t("executable"),
    command: t("command"),
    evidence: t("evidence"),
    unknown: t("unknown"),
    yes: t("yes"),
    no: t("no"),
    disclaimer: t("pointInTimeDisclaimer"),
  };
}

function listenerForChange(
  listener: PortListener,
  changes: readonly ListenerChange[],
): ListenerChange | undefined {
  return changes.find((change) => change.after?.id === listener.id);
}

export function App(): React.JSX.Element {
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const [hostState, setHostState] = useState<HostLensState>();
  const [activeView, setActiveView] = useState<InspectorView>("overview");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PortListener>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>();
  const [portTypeFilter, setPortTypeFilter] = useState<PortType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<ProcessOwnerType | "all">(
    "all",
  );
  const [scopeFilter, setScopeFilter] = useState<PortExposure | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("port-asc");
  const scanningRef = useRef(false);
  const feedbackTimer = useRef<number | undefined>(undefined);
  const t = useCallback<Translator>(
    (key, values) => translate(locale, key, values),
    [locale],
  );

  const snapshot = hostState?.snapshot;
  const serviceSnapshot = hostState?.services;
  const networkSnapshot = hostState?.network;
  const changes = hostState?.changes.events ?? [];

  const showFeedback = useCallback((value: CopyFeedback) => {
    setCopyFeedback(value);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(
      () => setCopyFeedback(undefined),
      1_800,
    );
  }, []);

  const refresh = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setLoading(true);
    setError(undefined);

    try {
      const nextState = await window.hostLens.listPorts();
      setHostState(nextState);
      setSelected((current) =>
        current
          ? nextState.snapshot.listeners.find(
              (listener) => listener.id === current.id,
            )
          : isPanelMode
            ? undefined
            : nextState.snapshot.listeners[0],
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
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    };
  }, [refresh]);

  const filteredListeners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (snapshot?.listeners ?? [])
      .filter((listener) => {
        if (portTypeFilter !== "all" && listener.portType !== portTypeFilter) {
          return false;
        }
        if (
          ownerFilter !== "all" &&
          listener.identity.kind !== ownerFilter
        ) {
          return false;
        }
        if (scopeFilter !== "all" && listener.exposure !== scopeFilter) {
          return false;
        }
        if (!normalizedQuery) return true;

        return [
          listener.port.toString(),
          listener.identity.displayName,
          listener.processName,
          listener.identity.project?.name,
          listener.identity.project?.path,
          listener.identity.project?.tool,
          listener.launchSource.label,
          listener.launchSource.detail,
          listener.address,
          listener.command,
          listener.executable,
          listener.workingDirectory,
          ...listener.parentChain.flatMap((ancestor) => [
            ancestor.processName,
            ancestor.executable,
            ancestor.command,
          ]),
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (sortKey === "port-desc") return right.port - left.port;
        if (sortKey === "name") {
          return left.identity.displayName.localeCompare(
            right.identity.displayName,
          );
        }
        if (sortKey === "owner") {
          return ownerTypeLabel(left.identity.kind, t).localeCompare(
            ownerTypeLabel(right.identity.kind, t),
            locale,
          );
        }
        if (sortKey === "scope") {
          return exposureLabel(left.exposure, t).localeCompare(
            exposureLabel(right.exposure, t),
            locale,
          );
        }
        return left.port - right.port;
      });
  }, [
    locale,
    ownerFilter,
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
    snapshot?.listeners.filter((listener) => listener.exposure === "network")
      .length ?? 0;
  const localCount =
    snapshot?.listeners.filter((listener) => listener.exposure === "local")
      .length ?? 0;
  const recentChanges = changes.slice(0, isPanelMode ? 3 : 4);

  const copyCommand = useCallback(
    async (listener: PortListener) => {
      if (!listener.command) return;
      await window.hostLens.copyText(listener.command);
      showFeedback("command");
    },
    [showFeedback],
  );

  const copySummary = useCallback(
    async (listener: PortListener, currentSnapshot: PortSnapshot, sanitized: boolean) => {
      const text = createListenerSummary(listener, currentSnapshot, {
        sanitized,
        labels: summaryLabels(t),
      });
      await window.hostLens.copyText(text);
      showFeedback(sanitized ? "sanitized-summary" : "full-summary");
    },
    [showFeedback, t],
  );

  const exportSummary = useCallback(
    async (listener: PortListener, currentSnapshot: PortSnapshot) => {
      const text = createListenerSummary(listener, currentSnapshot, {
        sanitized: true,
        labels: summaryLabels(t),
      });
      const saved = await window.hostLens.exportText(
        `hostlens-port-${listener.port}.txt`,
        text,
      );
      if (saved) showFeedback("export");
    },
    [showFeedback, t],
  );

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
          <h1>
            {activeView === "overview"
              ? t("hostOverview")
              : activeView === "ports"
                ? t("portsView")
                : t("servicesView")}
          </h1>
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
          <svg
            className="language-chevron"
            viewBox="0 0 12 8"
            aria-hidden="true"
          >
            <path d="M1 1.25 6 6.25l5-5" />
          </svg>
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

      <nav className="view-tabs" aria-label="HostLens inspectors">
        <button
          type="button"
          className={activeView === "overview" ? "active" : undefined}
          onClick={() => setActiveView("overview")}
        >
          {t("overviewView")}
        </button>
        <button
          type="button"
          className={activeView === "ports" ? "active" : undefined}
          onClick={() => setActiveView("ports")}
        >
          {t("portsView")}
          <span>{snapshot?.listeners.length ?? 0}</span>
        </button>
        <button
          type="button"
          className={activeView === "services" ? "active" : undefined}
          onClick={() => setActiveView("services")}
        >
          {t("servicesView")}
          <span>
            {serviceSnapshot?.services.filter(
              ({ ownership }) =>
                ownership !== "apple" && ownership !== "application",
            ).length ?? 0}
          </span>
        </button>
      </nav>

      {activeView === "overview" ? (
        <HostOverviewView
          network={networkSnapshot}
          listeners={snapshot?.listeners ?? []}
          services={serviceSnapshot}
          changes={changes}
          panelMode={isPanelMode}
          loading={loading}
          t={t}
          onOpenPort={(listener) => {
            setSelected(listener);
            setActiveView("ports");
          }}
          onOpenService={() => {
            setActiveView("services");
          }}
        />
      ) : activeView === "ports" ? (
        <>
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

      <section className="change-strip" aria-label={t("recentChanges")}>
        <div className="change-strip-heading">
          <strong>{t("recentChanges")}</strong>
          <span>
            {changes.length > 0
              ? t("changesSinceStart", { count: changes.length })
              : t("noSessionChanges")}
          </span>
        </div>
        {recentChanges.length > 0 ? (
          <div className="change-list">
            {recentChanges.map((change) => {
              const item = changeListener(change);
              return (
                <button
                  key={`${change.detectedAt}-${change.id}`}
                  type="button"
                  disabled={!change.after}
                  onClick={() => change.after && setSelected(change.after)}
                >
                  <span className={`change-badge ${change.kind}`}>
                    {changeLabel(change, t)}
                  </span>
                  <strong>
                    {item?.identity.displayName ?? change.socketKey}
                  </strong>
                  <small>
                    {item
                      ? `${item.protocol.toUpperCase()} ${item.address}:${item.port}`
                      : change.socketKey}
                  </small>
                </button>
              );
            })}
          </div>
        ) : null}
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
                setOwnerFilter(event.target.value as ProcessOwnerType | "all")
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
          <output>{t("resultCount", { count: filteredListeners.length })}</output>
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
              <p>{query.trim() ? t("trySearchOrFilters") : t("checkAgain")}</p>
            </div>
          ) : (
            <div className="port-list" aria-busy={loading}>
              {filteredListeners.map((listener) => {
                const listenerChange = listenerForChange(listener, changes);
                return (
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
                        <strong>{listener.identity.displayName}</strong>
                        <span>{listener.protocol.toUpperCase()}</span>
                        <span className={`owner-badge ${listener.identity.kind}`}>
                          {ownerTypeLabel(listener.identity.kind, t)}
                        </span>
                        {listenerChange ? (
                          <span className={`change-badge ${listenerChange.kind}`}>
                            {changeLabel(listenerChange, t)}
                          </span>
                        ) : null}
                      </div>
                      <p className="port-source">
                        {listener.launchSource.label} ·{" "}
                        {confidenceLabel(listener.identity.confidence, t)}
                      </p>
                      <p className="port-meta">
                        {listener.processName} · {listener.address} ·{" "}
                        {exposureLabel(listener.exposure, t)}
                      </p>
                    </div>
                    <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selected && snapshot ? (
          <section className="detail-card" aria-label={t("selectedPortDetails")}>
            <div className="detail-heading">
              <div>
                <span>
                  {selected.protocol.toUpperCase()} {selected.port}
                </span>
                <strong>{selected.identity.displayName}</strong>
                {selected.identity.displayName !== selected.processName ? (
                  <small>
                    {t("process")}: {selected.processName}
                  </small>
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

            <section className="friendly-card">
              <h2>{t("friendlySummary")}</h2>
              <p>{bindingExplanation(selected, t)}</p>
              <dl className="friendly-grid">
                <div>
                  <dt>{t("whyRunning")}</dt>
                  <dd>{sourceKindLabel(selected.launchSource.kind, t)}</dd>
                </div>
                <div>
                  <dt>{t("launchSource")}</dt>
                  <dd>{selected.launchSource.label}</dd>
                </div>
                <div>
                  <dt>{t("automaticStart")}</dt>
                  <dd>
                    {selected.launchSource.automatic === "yes"
                      ? t("yes")
                      : selected.launchSource.automatic === "no"
                        ? t("no")
                        : t("unknown")}
                  </dd>
                </div>
                <div>
                  <dt>{t("identityConfidence")}</dt>
                  <dd>
                    {confidenceLabel(selected.identity.confidence, t)}
                  </dd>
                </div>
              </dl>
            </section>

            <div className="summary-actions">
              <button
                type="button"
                onClick={() => void copySummary(selected, snapshot, false)}
              >
                {copyFeedback === "full-summary"
                  ? t("summaryCopied")
                  : t("copyFullSummary")}
              </button>
              <button
                type="button"
                onClick={() => void copySummary(selected, snapshot, true)}
              >
                {copyFeedback === "sanitized-summary"
                  ? t("summaryCopied")
                  : t("copySanitizedSummary")}
              </button>
              <button
                type="button"
                onClick={() => void exportSummary(selected, snapshot)}
              >
                {copyFeedback === "export"
                  ? t("summaryExported")
                  : t("exportSanitizedSummary")}
              </button>
            </div>
            <p className="sanitized-notice">{t("sanitizedNotice")}</p>

            <details className="technical-details" open={!isPanelMode}>
              <summary>{t("technicalDetails")}</summary>
              <div className="command-block">
                <div className="command-label-row">
                  <span>{t("command")}</span>
                  <button
                    type="button"
                    className="copy-command-button"
                    disabled={!selected.command}
                    onClick={() => void copyCommand(selected)}
                  >
                    {copyFeedback === "command" ? t("copied") : t("copy")}
                  </button>
                </div>
                <code className="full-command" tabIndex={0}>
                  {selected.command ?? t("commandUnavailable")}
                </code>
              </div>

              <dl className="metadata-grid">
                <div><dt>PID</dt><dd>{selected.pid ?? t("unavailable")}</dd></div>
                <div><dt>{t("parentPid")}</dt><dd>{selected.parentPid ?? t("unavailable")}</dd></div>
                <div><dt>{t("user")}</dt><dd>{selected.user ?? t("unavailable")}</dd></div>
                <div><dt>{t("portType")}</dt><dd>{portTypeLabel(selected.portType, t)}</dd></div>
                <div><dt>{t("owner")}</dt><dd>{ownerTypeLabel(selected.identity.kind, t)}</dd></div>
                <div><dt>{t("scope")}</dt><dd>{exposureLabel(selected.exposure, t)}</dd></div>
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
                <div>
                  <dt>{t("identityConfidence")}</dt>
                  <dd>{confidenceLabel(selected.identity.confidence, t)}</dd>
                </div>
              </dl>

              {selected.unavailableFields.length > 0 ? (
                <p className="unavailable-fields">
                  <strong>{t("unavailableFields")}:</strong>{" "}
                  {selected.unavailableFields.join(", ")}
                </p>
              ) : null}

              {selected.identity.project ? (
                <section className="project-card">
                  <h2>{t("project")}</h2>
                  <dl className="metadata-grid">
                    <div><dt>{t("project")}</dt><dd>{selected.identity.project.name}</dd></div>
                    <div><dt>{t("tool")}</dt><dd>{selected.identity.project.tool ?? t("unknown")}</dd></div>
                    <div><dt>{t("runtime")}</dt><dd>{selected.identity.project.runtime ?? t("unknown")}</dd></div>
                    <div>
                      <dt>{t("packageScript")}</dt>
                      <dd>
                        {selected.identity.project.packageManager &&
                        selected.identity.project.script
                          ? `${selected.identity.project.packageManager} ${selected.identity.project.script}`
                          : t("unknown")}
                      </dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              <div className="detail-paths">
                <div>
                  <span>{t("executable")}</span>
                  <code>{selected.executable ?? t("unavailable")}</code>
                </div>
                <div>
                  <span>{t("workingDirectory")}</span>
                  <code>{selected.workingDirectory ?? t("unavailable")}</code>
                </div>
                <div>
                  <span>{t("sourceDetails")}</span>
                  <code>{selected.launchSource.detail ?? selected.launchSource.label}</code>
                </div>
              </div>

              <section className="observation-section">
                <h2>{t("parentChain")}</h2>
                {selected.parentChain.length > 0 ? (
                  <ol className="parent-chain">
                    {selected.parentChain.map((ancestor) => (
                      <li
                        key={ancestor.pid}
                        title={ancestor.command ?? ancestor.executable}
                      >
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
                <h2>{t("identityEvidence")}</h2>
                <ul className="identity-evidence-list">
                  {[
                    ...selected.identity.evidence,
                    ...selected.launchSource.evidence,
                  ].map((item, index) => (
                    <li key={`${item.source}-${item.detail}-${index}`}>
                      <div>
                        <span className={`evidence-kind ${item.kind}`}>
                          {item.kind === "observed"
                            ? t("observed")
                            : t("inferred")}
                        </span>
                        <strong>{item.source}</strong>
                      </div>
                      <p>{item.detail}</p>
                      <small>{confidenceLabel(item.confidence, t)}</small>
                    </li>
                  ))}
                </ul>
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
              <p className="point-in-time">{t("pointInTimeDisclaimer")}</p>
            </details>
          </section>
        ) : !isPanelMode ? (
          <section className="detail-card detail-placeholder">
            {t("selectPort")}
          </section>
        ) : null}
      </div>
        </>
      ) : (
        <ServicesView
          snapshot={serviceSnapshot}
          listeners={snapshot?.listeners ?? []}
          locale={locale}
          loading={loading}
          panelMode={isPanelMode}
          t={t}
          onOpenPort={(listener) => {
            setSelected(listener);
            setActiveView("ports");
          }}
        />
      )}

      {(activeView === "overview"
        ? networkSnapshot?.warnings[0]
        : activeView === "ports"
          ? snapshot?.warnings[0]
          : serviceSnapshot?.warnings[0]) ? (
        <div
          className="warning-strip"
          title={(activeView === "overview"
            ? networkSnapshot?.warnings
            : activeView === "ports"
              ? snapshot?.warnings
              : serviceSnapshot?.warnings
          )?.join("\n")}
        >
          <span>!</span>
          {localizeWarning(
            locale,
            (activeView === "overview"
              ? networkSnapshot?.warnings[0]
              : activeView === "ports"
                ? snapshot?.warnings[0]
                : serviceSnapshot?.warnings[0])!,
          )}
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
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {t("refresh")}
          </button>
          <button type="button" onClick={() => void window.hostLens.quitApp()}>
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
