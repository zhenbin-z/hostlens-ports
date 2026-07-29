import { useEffect, useMemo, useState } from "react";
import type { PortListener } from "../../shared/ports";
import type {
  ServiceDefinition,
  ServiceKind,
  ServiceManager,
  ServiceScope,
  ServiceSnapshot,
  ServiceStatus,
  StartupBehavior,
} from "../../shared/services";
import type { Locale, MessageKey } from "./i18n";
import {
  filterAndSortServices,
  type ServiceSort,
} from "./service-view-model";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;
interface ServicesViewProps {
  snapshot: ServiceSnapshot | undefined;
  listeners: readonly PortListener[];
  locale: Locale;
  loading: boolean;
  panelMode: boolean;
  t: Translator;
  onOpenPort(listener: PortListener): void;
}

function statusLabel(status: ServiceStatus, t: Translator): string {
  if (status === "running") return t("running");
  if (status === "loaded") return t("loaded");
  if (status === "stopped") return t("stopped");
  if (status === "failed") return t("failed");
  if (status === "disabled") return t("disabled");
  return t("unknown");
}

function startupLabel(startup: StartupBehavior, t: Translator): string {
  if (startup === "automatic") return t("automatic");
  if (startup === "on-demand") return t("onDemand");
  if (startup === "disabled") return t("disabled");
  return t("unknown");
}

function managerLabel(manager: ServiceManager, t: Translator): string {
  if (manager === "homebrew") return t("homebrew");
  if (manager === "systemd") return t("systemd");
  return t("launchd");
}

function kindLabel(kind: ServiceKind, t: Translator): string {
  if (kind === "user-agent") return t("userAgent");
  if (kind === "system-agent") return t("systemAgent");
  return t("systemDaemon");
}

function scopeLabel(scope: ServiceScope, t: Translator): string {
  return scope === "user" ? t("user") : t("system");
}

function serviceExplanation(
  service: ServiceDefinition,
  t: Translator,
): string {
  const values = { name: service.displayName };
  if (service.status === "running") {
    return t("serviceRunningExplanation", values);
  }
  if (service.status === "loaded") {
    return t("serviceLoadedExplanation", values);
  }
  if (service.status === "stopped") {
    return t("serviceStoppedExplanation", values);
  }
  if (service.status === "failed") {
    return t("serviceFailedExplanation", values);
  }
  if (service.status === "disabled") {
    return t("serviceDisabledExplanation", values);
  }
  return t("serviceUnknownExplanation", values);
}

function startupExplanation(
  startup: StartupBehavior,
  t: Translator,
): string {
  if (startup === "automatic") return t("startupAutomaticExplanation");
  if (startup === "on-demand") return t("startupOnDemandExplanation");
  if (startup === "disabled") return t("startupDisabledExplanation");
  return t("startupUnknownExplanation");
}

