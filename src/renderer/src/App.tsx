import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PortExposure,
  PortListener,
  PortSnapshot,
  PortType,
  ProcessOwnerType,
} from "../../shared/ports";

type SortKey = "port-asc" | "port-desc" | "name" | "owner" | "scope";

const isPanelMode =
  new URLSearchParams(window.location.search).get("mode") === "panel";

function formatScanTime(value?: string): string {
  if (!value) return "Not scanned";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function exposureLabel(exposure: PortListener["exposure"]): string {
  switch (exposure) {
    case "local":
      return "Local only";
    case "network":
      return "Network-facing";
    default:
      return "Unknown scope";
  }
}

function portTypeLabel(portType: PortType): string {
  switch (portType) {
    case "system":
      return "System";
    case "service":
      return "Service";
    case "dynamic":
      return "Dynamic";
  }
}

function ownerTypeLabel(ownerType?: ProcessOwnerType): string {
  switch (ownerType) {
    case "system":
      return "System";
    case "service":
      return "Service";
    case "application":
      return "Application";
    case "development":
      return "Development";
    default:
      return "Unknown";
  }
}

export function App(): React.JSX.Element {
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
      setError(cause instanceof Error ? cause.message : "Unable to scan ports.");
    } finally {
      scanningRef.current = false;
      setLoading(false);
    }
  }, []);

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
            return ownerTypeLabel(left.ownerType).localeCompare(
              ownerTypeLabel(right.ownerType),
            );
          case "scope":
            return exposureLabel(left.exposure).localeCompare(
              exposureLabel(right.exposure),
            );
          case "port-asc":
          default:
            return left.port - right.port;
        }
      });
  }, [
    ownerFilter,
    portTypeFilter,
    query,
    scopeFilter,
    snapshot,
    sortKey,
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
        <button
          className="icon-button"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh port list"
          title="Refresh"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
          </svg>
        </button>
      </header>

      <section className="summary" aria-label="Port summary">
        <div>
          <strong>{snapshot?.listeners.length ?? "—"}</strong>
          <span>Listening</span>
        </div>
        <div>
          <strong>{localCount}</strong>
          <span>Local only</span>
        </div>
        <div className={networkCount > 0 ? "attention" : undefined}>
          <strong>{networkCount}</strong>
          <span>Network-facing</span>
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
          placeholder="Search port, process, or command"
          aria-label="Search ports"
        />
      </label>

      {!isPanelMode ? (
        <section className="filter-bar" aria-label="Port filters and sorting">
          <label>
            <span>Port type</span>
            <select
              value={portTypeFilter}
              onChange={(event) =>
                setPortTypeFilter(event.target.value as PortType | "all")
              }
            >
              <option value="all">All types</option>
              <option value="system">System · 0–1023</option>
              <option value="service">Service · 1024–49151</option>
              <option value="dynamic">Dynamic · 49152–65535</option>
            </select>
          </label>
          <label>
            <span>Owner</span>
            <select
              value={ownerFilter}
              onChange={(event) =>
                setOwnerFilter(
                  event.target.value as ProcessOwnerType | "all",
                )
              }
            >
              <option value="all">All owners</option>
              <option value="system">System</option>
              <option value="service">Service</option>
              <option value="application">Application</option>
              <option value="development">Development</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            <span>Scope</span>
            <select
              value={scopeFilter}
              onChange={(event) =>
                setScopeFilter(event.target.value as PortExposure | "all")
              }
            >
              <option value="all">All scopes</option>
              <option value="local">Local only</option>
              <option value="network">Network-facing</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              <option value="port-asc">Port · low to high</option>
              <option value="port-desc">Port · high to low</option>
              <option value="name">Process name</option>
              <option value="owner">Owner type</option>
              <option value="scope">Scope</option>
            </select>
          </label>
          <output>{filteredListeners.length} results</output>
        </section>
      ) : null}

      <div className="workspace">
        <section className="content">
          {error ? (
            <div className="empty-state error-state">
              <strong>Scan failed</strong>
              <p>{error}</p>
            </div>
          ) : filteredListeners.length === 0 && !loading ? (
            <div className="empty-state">
              <strong>
                {query.trim() ? "No matching ports" : "No TCP listeners detected"}
              </strong>
              <p>
                {query.trim()
                  ? "Try another search or clear a filter."
                  : "HostLens will check again while this window is open."}
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
                    <span>{portTypeLabel(listener.portType)}</span>
                  </div>
                  <div className="port-main">
                    <div className="port-title">
                      <strong>{listener.displayName ?? listener.processName}</strong>
                      <span>{listener.protocol.toUpperCase()}</span>
                      <span className={`owner-badge ${listener.ownerType ?? "unknown"}`}>
                        {ownerTypeLabel(listener.ownerType)}
                      </span>
                    </div>
                    {listener.command ? (
                      <p className="port-command" title={listener.command}>
                        {listener.command}
                      </p>
                    ) : null}
                    <p className="port-meta">
                      {listener.processName} · {listener.address} ·{" "}
                      {exposureLabel(listener.exposure)}
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
          <section className="detail-card" aria-label="Selected port details">
            <div className="detail-heading">
              <div>
                <span>{selected.protocol.toUpperCase()} {selected.port}</span>
                <strong>{selected.displayName ?? selected.processName}</strong>
                {selected.displayName &&
                selected.displayName !== selected.processName ? (
                  <small>Process: {selected.processName}</small>
                ) : null}
              </div>
              {isPanelMode ? (
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setSelected(undefined)}
                  aria-label="Close details"
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="command-block">
              <div className="command-label-row">
                <span>Command</span>
                <button
                  type="button"
                  className="copy-command-button"
                  disabled={!selected.command}
                  onClick={() => void copyCommand(selected)}
                >
                  {copiedCommandId === selected.id ? "Copied" : "Copy"}
                </button>
              </div>
              <code className="full-command" tabIndex={0}>
                {selected.command ?? "Command details are unavailable."}
              </code>
            </div>
            <dl className="metadata-grid">
              <div>
                <dt>PID</dt>
                <dd>{selected.pid ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>Parent PID</dt>
                <dd>{selected.parentPid ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>User</dt>
                <dd>{selected.user ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>Port type</dt>
                <dd>{portTypeLabel(selected.portType)}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{ownerTypeLabel(selected.ownerType)}</dd>
              </div>
              <div>
                <dt>Scope</dt>
                <dd>{exposureLabel(selected.exposure)}</dd>
              </div>
            </dl>
          </section>
        ) : !isPanelMode ? (
          <section className="detail-card detail-placeholder">
            Select a port to inspect its process and full command.
          </section>
        ) : null}
      </div>

      {snapshot?.warnings[0] ? (
        <div className="warning-strip" title={snapshot.warnings.join("\n")}>
          <span>!</span>
          {snapshot.warnings[0]}
        </div>
      ) : null}

      {isPanelMode ? (
        <nav className="panel-actions" aria-label="HostLens actions">
          <button
            className="primary-action"
            type="button"
            onClick={() => void window.hostLens.openMainWindow()}
          >
            Open App
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void window.hostLens.quitApp()}
          >
            Quit
          </button>
        </nav>
      ) : null}

      <footer>
        <span className={loading ? "status-dot scanning" : "status-dot"} />
        {loading ? "Scanning…" : `Updated ${formatScanTime(snapshot?.scannedAt)}`}
        <span className="sample-badge">
          {snapshot?.warnings.some((warning) => warning.includes("sample data"))
            ? "Sample data"
            : "Live"}
        </span>
      </footer>
    </main>
  );
}
