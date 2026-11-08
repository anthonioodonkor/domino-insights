import { useState } from "react";
import { ArrowLeft, MapPin, Users, Wrench } from "lucide-react";
import type { DominoState } from "../lib/types";
import type { Navigate } from "./Overview";
import { money, dateTime } from "../lib/format";
import {
  Badge,
  Button,
  EmptyState,
  SectionTitle,
  TextLink,
} from "../components/ui";
import { BuildingGraph } from "../components/BuildingGraph";
import { SensorTrendChart } from "../components/SensorTrendChart";

export function BuildingDetail({
  state,
  id,
  navigate,
}: {
  state: DominoState;
  id: string;
  navigate: Navigate;
}) {
  const p = state.portfolio;
  const building = p.buildings.find((b) => b.id === id);
  const assets = p.assets.filter((a) => a.buildingId === id);
  const initial =
    assets.find((a) =>
      p.incidents.some((i) => i.assetId === a.id && i.status !== "resolved"),
    )?.id ??
    assets[0]?.id ??
    "";
  const [selectedId, setSelectedId] = useState(initial);
  if (!building)
    return (
      <EmptyState title="Building unavailable">
        This building is no longer in the shared portfolio.{" "}
        <button className="text-link" onClick={() => navigate("overview")}>
          Return to overview
        </button>
      </EmptyState>
    );
  const selected = assets.find((a) => a.id === selectedId) ?? assets[0];
  const zone = p.zones.find((z) => z.id === selected?.zoneId);
  const occupancy = p.occupancy
    .filter((o) => o.zoneId === zone?.id)
    .sort((a, b) => b.recordedAt - a.recordedAt)[0];
  const incidents = p.incidents.filter((i) =>
    assets.some((a) => a.id === i.assetId),
  );
  const tickets = p.tickets.filter((t) => t.assetId === selected?.id);
  return (
    <>
      <button className="back-link" onClick={() => navigate("overview")}>
        <ArrowLeft size={15} />
        Portfolio overview
      </button>
      <div className="page-heading">
        <div>
          <h1>{building.name}</h1>
          <p className="inline-icon">
            <MapPin size={14} />
            {building.locationLabel} <span className="separator">/</span>{" "}
            {assets.length} connected assets{" "}
            <span className="separator">/</span>{" "}
            {p.zones.filter((z) => z.buildingId === id).length} zones
          </p>
        </div>
        <span className="scope-label">Synthetic building</span>
      </div>
      <div className="building-columns">
        <section className="panel graph-panel">
          <SectionTitle
            title="Building relationships"
            description="Select an asset to inspect its operational context"
          />
          <BuildingGraph
            building={building}
            portfolio={p}
            selectedAssetId={selected?.id ?? ""}
            onSelectAsset={setSelectedId}
          />
          <div className="graph-key">
            <span>
              <i />
              Building & zone
            </span>
            <span>
              <i className="key-alert" />
              Critical incident
            </span>
            <span>Scroll to zoom · drag to explore</span>
          </div>
        </section>
        <section className="panel asset-context">
          <SectionTitle title="Asset context" />
          <label className="field">
            Selected asset
            <select
              value={selected?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.assetType}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <div className="asset-name">
                <span className="building-icon">
                  <Wrench size={24} />
                </span>
                <div>
                  <h3>{selected.name}</h3>
                  <span className="muted small">
                    {selected.assetType} · {zone?.name}
                  </span>
                </div>
              </div>
              <dl className="facts">
                <div>
                  <dt>Asset status</dt>
                  <dd>{selected.status}</dd>
                </div>
                <div>
                  <dt>Zone occupancy</dt>
                  <dd>
                    <Users size={14} />
                    {occupancy
                      ? `${occupancy.people} / ${zone?.capacity ?? "—"}`
                      : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Occupancy recorded</dt>
                  <dd>
                    {occupancy ? dateTime(occupancy.recordedAt) : "No data"}
                  </dd>
                </div>
                <div>
                  <dt>Maintenance tickets</dt>
                  <dd>
                    {
                      tickets.filter(
                        (t) => t.status !== "closed" && t.status !== "resolved",
                      ).length
                    }{" "}
                    open
                  </dd>
                </div>
              </dl>
              {p.incidents
                .filter(
                  (i) => i.assetId === selected.id && i.status !== "resolved",
                )
                .map((i) => (
                  <div className="asset-alert" key={i.id}>
                    <Badge value={i.severity} />
                    <p>Correlated signals require review.</p>
                    <Button onClick={() => navigate("incident", i.id)}>
                      Review incident
                    </Button>
                  </div>
                ))}
            </>
          )}
        </section>
      </div>
      <div className="building-columns">
        <section className="panel">
          <SectionTitle
            title="Sensor trends"
            description={`${selected?.name ?? "Select an asset"} · output and temperature`}
          />
          <SensorTrendChart
            readings={p.readings.filter((r) => r.assetId === selected?.id)}
          />
        </section>
        <section className="panel">
          <SectionTitle
            title="Maintenance context"
            description="Work orders linked to this asset"
          />
          {tickets.length ? (
            <div className="ticket-list">
              {tickets.map((t) => (
                <div className="ticket" key={t.id}>
                  <div>
                    <span className="small muted">{t.id}</span>
                    <Badge value={t.status} />
                  </div>
                  <h3>{t.summary}</h3>
                  <span className="small muted">{t.priority} priority</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-inline muted">
              No maintenance tickets linked to this asset.
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <SectionTitle
          title="Incident register"
          description="Shared incident history for this building"
        />
        {incidents.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Risk score</th>
                  <th>Severity</th>
                  <th>Lifecycle</th>
                  <th>Estimated exposure</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium">
                      {assets.find((a) => a.id === i.assetId)?.name}
                    </td>
                    <td>{i.riskScore} / 100</td>
                    <td>
                      <Badge value={i.severity} />
                    </td>
                    <td>
                      <Badge value={i.status} />
                    </td>
                    <td>{money(i.estimatedImpact)}</td>
                    <td>
                      <TextLink onClick={() => navigate("incident", i.id)}>
                        View incident
                      </TextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-inline muted">
            No incidents recorded for this building.
          </p>
        )}
      </section>
    </>
  );
}