export function ServicesView({
  snapshot,
  listeners,
  locale,
  loading,
  panelMode,
  t,
  onOpenPort,
}: ServicesViewProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [manager, setManager] = useState<ServiceManager | "all">("all");
  const [status, setStatus] = useState<ServiceStatus | "all">("all");
  const [startup, setStartup] = useState<StartupBehavior | "all">("all");
  const [scope, setScope] = useState<ServiceScope | "all">("all");
  const [includeApple, setIncludeApple] = useState(false);
  const [includeApplicationJobs, setIncludeApplicationJobs] = useState(false);
  const [sort, setSort] = useState<ServiceSort>("status");

  const services = snapshot?.services ?? [];
  const filteredServices = useMemo(() => {
    return filterAndSortServices(services, {
      query,
      manager,
      status,
      startup,
      scope,
      includeApple,
      includeApplicationJobs,
      sort,
      locale,
    });
  }, [
    includeApple,
    includeApplicationJobs,
    locale,
    manager,
    query,
    scope,
    services,
    sort,
    startup,
    status,
  ]);

  useEffect(() => {
    if (panelMode) return;
    if (
      selectedId &&
      filteredServices.some(({ id }) => id === selectedId)
    ) {
      return;
    }
    setSelectedId(filteredServices[0]?.id);
  }, [filteredServices, panelMode, selectedId]);

  const selected = services.find(({ id }) => id === selectedId);
  const relatedListeners = selected
    ? selected.relatedListenerIds
        .map((id) => listeners.find((listener) => listener.id === id))
        .filter((listener): listener is PortListener => Boolean(listener))
    : [];
  const visibleConfigured = services.filter(
    (service) =>
      (includeApple || service.ownership !== "apple") &&
      (includeApplicationJobs || service.ownership !== "application"),
  );
  const runningCount = visibleConfigured.filter(
    ({ status: serviceStatus }) => serviceStatus === "running",
  ).length;
  const attentionCount = visibleConfigured.filter(
    ({ status: serviceStatus }) =>
      serviceStatus === "failed" || serviceStatus === "unknown",
  ).length;

  return (
    <>
      <section className="summary" aria-label={t("serviceSummary")}>
        <div>
          <strong>{visibleConfigured.length}</strong>
          <span>{t("configuredServices")}</span>
        </div>
        <div>
          <strong>{runningCount}</strong>
          <span>{t("runningServices")}</span>
        </div>
        <div className={attentionCount > 0 ? "attention" : undefined}>
          <strong>{attentionCount}</strong>
          <span>{t("attentionServices")}</span>
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
          placeholder={t("searchServicesPlaceholder")}
          aria-label={t("searchServices")}
        />
      </label>

      {!panelMode ? (
        <section
          className="filter-bar service-filter-bar"
          aria-label={t("serviceFiltersAndSorting")}
        >
          <label>
            <span>{t("manager")}</span>
            <select
              value={manager}
              onChange={(event) =>
                setManager(event.target.value as ServiceManager | "all")
              }
            >
              <option value="all">{t("allManagers")}</option>
              <option value="launchd">{t("launchd")}</option>
              <option value="homebrew">{t("homebrew")}</option>
              <option value="systemd">{t("systemd")}</option>
            </select>
          </label>
          <label>
            <span>{t("status")}</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ServiceStatus | "all")
              }
            >
              <option value="all">{t("allStatuses")}</option>
              <option value="running">{t("running")}</option>
              <option value="loaded">{t("loaded")}</option>
              <option value="stopped">{t("stopped")}</option>
              <option value="failed">{t("failed")}</option>
              <option value="disabled">{t("disabled")}</option>
              <option value="unknown">{t("unknown")}</option>
            </select>
          </label>
          <label>
            <span>{t("startup")}</span>
            <select
              value={startup}
              onChange={(event) =>
                setStartup(event.target.value as StartupBehavior | "all")
              }
            >
              <option value="all">{t("allStartup")}</option>
              <option value="automatic">{t("automatic")}</option>
              <option value="on-demand">{t("onDemand")}</option>
              <option value="disabled">{t("disabled")}</option>
              <option value="unknown">{t("unknown")}</option>
            </select>
          </label>
          <label>
            <span>{t("scope")}</span>
            <select
              value={scope}
              onChange={(event) =>
                setScope(event.target.value as ServiceScope | "all")
              }
            >
              <option value="all">{t("allScopes")}</option>
              <option value="user">{t("user")}</option>
              <option value="system">{t("system")}</option>
            </select>
          </label>
          <label>
            <span>{t("sort")}</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as ServiceSort)
              }
            >
              <option value="status">{t("statusThenName")}</option>
              <option value="name">{t("serviceName")}</option>
              <option value="manager">{t("manager")}</option>
              <option value="startup">{t("startup")}</option>
            </select>
          </label>
          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={includeApple}
              onChange={(event) => setIncludeApple(event.target.checked)}
            />
            <span>{t("includeAppleSystem")}</span>
          </label>
          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={includeApplicationJobs}
              onChange={(event) =>
                setIncludeApplicationJobs(event.target.checked)
              }
            />
            <span>{t("includeApplicationJobs")}</span>
          </label>
          <output>{t("resultCount", { count: filteredServices.length })}</output>
        </section>
      ) : (
        <div className="panel-service-toggles">
          <label className="panel-apple-toggle">
            <input
              type="checkbox"
              checked={includeApple}
              onChange={(event) => setIncludeApple(event.target.checked)}
            />
            <span>{t("includeAppleSystem")}</span>
          </label>
          <label className="panel-apple-toggle">
            <input
              type="checkbox"
              checked={includeApplicationJobs}
              onChange={(event) =>
                setIncludeApplicationJobs(event.target.checked)
              }
            />
            <span>{t("includeApplicationJobs")}</span>
          </label>
        </div>
      )}

      <div className="workspace service-workspace">
        <section className="content">
          {filteredServices.length === 0 && !loading ? (
            <div className="empty-state">
              <strong>
                {query.trim()
                  ? t("noMatchingServices")
                  : t("noConfiguredServices")}
              </strong>
              <p>{query.trim() ? t("trySearchOrFilters") : t("serviceCheckAgain")}</p>
            </div>
          ) : (
            <div className="port-list service-list" aria-busy={loading}>
              {filteredServices.map((service) => (
                <button
                  className={`port-row service-row ${
                    selected?.id === service.id ? "selected" : ""
                  }`}
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedId(service.id)}
                >
                  <div className={`service-status ${service.status}`}>
                    <span />
                    <strong>{statusLabel(service.status, t)}</strong>
                  </div>
                  <div className="port-main">
                    <div className="port-title">
                      <strong>{service.displayName}</strong>
                      <span>{managerLabel(service.manager, t)}</span>
                      <span
                        className={`owner-badge ${
                          service.ownership === "apple" ? "system" : "service"
                        }`}
                      >
                        {service.ownership === "apple"
                          ? t("appleSystem")
                          : service.ownership === "application"
                            ? t("applicationRuntime")
                            : t("thirdParty")}
                      </span>
                    </div>
                    <p className="port-source">{service.label}</p>
                    <p className="port-meta">
                      {startupLabel(service.startup, t)} ·{" "}
                      {scopeLabel(service.scope, t)} ·{" "}
                      {service.relatedListenerIds.length} {t("portsView")}
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
          <section
            className="detail-card service-detail"
            aria-label={t("selectedServiceDetails")}
          >
            <div className="detail-heading">
              <div>
                <span>
                  {managerLabel(selected.manager, t)} ·{" "}
                  {statusLabel(selected.status, t)}
                </span>
                <strong>{selected.displayName}</strong>
                <small>{selected.label}</small>
              </div>
              {panelMode ? (
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setSelectedId(undefined)}
                  aria-label={t("closeDetails")}
                >
                  ×
                </button>
              ) : null}
            </div>

            <section className="friendly-card">
              <h2>{t("serviceFriendlySummary")}</h2>
              <p>{serviceExplanation(selected, t)}</p>
              <p>{startupExplanation(selected.startup, t)}</p>
              <dl className="friendly-grid">
                <div>
                  <dt>{t("status")}</dt>
                  <dd>{statusLabel(selected.status, t)}</dd>
                </div>
                <div>
                  <dt>{t("startup")}</dt>
                  <dd>{startupLabel(selected.startup, t)}</dd>
                </div>
                <div>
                  <dt>{t("manager")}</dt>
                  <dd>{managerLabel(selected.manager, t)}</dd>
                </div>
                <div>
                  <dt>{t("identityConfidence")}</dt>
                  <dd>
                    {selected.confidence === "high"
                      ? t("highConfidence")
                      : selected.confidence === "medium"
                        ? t("mediumConfidence")
                        : t("lowConfidence")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="observation-section relationship-section">
              <h2>{t("relatedPorts")}</h2>
              {relatedListeners.length > 0 ? (
                <div className="related-port-list">
                  {relatedListeners.map((listener) => (
                    <button
                      key={listener.id}
                      type="button"
                      onClick={() => onOpenPort(listener)}
                    >
                      <strong>
                        {listener.protocol.toUpperCase()} {listener.port}
                      </strong>
                      <span>{listener.identity.displayName}</span>
                      <small>{t("openPort")}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>{t("noRelatedPorts")}</p>
              )}
            </section>

            <details className="technical-details" open={!panelMode}>
              <summary>{t("technicalDetails")}</summary>
              <dl className="metadata-grid">
                <div><dt>{t("label")}</dt><dd>{selected.label}</dd></div>
                <div><dt>{t("manager")}</dt><dd>{managerLabel(selected.manager, t)}</dd></div>
                <div><dt>{t("serviceKind")}</dt><dd>{kindLabel(selected.kind, t)}</dd></div>
                <div><dt>{t("scope")}</dt><dd>{scopeLabel(selected.scope, t)}</dd></div>
                <div><dt>{t("status")}</dt><dd>{statusLabel(selected.status, t)}</dd></div>
                <div><dt>{t("startup")}</dt><dd>{startupLabel(selected.startup, t)}</dd></div>
                <div><dt>PID</dt><dd>{selected.pid ?? t("unavailable")}</dd></div>
                <div><dt>{t("lastExitStatus")}</dt><dd>{selected.lastExitStatus ?? t("unavailable")}</dd></div>
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

              {selected.unavailableFields.length > 0 ? (
                <p className="unavailable-fields">
                  <strong>{t("unavailableFields")}:</strong>{" "}
                  {selected.unavailableFields.join(", ")}
                </p>
              ) : null}

              <div className="detail-paths">
                <div>
                  <span>{t("program")}</span>
                  <code>{selected.program ?? t("unavailable")}</code>
                </div>
                <div>
                  <span>{t("arguments")}</span>
                  <code>
                    {selected.arguments.length > 0
                      ? selected.arguments.join(" ")
                      : t("unavailable")}
                  </code>
                </div>
                <div>
                  <span>{t("plistPath")}</span>
                  <code>{selected.plistPath ?? t("unavailable")}</code>
                </div>
              </div>

              <section className="observation-section">
                <h2>{t("relatedProcesses")}</h2>
                {selected.relatedProcesses.length > 0 ? (
                  <ol className="parent-chain service-processes">
                    {selected.relatedProcesses.map((process) => (
                      <li key={process.pid} title={process.command}>
                        <strong>{process.processName}</strong>
                        <span>
                          PID {process.pid} · {process.relationship}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>{t("noRelatedProcesses")}</p>
                )}
              </section>

              <section className="observation-section">
                <h2>{t("serviceEvidence")}</h2>
                <ul className="identity-evidence-list">
                  {selected.evidence.map((item, index) => (
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
                      <small>
                        {item.confidence === "high"
                          ? t("highConfidence")
                          : item.confidence === "medium"
                            ? t("mediumConfidence")
                            : t("lowConfidence")}
                      </small>
                    </li>
                  ))}
                </ul>
              </section>
              <p className="point-in-time">{t("pointInTimeDisclaimer")}</p>
            </details>
          </section>
        ) : !panelMode ? (
          <section className="detail-card detail-placeholder">
            {t("selectService")}
          </section>
        ) : null}
      </div>
    </>
  );
}
