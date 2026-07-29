import { useEffect, useMemo, useState } from "react";
import type { PortListener } from "../../shared/ports";
import type {
  GlobalPackage,
  PackageManagerKind,
  RuntimeKind,
  RuntimeSnapshot,
} from "../../shared/runtimes";
import type { ServiceDefinition } from "../../shared/services";
import {
  createRuntimePackageSummary,
  type RuntimeSummaryLabels,
} from "../../shared/runtime-summary";
import type { Locale, MessageKey } from "./i18n";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;
type PackageSort = "name" | "manager";
type SummaryFeedback = "copy" | "export";

interface RuntimesViewProps {
  snapshot: RuntimeSnapshot | undefined;
  listeners: readonly PortListener[];
  services: readonly ServiceDefinition[];
  locale: Locale;
  loading: boolean;
  panelMode: boolean;
  t: Translator;
  onOpenPort(listener: PortListener): void;
}

function runtimeLabel(kind: RuntimeKind, t: Translator): string {
  return kind === "node" ? t("nodeRuntime") : t("pythonRuntime");
}

function packageRuntimeKind(
  manager: PackageManagerKind,
): RuntimeKind {
  return manager === "pip" || manager === "pipx" ? "python" : "node";
}

function summaryLabels(t: Translator): RuntimeSummaryLabels {
  return {
    title: `HostLens Ports · ${t("runtimePackageObservation")}`,
    packageName: t("packageName"),
    version: t("version"),
    manager: t("manager"),
    runtime: t("runtimeKind"),
    managerExecutable: t("managerExecutable"),
    environment: t("environment"),
    installPath: t("packagePath"),
    executables: t("providedExecutables"),
    observation: t("observation"),
    collectedAt: t("collectedAt"),
    evidence: t("evidence"),
    unknown: t("unknown"),
    disclaimer: t("packageInventoryDisclaimer"),
  };
}

