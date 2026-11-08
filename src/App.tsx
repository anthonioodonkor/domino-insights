
import type { CSSProperties } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from './module_bindings';

const panel: CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: 20,
  background: '#fff',
};

export default function App() {
  // Use the single connection managed by src/main.tsx.
  const { isActive } = useSpacetimeDB();

  // Each hook subscribes to its table and updates React automatically.
  const [facilities, facilitiesReady] = useTable(tables.facility);
  const [components, componentsReady] = useTable(tables.systemComponent);
  const [assets, assetsReady] = useTable(tables.assetProfile);
  const [tenants, tenantsReady] = useTable(tables.tenantLease);
  const [workOrders, ordersReady] = useTable(tables.workOrder);
  const [incidents, incidentsReady] = useTable(tables.incidentLog);
  const [research, researchReady] = useTable(tables.researchTelemetry);

  const dataReady =
    facilitiesReady &&
    componentsReady &&
    assetsReady &&
    tenantsReady &&
    ordersReady &&
    incidentsReady &&
    researchReady;

  // Only show the validated historical research sequence.
  const chillerReadings = research
    .filter(
      (reading) =>
        reading.componentId === 'MS-CHILLER-1' &&
        reading.sequenceId === 'LBNL-2E91'
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 32,
        fontFamily: 'Arial, sans-serif',
        color: '#1f2937',
      }}
    >
      <h1>Domino Insights</h1>
      <p>CBRE Invisible Network — Development Dashboard</p>

      <div style={panel}>
        <strong>
          {isActive
            ? dataReady
              ? 'Connected — subscriptions ready'
              : 'Connected — loading subscriptions'
            : 'Connecting to SpacetimeDB...'}
        </strong>

        <p>Database: cbre-telemetry-dev</p>
        <p>Mode: Read-only verification</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          marginTop: 24,
        }}
      >
        <section style={panel}>
          <h2>Campus Overview</h2>
          <p>Facilities: {facilities.length}</p>
          <p>System components: {components.length}</p>
          <p>Asset profiles: {assets.length}</p>

          {facilities.map((facility) => (
            <p key={facility.facilityId}>
              <strong>{facility.name}</strong>
              <span> — {facility.overallStatus}</span>
            </p>
          ))}
        </section>

        <section style={panel}>
          <h2>Infrastructure Assets ({assets.length})</h2>
          <ul>
            {assets.slice(0, 12).map((asset) => (
              <li key={asset.componentId}>
                <strong>{asset.assetName}</strong>
                {' — '}
                {asset.domain} ({asset.criticality})
              </li>
            ))}
          </ul>
        </section>

        <section style={panel}>
          <h2>Tenant SLA Exposure ({tenants.length})</h2>
          <ul>
            {tenants.map((tenant) => (
              <li key={tenant.tenantId}>
                <strong>{tenant.name}</strong>
                {' — $'}
                {tenant.hourlySlaPenalty.toLocaleString()}/hr
              </li>
            ))}
          </ul>
        </section>

        <section style={panel}>
          <h2>Work Orders ({workOrders.length})</h2>
          {workOrders.length === 0 ? (
            <p>No work orders stored.</p>
          ) : (
            <ul>
              {workOrders.map((order) => (
                <li key={order.orderId}>
                  {order.description} — {order.status}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={panel}>
          <h2>Incident Logs ({incidents.length})</h2>
          {incidents.length === 0 ? (
            <p>No incident logs stored.</p>
          ) : (
            <ul>
              {incidents.slice(0, 10).map((incident) => (
                <li key={incident.logId}>
                  {incident.severity}: {incident.description}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={panel}>
          <h2>Historical Chiller Telemetry</h2>
          <p>Research readings: {chillerReadings.length}</p>
          <p style={{ fontSize: 13, color: '#666' }}>
            Historical LBNL simulation, not live telemetry.
            Timestamp offset is unverified.
          </p>

          <ul>
            {chillerReadings.slice(0, 8).map((reading) => (
              <li key={reading.readingId}>
                {reading.metricName}: {reading.value}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}