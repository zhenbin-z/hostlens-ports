import { useMemo, useState } from "react";
import type {
  ChangeEvent,
  ChangeResourceKind,
  HistoryState,
  ResourcePreference,
} from "../../shared/history";
import type { Locale, MessageKey } from "./i18n";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

interface ChangesViewProps {
  history: HistoryState;
  locale: Locale;
  t: Translator;
  onUpdate(
    update: {
      resourceKey?: string;
      preference?: ResourcePreference;
      retentionDays?: number;
      alertsEnabled?: boolean;
    },
  ): Promise<void>;
  onClear(): Promise<void>;
}

type ChangeFilter = ChangeEvent["kind"] | "all";
type ResourceFilter = ChangeResourceKind | "all";

function changeLabel(kind: ChangeEvent["kind"], t: Translator): string {
  if (kind === "added") return t("persistentAdded");
  if (kind === "removed") return t("persistentRemoved");
  return t("persistentChanged");
}

function resourceLabel(
  kind: ChangeResourceKind,
  t: Translator,
): string {
  if (kind === "port") return t("changeResourcePort");
  if (kind === "service") return t("changeResourceService");
  if (kind === "network") return t("changeResourceNetwork");
  if (kind === "runtime") return t("changeResourceRuntime");
  return t("changeResourcePackage");
}

function preferenceFor(
  history: HistoryState,
  resourceKey: string,
): ResourcePreference {
  return (
    history.preferences.find((item) => item.resourceKey === resourceKey)
      ?.preference ?? "default"
  );
}

