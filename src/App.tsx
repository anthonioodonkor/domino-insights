import DashboardSidebar from './DashboardSidebar';
import AskDominoChat from './AskDominoChat';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from './module_bindings';


const cardClass =
  'dashboard-card rounded-xl border border-slate-200/60 bg-white p-6 sm:p-7 ' +
  'shadow-[0_12px_38px_-30px_rgba(1,42,45,0.28)] ' +
  'transition-[transform,box-shadow,border-color] duration-300 ease-out ' +
  'motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.005] ' +
  'hover:border-emerald-900/15 ' +
  'hover:shadow-[0_20px_48px_-34px_rgba(1,42,45,0.30)] ' +
  'focus-within:ring-2 focus-within:ring-emerald-900/20';


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
  <div id="top" className="min-h-screen bg-cbre-canvas">
    <DashboardSidebar isActive={isActive} />
    <div className="lg:pl-64">
      <main className="mx-auto max-w-[1480px] px-6 pb-20 sm:px-10 lg:px-14">
      <header className="pt-20 pb-10">
        <div className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#537a6d]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4f856b]" />
          CBRE Invisible Network / Building Intelligence
        </div>

        <h1 className="max-w-4xl bg-gradient-to-r from-slate-900 via-[#003F2D] to-indigo-900 bg-clip-text text-4xl font-semibold tracking-[-0.045em] text-transparent sm:text-5xl lg:text-[3.5rem]">
          Domino Insights
        </h1>

        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#5b6d69]">
          A connected view of infrastructure, operational risk,
          tenant dependencies, and AI-powered building intelligence.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c0d4cb] bg-white px-4 py-2 text-xs font-medium text-cbre-forest">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
            Development campus
          </span>

          <span className="text-xs text-slate-500">
            Synthetic demonstration data
          </span>
        </div>
      </header>


      <div className={cardClass}>
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


            {/* Compact overview row */}
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-12">
              <section
                id="campus"
                className={`${cardClass} scroll-mt-8 xl:col-span-4`}
              >
                <h2>Campus Overview</h2>

                <div className="mt-5 flex items-end gap-3">
                  <span className="text-4xl font-semibold tracking-tight text-cbre-forest">
                    {facilities.length}
                  </span>
                  <span className="pb-1 text-sm text-slate-500">
                    Facilities
                  </span>
                </div>

                <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">System components</span>
                    <strong>{components.length}</strong>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Asset profiles</span>
                    <strong>{assets.length}</strong>
                  </div>
                </div>

                {facilities.map((facility) => (
                  <div
                    key={facility.facilityId}
                    className="mt-5 rounded-lg bg-[#f3f7f3] px-4 py-3"
                  >
                    <p className="font-medium text-cbre-deep">
                      {facility.name}
                    </p>
                    <span className="mt-1 block text-xs text-slate-500">
                      Recorded status: {facility.overallStatus}
                    </span>
                  </div>
                ))}
              </section>

              <section
                id="tenants"
                className={`${cardClass} scroll-mt-8 xl:col-span-4`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2>Tenant SLA Exposure</h2>
                  <span className="rounded-full bg-[#edf3ee] px-3 py-1 text-xs font-medium text-cbre-forest">
                    {tenants.length} tenants
                  </span>
                </div>

                <p className="mb-5 text-xs text-slate-500">
                  Illustrative hourly SLA penalty rates
                </p>

                <div className="space-y-4">
                  {tenants.map((tenant) => (
                    <div
                      key={tenant.tenantId}
                      className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0"
                    >
                      <span className="min-w-0 text-sm font-medium text-cbre-deep">
                        {tenant.name}
                      </span>

                      <span className="shrink-0 text-sm font-semibold tabular-nums text-cbre-forest">
                        ${tenant.hourlySlaPenalty.toLocaleString()}/hr
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                id="work-orders"
                className={`${cardClass} scroll-mt-8 xl:col-span-4`}
              >
                <h2>Work Orders</h2>

                <div className="mt-5 flex items-end gap-3">
                  <span className="text-4xl font-semibold tracking-tight text-cbre-forest">
                    {workOrders.length}
                  </span>
                  <span className="pb-1 text-sm text-slate-500">
                    Recorded orders
                  </span>
                </div>

                {workOrders.length === 0 ? (
                  <div className="mt-6 rounded-lg border border-[#dce8df] bg-[#f5f8f5] px-4 py-4">
                    <p className="text-sm font-medium text-cbre-forest">
                      No work orders stored
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      No maintenance orders in the current data snapshot.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {workOrders.map((order) => (
                      <li key={order.orderId} className="text-sm">
                        <span className="font-medium">
                          {order.description}
                        </span>
                        <span className="block text-xs text-slate-500">
                          Status: {order.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Asymmetric details row */}
            <div className="mt-4 grid items-start gap-4 xl:grid-cols-12">
              <section
                id="assets"
                className={`${cardClass} min-w-0 scroll-mt-8 xl:col-span-7`}
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2>Infrastructure Assets</h2>
                    <p className="text-xs text-slate-500">
                      Building infrastructure and recorded criticality
                    </p>
                  </div>

                  <span className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-xs font-semibold text-cbre-forest">
                    {assets.length} assets
                  </span>
                </div>

                <ul className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  {assets.slice(0, 12).map((asset) => (
                    <li
                      key={asset.componentId}
                      className="min-w-0 rounded-lg border border-slate-100 bg-[#fafbfa] px-3 py-3 transition-colors duration-200 hover:bg-[#f1f6f2]"
                    >
                      <span className="block text-sm font-semibold text-cbre-deep">
                        {asset.assetName}
                      </span>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-500">
                          {asset.domain}
                        </span>

                        <span className="rounded-md border border-[#d9e5dc] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#547364]">
                          {asset.criticality}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {assets.length > 12 && (
                  <p className="mt-5 text-xs text-slate-500">
                    Showing 12 of {assets.length} assets.
                  </p>
                )}
              </section>

              <div className="min-w-0 space-y-4 xl:col-span-5">
                <section
                  id="incidents"
                  className={`${cardClass} scroll-mt-8`}
                >
                  <h2>Incident Logs</h2>

                  {incidents.length === 0 ? (
                    <div className="mt-4 rounded-lg bg-[#f5f8f5] px-4 py-4">
                      <p className="text-sm font-medium text-cbre-forest">
                        No incidents recorded
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        The current demonstration dataset contains no incident logs.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {incidents.slice(0, 10).map((incident) => (
                        <li key={incident.logId} className="text-sm">
                          <strong>{incident.severity}</strong>
                          <span>: {incident.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section
                  id="telemetry"
                  className={`${cardClass} scroll-mt-8`}
                >
                  <h2>Historical Chiller Telemetry</h2>

                  <div className="mb-5 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-tight text-cbre-forest">
                      {chillerReadings.length}
                    </span>
                    <span className="text-xs text-slate-500">
                      research readings
                    </span>
                  </div>

                  <p className="mb-4 rounded-lg bg-[#f4f6f2] px-3 py-3 text-xs leading-5 text-[#69776d]">
                    Historical LBNL simulation, not live telemetry.
                    Timestamp offset is unverified.
                  </p>

                  <ul className="divide-y divide-slate-100">
                    {chillerReadings.slice(0, 8).map((reading) => (
                      <li
                        key={reading.readingId}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-xs"
                      >
                        <span className="min-w-0 break-words text-slate-500">
                          {reading.metricName.replace(/_/g, ' ')}
                        </span>

                        <strong className="font-semibold tabular-nums text-cbre-deep">
                          {reading.value}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>


            <div id="ask-domino" className="scroll-mt-8">
              <AskDominoChat />
            </div>
          </main>
      </div>
    </div>
  );
}