export function RuntimesView({
  snapshot,
  listeners,
  services,
  locale,
  loading,
  panelMode,
  t,
  onOpenPort,
}: RuntimesViewProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [manager, setManager] = useState<PackageManagerKind | "all">("all");
  const [runtimeKind, setRuntimeKind] = useState<RuntimeKind | "all">("all");
  const [sort, setSort] = useState<PackageSort>("name");
  const [selectedId, setSelectedId] = useState<string>();
  const [summaryFeedback, setSummaryFeedback] = useState<SummaryFeedback>();
  const runtimes = snapshot?.runtimes ?? [];
  const packages = snapshot?.packages ?? [];
  const managers = [...new Set(packages.map((pkg) => pkg.manager))];

  const filteredPackages = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return packages
      .filter((pkg) => {
        if (manager !== "all" && pkg.manager !== manager) return false;
        if (
          runtimeKind !== "all" &&
          packageRuntimeKind(pkg.manager) !== runtimeKind
        ) {
          return false;
        }
        if (!normalizedQuery) return true;
        return [
          pkg.name,
          pkg.version,
          pkg.manager,
          pkg.managerExecutable,
          pkg.installPath,
          pkg.environmentPath,
          ...pkg.executables,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery),
          );
      })
      .sort((left, right) => {
        if (sort === "manager") {
          const managerOrder = left.manager.localeCompare(
            right.manager,
            locale,
          );
          if (managerOrder !== 0) return managerOrder;
        }
        return left.name.localeCompare(right.name, locale);
      });
  }, [locale, manager, packages, query, runtimeKind, sort]);

  useEffect(() => {
    if (panelMode) return;
    if (
      selectedId &&
      filteredPackages.some(({ id }) => id === selectedId)
    ) {
      return;
    }
    setSelectedId(filteredPackages[0]?.id);
  }, [filteredPackages, panelMode, selectedId]);

  const selected = packages.find(({ id }) => id === selectedId);
  const selectedRuntime = selected?.runtimeId
    ? runtimes.find(({ id }) => id === selected.runtimeId)
    : undefined;
  const relationships = selected
    ? (snapshot?.relationships ?? []).filter(
        ({ packageId }) => packageId === selected.id,
      )
    : [];

  useEffect(() => {
    if (!summaryFeedback) return;
    const timer = window.setTimeout(() => setSummaryFeedback(undefined), 1_800);
    return () => window.clearTimeout(timer);
  }, [summaryFeedback]);

  const copySummary = async (): Promise<void> => {
    if (!selected || !snapshot) return;
    await window.hostLens.copyText(
      createRuntimePackageSummary(selected, selectedRuntime, snapshot, {
        labels: summaryLabels(t),
      }),
    );
    setSummaryFeedback("copy");
  };

  const exportSummary = async (): Promise<void> => {
    if (!selected || !snapshot) return;
    const saved = await window.hostLens.exportText(
      `hostlens-package-${selected.name.replace(/[^a-z0-9._-]+/gi, "-")}.txt`,
      createRuntimePackageSummary(selected, selectedRuntime, snapshot, {
        sanitized: true,
        labels: summaryLabels(t),
      }),
    );
    if (saved) setSummaryFeedback("export");
  };

  return (
    <>
      <section className="summary" aria-label={t("runtimeSummary")}>
        <div>
          <strong>{runtimes.length}</strong>
          <span>{t("installedRuntimes")}</span>
        </div>
        <div>
          <strong>{packages.length}</strong>
          <span>{t("observedPackages")}</span>
        </div>
        <div>
          <strong>{managers.length}</strong>
          <span>{t("packageManagers")}</span>
        </div>
      </section>

      <section className="runtime-strip" aria-label={t("runtimeInventory")}>
        <div className="runtime-strip-heading">
          <strong>{t("runtimeInventory")}</strong>
          <span>{runtimes.length}</span>
        </div>
        <div className="runtime-cards">
          {runtimes.map((runtime) => (
            <article key={runtime.id}>
              <span className={`runtime-kind ${runtime.kind}`}>
                {runtimeLabel(runtime.kind, t)}
              </span>
              <strong>{runtime.version}</strong>
              <small>{runtime.source}</small>
              <code title={runtime.executable}>{runtime.executable}</code>
            </article>
          ))}
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
          placeholder={t("searchPackagesPlaceholder")}
          aria-label={t("searchPackages")}
        />
      </label>

      {!panelMode ? (
        <section className="filter-bar" aria-label={t("packageFiltersAndSorting")}>
          <label>
            <span>{t("manager")}</span>
            <select
              value={manager}
              onChange={(event) =>
                setManager(event.target.value as PackageManagerKind | "all")
              }
            >
              <option value="all">{t("allPackageManagers")}</option>
              <option value="npm">npm</option>
              <option value="yarn">Yarn</option>
              <option value="pnpm">pnpm</option>
              <option value="pip">pip</option>
              <option value="pipx">pipx</option>
            </select>
          </label>
          <label>
            <span>{t("runtimeKind")}</span>
            <select
              value={runtimeKind}
              onChange={(event) =>
                setRuntimeKind(event.target.value as RuntimeKind | "all")
              }
            >
              <option value="all">{t("allRuntimes")}</option>
              <option value="node">{t("nodeRuntime")}</option>
              <option value="python">{t("pythonRuntime")}</option>
            </select>
          </label>
          <label>
            <span>{t("sort")}</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as PackageSort)
              }
            >
              <option value="name">{t("packageName")}</option>
              <option value="manager">{t("packageManagerThenName")}</option>
            </select>
          </label>
          <output>{t("resultCount", { count: filteredPackages.length })}</output>
        </section>
      ) : null}

      <div className="workspace runtime-workspace">
        <section className="content">
          {filteredPackages.length === 0 && !loading ? (
            <div className="empty-state">
              <strong>
                {query.trim() || manager !== "all" || runtimeKind !== "all"
                  ? t("noMatchingPackages")
                  : t("noPackagesObserved")}
              </strong>
              <p>{t("packageInventoryNote")}</p>
            </div>
          ) : (
            <div className="package-list" aria-busy={loading}>
              {filteredPackages.map((pkg) => {
                const runtime = pkg.runtimeId
                  ? runtimes.find(({ id }) => id === pkg.runtimeId)
                  : undefined;
                const relationshipCount = snapshot?.relationships.filter(
                  ({ packageId }) => packageId === pkg.id,
                ).length ?? 0;
                return (
                  <button
                    className={`package-row ${selected?.id === pkg.id ? "selected" : ""}`}
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedId(pkg.id)}
                  >
                    <span className={`manager-badge ${pkg.manager}`}>
                      {pkg.manager}
                    </span>
                    <span className="package-main">
                      <strong>{pkg.name}</strong>
                      <small>
                        {pkg.version} ·{" "}
                        {runtime
                          ? `${runtimeLabel(runtime.kind, t)} ${runtime.version}`
                          : runtimeLabel(packageRuntimeKind(pkg.manager), t)}
                      </small>
                    </span>
                    {relationshipCount > 0 ? (
                      <span className="relationship-count">
                        {relationshipCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selected ? (
          <section className="detail-card" aria-label={t("selectedPackageDetails")}>
            <div className="detail-heading">
              <div>
                <span>{selected.manager}</span>
                <strong>{selected.name}</strong>
                <small>{selected.version}</small>
              </div>
            </div>

            <dl className="metadata-grid">
              <div>
                <dt>{t("runtimeKind")}</dt>
                <dd>
                  {selectedRuntime
                    ? `${runtimeLabel(selectedRuntime.kind, t)} ${selectedRuntime.version}`
                    : runtimeLabel(packageRuntimeKind(selected.manager), t)}
                </dd>
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

            <div className="summary-actions">
              <button type="button" onClick={() => void copySummary()}>
                {summaryFeedback === "copy"
                  ? t("packageSummaryCopied")
                  : t("copyPackageSummary")}
              </button>
              <button type="button" onClick={() => void exportSummary()}>
                {summaryFeedback === "export"
                  ? t("packageSummaryExported")
                  : t("exportPackageSummary")}
              </button>
            </div>

            <div className="detail-paths">
              <div>
                <span>{t("managerExecutable")}</span>
                <code>{selected.managerExecutable}</code>
              </div>
              <div>
                <span>{t("environment")}</span>
                <code>
                  {selected.environmentPath ??
                    selectedRuntime?.environmentPath ??
                    t("unavailable")}
                </code>
              </div>
              <div>
                <span>{t("packagePath")}</span>
                <code>{selected.installPath ?? t("unavailable")}</code>
              </div>
              <div>
                <span>{t("providedExecutables")}</span>
                <code>
                  {selected.executables.length > 0
                    ? selected.executables.join(", ")
                    : t("unavailable")}
                </code>
              </div>
            </div>

            <section className="observation-section">
              <h2>{t("relatedHostActivity")}</h2>
              {relationships.length > 0 ? (
                <ul className="runtime-relationship-list">
                  {relationships.map((relationship) => {
                    const listener =
                      relationship.targetType === "listener"
                        ? listeners.find(
                            ({ id }) => id === relationship.targetId,
                          )
                        : undefined;
                    const service =
                      relationship.targetType === "service"
                        ? services.find(
                            ({ id }) => id === relationship.targetId,
                          )
                        : undefined;
                    return (
                      <li key={`${relationship.targetType}-${relationship.targetId}`}>
                        {listener ? (
                          <button type="button" onClick={() => onOpenPort(listener)}>
                            <strong>
                              {listener.identity.displayName} · {listener.port}
                            </strong>
                            <span>{relationship.reason}</span>
                          </button>
                        ) : (
                          <>
                            <strong>
                              {service?.displayName ?? relationship.targetId}
                            </strong>
                            <span>{relationship.reason}</span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="overview-empty">{t("noRelatedHostActivity")}</p>
              )}
            </section>

            <section className="observation-section">
              <h2>{t("evidence")}</h2>
              <ul className="identity-evidence-list">
                {selected.evidence.map((item) => (
                  <li key={`${item.source}-${item.detail}`}>
                    <strong>{item.source}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
            <p className="point-in-time">{t("packageInventoryNote")}</p>
          </section>
        ) : !panelMode ? (
          <section className="detail-card detail-placeholder">
            {t("selectPackage")}
          </section>
        ) : null}
      </div>
    </>
  );
}
