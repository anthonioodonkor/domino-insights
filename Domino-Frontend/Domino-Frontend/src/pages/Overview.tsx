import { useState } from "react";
import {
  ArrowRight,
  Building2,
  MapPin,
  Search,
  ClipboardList,
} from "lucide-react";
import type { DominoState } from "../lib/types";
import { money, dateTime } from "../lib/format";
import { SummaryCards, type SummaryDestination } from "../components/SummaryCards";
import { Badge, EmptyState, SectionTitle, TextLink } from "../components/ui";

export type Navigate = (
  type: "overview" | "building" | "incident",
  id?: string,
) => void;
export function Overview({
  state,
  navigate,
}: {
  state: DominoState;
  navigate: Navigate;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "urgent" | "unassigned" | "approval" | "exposure">("all");
  const [showOccupancy, setShowOccupancy] = useState(false);
  const p = state.portfolio;
  const active = p.incidents
    .filter((i) => i.status !== "resolved")
    .sort((a, b) => b.riskScore - a.riskScore);
  const pendingIds = new Set(p.proposals.filter(proposal => proposal.status === "proposed").map(proposal => proposal.incidentId));
  const visible = active.filter(i => filter === "urgent" ? i.severity === "critical" : filter === "unassigned" ? !i.assignedTo : filter === "approval" ? pendingIds.has(i.id) : true)
    .sort((a, b) => filter === "exposure" ? b.estimatedImpact - a.estimatedImpact : b.riskScore - a.riskScore);
  const filters = [
    { id: "all", label: "All active", count: active.length },
    { id: "urgent", label: "Urgent incidents", count: active.filter(i => i.severity === "critical").length },
    { id: "unassigned", label: "Unassigned issues", count: active.filter(i => !i.assignedTo).length },
    { id: "approval", label: "Awaiting approval", count: active.filter(i => pendingIds.has(i.id)).length },
  ] as const;
  const jumpTo = (id: string) => requestAnimationFrame(() => {
    const section = document.getElementById(id);
    section?.scrollIntoView({ block: "start", behavior: "instant" });
    section?.focus({ preventScroll: true });
  });
  const selectSummary = (destination: SummaryDestination) => {
    if (destination === "buildings") { setSearch(""); jumpTo("portfolio-buildings"); }
    else if (destination === "occupancy") { setShowOccupancy(true); jumpTo("portfolio-occupancy"); }
    else { setFilter(destination === "exposure" ? "exposure" : "all"); jumpTo("portfolio-attention"); }
  };
  const latestOccupancy = p.zones.map(zone => ({ zone, snapshot: p.occupancy.filter(o => o.zoneId === zone.id).sort((a,b) => b.recordedAt - a.recordedAt)[0] }));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Portfolio overview</h1>
          <p>
            A clear view of your buildings. A head start on what comes next.
          </p>
        </div>
        <span className="scope-label">
          <span className="status-dot" />
          Synthetic portfolio
        </span>
      </div>
      <SummaryCards portfolio={p} onSelect={selectSummary} />
      <div className="overview-columns">
        <section className="panel incident-priority" id="portfolio-attention" tabIndex={-1}>
          <SectionTitle
            title="Attention required"
            description={filter === "exposure" ? "Highest estimated exposure first" : "Correlated signals, prioritized by operational risk"}
          >
            <span className="count-label" aria-live="polite">{visible.length} shown</span>
          </SectionTitle>
          <div className="queue-filters" aria-label="Filter incidents">
            {filters.map(item => <button key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label} <span>{item.count}</span></button>)}
            {filter === "exposure" && <span className="sort-note">Sorted by exposure</span>}
          </div>
          {visible.length ? (
            <div className="priority-list">
              {visible.map((incident) => {
                const asset = p.assets.find((a) => a.id === incident.assetId);
                const building = p.buildings.find(
                  (b) => b.id === asset?.buildingId,
                );
                const zone = p.zones.find((z) => z.id === asset?.zoneId);
                return (
                  <button
                    className="priority-row"
                    key={incident.id}
                    onClick={() => navigate("incident", incident.id)}
                  >
                    <div className={`risk-number risk-${incident.severity}`}>
                      <strong>{incident.riskScore}</strong>
                      <span>/100</span>
                    </div>
                    <div className="priority-copy">
                      <div className="row-title">
                        {asset?.name ?? incident.assetId}
                        <Badge value={incident.severity} />
                      </div>
                      <p>
                        {building?.name} <span> / </span> {zone?.name}
                      </p>
                      <div className="small muted">
                        {incident.evidence.length} linked risk signals ·{" "}
                        {incident.dataQuality === "sufficient"
                          ? "Sufficient data"
                          : "Insufficient data"}
                      </div>
                    </div>
                    <div className="priority-cost">
                      <strong>{money(incident.estimatedImpact)}</strong>
                      <span>estimated exposure</span>
                    </div>
                    <ArrowRight size={18} className="row-arrow" />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title={active.length ? "No incidents match this filter" : "No active incidents"}>
              {active.length ? "Choose All active to see the remaining work." : "Your portfolio has no active incidents. Managers can start a scenario from Demo controls."}
            </EmptyState>
          )}
        </section>
        <aside className="work-queue panel">
          <SectionTitle title="Team work queue" description={state.connectionStatus === "preview" ? "Sample priorities in this browser tab" : state.connectionStatus === "live" ? "Live priorities across your portfolio" : "Last received priorities - connection unavailable"}><ClipboardList size={22} /></SectionTitle>
          <div className="queue-actions">
            {filters.filter(item => item.id !== "all").map(item => (
              <button key={item.id} onClick={() => { setFilter(item.id); jumpTo("portfolio-attention"); }} aria-pressed={filter === item.id}>
                <span><strong>{item.count}</strong>{item.label}</span><ArrowRight size={17} />
              </button>
            ))}
          </div>
          <p className="queue-note">{state.member?.role === "manager" ? "Review pending responses and help assign open work." : "Claim unassigned work and propose a response. Managers review approvals."} Counts may overlap.</p>
        </aside>
      </div>
      <section className="panel" id="portfolio-buildings" tabIndex={-1}>
        <SectionTitle
          title="Your buildings"
          description="Explore connected zones, assets, and incident context"
        >
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search buildings"
              placeholder="Find a building…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </SectionTitle>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Building</th>
                <th>Monitored assets</th>
                <th>Active incidents</th>
                <th>Estimated exposure</th>
                <th aria-label="View building" />
              </tr>
            </thead>
            <tbody>
              {p.buildings
                .filter((b) =>
                  `${b.name} ${b.locationLabel}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((b) => {
                  const assets = p.assets.filter((a) => a.buildingId === b.id);
                  const incidents = active.filter((i) =>
                    assets.some((a) => a.id === i.assetId),
                  );
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="building-cell">
                          <span className="building-icon">
                            <Building2 size={22} />
                          </span>
                          <div>
                            <button
                              className="table-title"
                              onClick={() => navigate("building", b.id)}
                            >
                              {b.name}
                            </button>
                            <span>
                              <MapPin size={11} />
                              {b.locationLabel}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {assets.length}
                        <span className="cell-secondary">
                          across{" "}
                          {p.zones.filter((z) => z.buildingId === b.id).length}{" "}
                          zones
                        </span>
                      </td>
                      <td>
                        {incidents.length ? (
                          <Badge
                            value={
                              incidents.some((i) => i.severity === "critical")
                                ? "critical"
                                : incidents.some(
                                      (i) => i.severity === "elevated",
                                    )
                                  ? "elevated"
                                  : "watch"
                            }
                          />
                        ) : (
                          <span className="healthy-label">
                            <span />
                            No active incidents
                          </span>
                        )}
                      </td>
                      <td className="money-cell">
                        {money(
                          incidents.reduce((s, i) => s + i.estimatedImpact, 0),
                        )}
                      </td>
                      <td>
                        <TextLink onClick={() => navigate("building", b.id)}>
                          View building
                        </TextLink>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!p.buildings.length && (
          <EmptyState title="Portfolio is empty">
            A provisioned manager can seed the shared synthetic portfolio from
            Demo controls.
          </EmptyState>
        )}
        {p.buildings.length > 0 &&
          !p.buildings.some((b) =>
            `${b.name} ${b.locationLabel}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ) && (
            <p className="empty-inline muted">No buildings match “{search}”.</p>
          )}
      </section>
      {showOccupancy && <section className="panel" id="portfolio-occupancy" tabIndex={-1}>
        <SectionTitle title="Occupancy by zone" description="Latest synthetic observations; timestamps use the simulation clock">
          <button className="text-link" onClick={() => { setShowOccupancy(false); document.querySelector<HTMLButtonElement>('[aria-label="Explore current occupancy"]')?.focus(); }}>Close details</button>
        </SectionTitle>
        <div className="table-scroll"><table><thead><tr><th>Building / zone</th><th>People / capacity</th><th>Recorded</th><th>Explore</th></tr></thead><tbody>
          {latestOccupancy.map(({zone, snapshot}) => <tr key={zone.id}><td>{p.buildings.find(b => b.id === zone.buildingId)?.name} / {zone.name}</td><td>{snapshot ? snapshot.people : "Unavailable"} / {zone.capacity}</td><td>{snapshot ? dateTime(snapshot.recordedAt) : "No observation"}</td><td><TextLink onClick={() => navigate("building", zone.buildingId)}>View building</TextLink></td></tr>)}
        </tbody></table></div>
        {!latestOccupancy.length && <p className="empty-inline muted">No zone observations are available yet.</p>}
      </section>}
      {p.incidents.some((i) => i.status === "resolved") && (
        <section className="panel">
          <SectionTitle title="Resolved incidents" />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Status</th>
                  <th>Last updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.incidents
                  .filter((i) => i.status === "resolved")
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        {p.assets.find((a) => a.id === i.assetId)?.name ??
                          i.assetId}
                      </td>
                      <td>
                        <Badge value={i.status} />
                      </td>
                      <td>{dateTime(i.updatedAt)}</td>
                      <td>
                        <TextLink onClick={() => navigate("incident", i.id)}>
                          View history
                        </TextLink>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
