import type { NetworkSnapshot } from "../../shared/network.ts";
import type {
  ListenerChange,
  PortListener,
} from "../../shared/ports.ts";
import type {
  ServiceDefinition,
  ServiceSnapshot,
} from "../../shared/services.ts";
import type { MessageKey } from "./i18n.ts";

type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

interface HostOverviewViewProps {
  network: NetworkSnapshot | undefined;
  listeners: readonly PortListener[];
  services: ServiceSnapshot | undefined;
  changes: readonly ListenerChange[];
  panelMode: boolean;
  loading: boolean;
  t: Translator;
  onOpenPort(listener: PortListener): void;
  onOpenService(service: ServiceDefinition): void;
}

function relationFor(
  network: NetworkSnapshot | undefined,
  listener: PortListener,
) {
  return network?.socketRelations.find(
    (relation) => relation.listenerId === listener.id,
  );
}

export function HostOverviewView({
  network,
  listeners,
  services,
  changes,
  panelMode,
  loading,
  t,
  onOpenPort,
  onOpenService,
}: HostOverviewViewProps): React.JSX.Element {
  const activeInterfaces = network?.interfaces.filter(
    (item) =>
      item.status === "up" &&
      item.addresses.some((address) => address.scope === "network"),
  ) ?? [];
  const persistentServices =
    services?.services.filter(
      (service) =>
        service.ownership !== "apple" &&
        service.ownership !== "application",
    ) ?? [];
  const runningServices = persistentServices.filter(
    (service) => service.status === "running",
  );
  const networkFacing = listeners.filter(
    (listener) =>
      relationFor(network, listener)?.reachability === "potential",
  );
  const defaultInterface = network?.interfaces.find(
    (item) => item.name === network.summary.defaultInterfaceName,
  );

  return (
    <div className="overview-scroll" aria-busy={loading}>
      <section className="overview-hero">
        <div>
          <span>{t("currentNetwork")}</span>
          <strong>
            {defaultInterface?.displayName ??
              network?.summary.defaultInterfaceName ??
              t("notObserved")}
          </strong>
          <small>
            {network?.summary.primaryAddress ?? t("addressUnavailable")}
          </small>
        </div>
        <div className="network-state-chips">
          <span className={network?.summary.vpnActive ? "active" : undefined}>
            {network?.summary.vpnActive ? t("vpnObserved") : t("noVpnObserved")}
          </span>
          <span>
            {network?.summary.defaultGateway
              ? t("defaultRouteObserved")
              : t("defaultRouteUnavailable")}
          </span>
        </div>
      </section>

      <section className="overview-metrics" aria-label={t("hostOverview")}>
        <div>
          <strong>{activeInterfaces.length}</strong>
          <span>{t("activeInterfaces")}</span>
        </div>
        <div>
          <strong>{runningServices.length}</strong>
          <span>{t("backgroundServices")}</span>
        </div>
        <div className={networkFacing.length > 0 ? "attention" : undefined}>
          <strong>{networkFacing.length}</strong>
          <span>{t("potentiallyReachable")}</span>
        </div>
        <div>
          <strong>{changes.length}</strong>
          <span>{t("sessionChangesShort")}</span>
        </div>
      </section>

      <p className="reachability-note">{t("reachabilityDisclaimer")}</p>

      <div className="overview-grid">
        <section className="overview-card">
          <div className="overview-card-heading">
            <div>
              <span>{t("networkContext")}</span>
              <strong>{t("interfacesAndAddresses")}</strong>
            </div>
            <small>{activeInterfaces.length}</small>
          </div>
          {activeInterfaces.length > 0 ? (
            <ul className="interface-list">
              {activeInterfaces
                .slice(0, panelMode ? 3 : undefined)
                .map((networkInterface) => (
                  <li key={networkInterface.id}>
                    <div>
                      <strong>{networkInterface.displayName}</strong>
                      <span>
                        {networkInterface.name} ·{" "}
                        {t(`interfaceKind_${networkInterface.kind}`)}
                      </span>
                    </div>
                    <div className="interface-addresses">
                      {networkInterface.addresses
                        .filter((address) => address.scope !== "host")
                        .slice(0, 2)
                        .map((address) => (
                          <code
                            key={`${address.family}:${address.address}`}
                            title={address.address}
                          >
                            {address.address}
                          </code>
                        ))}
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="overview-empty">{t("noInterfacesObserved")}</p>
          )}
          <dl className="network-facts">
            <div>
              <dt>{t("defaultGateway")}</dt>
              <dd>{network?.summary.defaultGateway ?? t("unavailable")}</dd>
            </div>
            <div>
              <dt>{t("dnsServers")}</dt>
              <dd>
                {network?.summary.dnsServers.join(", ") || t("unavailable")}
              </dd>
            </div>
          </dl>
        </section>

        <section className="overview-card">
          <div className="overview-card-heading">
            <div>
              <span>{t("socketContext")}</span>
              <strong>{t("networkFacingListeners")}</strong>
            </div>
            <small>{networkFacing.length}</small>
          </div>
          {networkFacing.length > 0 ? (
            <div className="overview-link-list">
              {networkFacing
                .slice(0, panelMode ? 3 : 6)
                .map((listener) => {
                  const relation = relationFor(network, listener);
                  const interfaceNames = (relation?.interfaceIds ?? [])
                    .map((id) =>
                      network?.interfaces.find((item) => item.id === id),
                    )
                    .filter((item) => item !== undefined)
                    .map((item) => item.displayName);
                  return (
                    <button
                      type="button"
                      key={listener.id}
                      onClick={() => onOpenPort(listener)}
                    >
                      <span>{listener.port}</span>
                      <div>
                        <strong>{listener.identity.displayName}</strong>
                        <small>
                          {interfaceNames.join(", ") ||
                            listener.address}{" "}
                          · {t("notActivelyTested")}
                        </small>
                      </div>
                      <b>›</b>
                    </button>
                  );
                })}
            </div>
          ) : (
            <p className="overview-empty">{t("noPotentialListeners")}</p>
          )}
        </section>

        {!panelMode ? (
          <section className="overview-card">
            <div className="overview-card-heading">
              <div>
                <span>{t("startupContext")}</span>
                <strong>{t("backgroundServices")}</strong>
              </div>
              <small>{persistentServices.length}</small>
            </div>
            {persistentServices.length > 0 ? (
              <div className="overview-link-list services">
                {persistentServices.slice(0, 6).map((service) => (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => onOpenService(service)}
                  >
                    <span className={`service-dot ${service.status}`} />
                    <div>
                      <strong>{service.displayName}</strong>
                      <small>
                        {service.manager} · {service.startup}
                      </small>
                    </div>
                    <b>›</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className="overview-empty">{t("noBackgroundServices")}</p>
            )}
          </section>
        ) : null}

        {!panelMode ? (
          <section className="overview-card">
            <div className="overview-card-heading">
              <div>
                <span>{t("observationBoundaries")}</span>
                <strong>{t("whatHostLensKnows")}</strong>
              </div>
            </div>
            <ul className="boundary-list">
              <li><span className="observed" />{t("boundObserved")}</li>
              <li><span className="potential" />{t("potentialInferred")}</li>
              <li><span className="tested" />{t("activeTestNotPerformed")}</li>
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
