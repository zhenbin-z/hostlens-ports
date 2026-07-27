import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortListener, PortSnapshot } from "../../shared/ports";

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
      return "Network exposed";
    default:
      return "Unknown scope";
  }
}

export function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<PortSnapshot>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PortListener>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const nextSnapshot = await window.hostLens.listPorts();
      setSnapshot(nextSnapshot);
      setSelected((current) =>
        current
          ? nextSnapshot.listeners.find((listener) => listener.id === current.id)
          : undefined,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to scan ports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredListeners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return snapshot?.listeners ?? [];

    return (snapshot?.listeners ?? []).filter((listener) =>
      [
        listener.port.toString(),
        listener.processName,
        listener.address,
        listener.source,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [query, snapshot]);

  const networkCount =
    snapshot?.listeners.filter((listener) => listener.exposure === "network").length ?? 0;
  const localCount =
    snapshot?.listeners.filter((listener) => listener.exposure === "local").length ?? 0;

  return (
    <main className="panel">
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
          <span>Network</span>
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
          placeholder="Search port or process"
          aria-label="Search ports"
        />
      </label>

      <section className="content">
        {error ? (
          <div className="empty-state error-state">
            <strong>Scan failed</strong>
            <p>{error}</p>
          </div>
        ) : filteredListeners.length === 0 && !loading ? (
          <div className="empty-state">
            <strong>No matching ports</strong>
            <p>Try another port number or process name.</p>
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
                  {listener.port}
                </div>
                <div className="port-main">
                  <div className="port-title">
                    <strong>{listener.processName}</strong>
                    <span>{listener.protocol.toUpperCase()}</span>
                  </div>
                  <p>
                    {listener.address} · {exposureLabel(listener.exposure)}
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
              <strong>{selected.processName}</strong>
            </div>
            <button
              type="button"
              className="close-button"
              onClick={() => setSelected(undefined)}
              aria-label="Close details"
            >
              ×
            </button>
          </div>
          <dl>
            <div>
              <dt>PID</dt>
              <dd>{selected.pid ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{selected.source ?? "Unknown"}</dd>
            </div>
            <div className="wide">
              <dt>Command</dt>
              <dd>{selected.command ?? "Unavailable"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <footer>
        <span className={loading ? "status-dot scanning" : "status-dot"} />
        {loading ? "Scanning…" : `Updated ${formatScanTime(snapshot?.scannedAt)}`}
        <span className="sample-badge">Sample data</span>
      </footer>
    </main>
  );
}