export function ChangesView({
  history,
  locale,
  t,
  onUpdate,
  onClear,
}: ChangesViewProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>("all");
  const [resourceFilter, setResourceFilter] =
    useState<ResourceFilter>("all");
  const [showIgnored, setShowIgnored] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const normalizedQuery = query.trim().toLowerCase();
  const watchedCount = history.preferences.filter(
    ({ preference }) => preference === "watched",
  ).length;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1_000;
  const todayCount = history.events.filter(
    ({ detectedAt }) => Date.parse(detectedAt) >= dayAgo,
  ).length;

  const events = useMemo(
    () =>
      history.events.filter((event) => {
        const preference = preferenceFor(history, event.resourceKey);
        if (!showIgnored && preference === "ignored") return false;
        if (changeFilter !== "all" && event.kind !== changeFilter) return false;
        if (
          resourceFilter !== "all" &&
          event.resourceKind !== resourceFilter
        ) {
          return false;
        }
        if (!normalizedQuery) return true;
        return [
          event.label,
          event.resourceKey,
          event.resourceKind,
          event.kind,
          ...event.changedFields,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
    [
      changeFilter,
      history,
      normalizedQuery,
      resourceFilter,
      showIgnored,
    ],
  );
  const selected =
    events.find(({ id }) => id === selectedId) ?? events[0];
  const selectedPreference = selected
    ? preferenceFor(history, selected.resourceKey)
    : "default";

  const updatePreference = async (
    preference: ResourcePreference,
  ): Promise<void> => {
    if (!selected) return;
    await onUpdate({
      resourceKey: selected.resourceKey,
      preference,
    });
  };

  return (
    <section className="changes-view">
      <section className="summary" aria-label={t("persistentChangesSummary")}>
        <div>
          <strong>{history.events.length}</strong>
          <span>{t("storedChanges")}</span>
        </div>
        <div>
          <strong>{todayCount}</strong>
          <span>{t("last24Hours")}</span>
        </div>
        <div className={watchedCount > 0 ? "attention" : undefined}>
          <strong>{watchedCount}</strong>
          <span>{t("watchedResources")}</span>
        </div>
      </section>

      <section className="history-settings">
        <label className="history-switch">
          <input
            type="checkbox"
            checked={history.settings.alertsEnabled}
            onChange={(event) =>
              void onUpdate({ alertsEnabled: event.target.checked })
            }
          />
          <span>
            <strong>{t("desktopAlerts")}</strong>
            <small>{t("desktopAlertsDescription")}</small>
          </span>
        </label>
        <label>
          <span>{t("retention")}</span>
          <select
            value={history.settings.retentionDays}
            onChange={(event) =>
              void onUpdate({ retentionDays: Number(event.target.value) })
            }
          >
            <option value={7}>{t("daysCount", { count: 7 })}</option>
            <option value={14}>{t("daysCount", { count: 14 })}</option>
            <option value={30}>{t("daysCount", { count: 30 })}</option>
            <option value={90}>{t("daysCount", { count: 90 })}</option>
          </select>
        </label>
        <button
          type="button"
          className="history-clear"
          disabled={history.events.length === 0}
          onClick={() => {
            if (window.confirm(t("clearHistoryConfirmation"))) {
              void onClear();
            }
          }}
        >
          {t("clearHistory")}
        </button>
      </section>

      <label className="search history-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchChanges")}
          aria-label={t("searchChanges")}
        />
      </label>

      <section className="filter-bar history-filters">
        <label>
          <span>{t("changeType")}</span>
          <select
            value={changeFilter}
            onChange={(event) =>
              setChangeFilter(event.target.value as ChangeFilter)
            }
          >
            <option value="all">{t("allChanges")}</option>
            <option value="added">{t("persistentAdded")}</option>
            <option value="changed">{t("persistentChanged")}</option>
            <option value="removed">{t("persistentRemoved")}</option>
          </select>
        </label>
        <label>
          <span>{t("resourceType")}</span>
          <select
            value={resourceFilter}
            onChange={(event) =>
              setResourceFilter(event.target.value as ResourceFilter)
            }
          >
            <option value="all">{t("allResources")}</option>
            <option value="port">{t("changeResourcePort")}</option>
            <option value="service">{t("changeResourceService")}</option>
            <option value="network">{t("changeResourceNetwork")}</option>
            <option value="runtime">{t("changeResourceRuntime")}</option>
            <option value="package">{t("changeResourcePackage")}</option>
          </select>
        </label>
        <label className="compact-check">
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={(event) => setShowIgnored(event.target.checked)}
          />
          <span>{t("showIgnored")}</span>
        </label>
        <output>{t("resultCount", { count: events.length })}</output>
      </section>

      <div
        className={`workspace history-workspace ${selected ? "" : "without-detail"}`}
      >
        <section className="content">
          {events.length === 0 ? (
            <div className="empty-state">
              <strong>{t("noPersistentChanges")}</strong>
              <p>{t("historyBaselineDescription")}</p>
            </div>
          ) : (
            <div className="history-list">
              {events.map((event) => {
                const preference = preferenceFor(history, event.resourceKey);
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`history-row ${selected?.id === event.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(event.id)}
                  >
                    <span className={`history-kind ${event.kind}`}>
                      {changeLabel(event.kind, t)}
                    </span>
                    <span className="history-row-main">
                      <strong>{event.label}</strong>
                      <small>
                        {resourceLabel(event.resourceKind, t)} ·{" "}
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(event.detectedAt))}
                      </small>
                    </span>
                    {preference !== "default" ? (
                      <span className={`preference-badge ${preference}`}>
                        {preference === "watched"
                          ? t("watched")
                          : t("ignored")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selected ? (
          <aside className="detail-card history-detail">
            <div className="detail-heading">
              <div>
                <span>
                  {resourceLabel(selected.resourceKind, t)} ·{" "}
                  {changeLabel(selected.kind, t)}
                </span>
                <strong>{selected.label}</strong>
                <small>{selected.resourceKey}</small>
              </div>
            </div>

            <div className="preference-actions">
              <button
                type="button"
                className={selectedPreference === "watched" ? "active" : ""}
                onClick={() =>
                  void updatePreference(
                    selectedPreference === "watched" ? "default" : "watched",
                  )
                }
              >
                {selectedPreference === "watched"
                  ? t("stopWatching")
                  : t("watchResource")}
              </button>
              <button
                type="button"
                className={selectedPreference === "ignored" ? "active" : ""}
                onClick={() =>
                  void updatePreference(
                    selectedPreference === "ignored" ? "default" : "ignored",
                  )
                }
              >
                {selectedPreference === "ignored"
                  ? t("stopIgnoring")
                  : t("ignoreResource")}
              </button>
            </div>

            <dl className="metadata-grid">
              <div>
                <dt>{t("detectedAt")}</dt>
                <dd>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  }).format(new Date(selected.detectedAt))}
                </dd>
              </div>
              <div>
                <dt>{t("evidence")}</dt>
                <dd>
                  {t("evidenceItems", { count: selected.evidenceCount })}
                </dd>
              </div>
            </dl>

            <section className="observation-section">
              <h2>{t("persistentChangedFields")}</h2>
              {selected.changedFields.length > 0 ? (
                <div className="field-chips">
                  {selected.changedFields.map((field) => (
                    <span key={field}>{field}</span>
                  ))}
                </div>
              ) : (
                <p>{t("resourceAddedOrRemoved")}</p>
              )}
            </section>

            <p className="history-disclaimer">
              {t("historyEvidenceDisclaimer")}
            </p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
