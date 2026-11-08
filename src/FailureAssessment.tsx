import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FlaskConical, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { DbConnection, tables } from './module_bindings';
import { explainAssessment, exposureForMinutes, parseIds, responseGuidance } from './assessmentInsights';
import ResponseGuide from './ResponseGuide';

type Asset = { componentId: string; assetName: string; domain: string };
type Tenant = { tenantId: string; name: string; dependentComponentId: string; hourlySlaPenalty: number };
type Props = { assets: readonly Asset[]; tenants: readonly Tenant[]; ready: boolean };
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const button = 'rounded-lg bg-cbre-forest px-4 py-3 text-sm font-semibold text-white hover:bg-[#165943] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';
const secondary = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-cbre-forest hover:bg-emerald-50 disabled:opacity-50';
const storageKey = 'domino:what-if:assessment-ids';

export default function FailureAssessment({ assets, tenants, ready }: Props) {
  const { isActive, getConnection } = useSpacetimeDB();
  const [assessments, assessmentsReady] = useTable(tables.cascadeAssessment);
  const [edges, edgesReady] = useTable(tables.systemDependency);
  const [rules, rulesReady] = useTable(tables.dependencyRule);
  const [faults, faultsReady] = useTable(tables.activeFault);
  const [root, setRoot] = useState('MS-PUMP-1');
  const [minutes, setMinutes] = useState(60);
  const [runIds, setRunIds] = useState<string[]>(() => {
    try { return parseIds(sessionStorage.getItem(storageKey) ?? '[]'); } catch { return []; }
  });
  const [selected, setSelected] = useState(runIds[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmAction, setConfirmAction] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const lock = useRef(false);
  const run = assessments.find(row => row.assessmentId === selected);
  const runs = runIds.map(id => assessments.find(row => row.assessmentId === id)).filter(row => row !== undefined);
  const enabled = isActive && ready && assessmentsReady && edgesReady && rulesReady && faultsReady;
  const assetName = (id: string) => assets.find(asset => asset.componentId === id)?.assetName ?? id;
  const source = assets.find(asset => asset.componentId === run?.rootComponentId);
  const fault = faults.find(row => row.componentId === run?.rootComponentId && row.status === 'OPEN');
  const modeledAssets = assets.filter(asset => asset.componentId.startsWith('MS-'));
  let ids: string[] = [], tenantIds: string[] = [];
  let explanation: ReturnType<typeof explainAssessment> = { disrupted: [], protected: [] };
  let interpretationError = '';
  if (run) {
    try {
      if (!run.isSimulation) throw new Error('This record is not marked as a simulation.');
      ids = parseIds(run.predictedAtRiskJson);
      tenantIds = parseIds(run.affectedTenantIdsJson);
      if (ids.length !== run.predictedAtRiskCount || tenantIds.length !== run.affectedTenantCount) throw new Error('Assessment counts do not match its stored identifiers.');
      exposureForMinutes(run.hourlySlaExposure, minutes);
      explanation = explainAssessment(run.rootComponentId, ids, edges, rules);
    } catch (err) { interpretationError = err instanceof Error ? err.message : 'Unable to interpret assessment'; }
  }
  const affectedTenants = tenants.filter(tenant => tenantIds.includes(tenant.tenantId));
  const domains = [...new Set(assets.filter(asset => ids.includes(asset.componentId)).map(asset => asset.domain))];
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(runIds)); } catch { /* Assessment still persists in the database. */ }
  }, [runIds]);
  useEffect(() => {
    if (!selected || run) return;
    const timer = window.setTimeout(() => setNotice('Still waiting for the saved assessment subscription. Check the connection before trying another run.'), 15000);
    return () => window.clearTimeout(timer);
  }, [selected, run]);

  async function assess() {
    if (!enabled || lock.current || !modeledAssets.some(asset => asset.componentId === root)) return;
    const conn = getConnection() as DbConnection | null;
    if (!conn) return;
    lock.current = true; setBusy(true); setError(''); setNotice(''); setConfirmAction(false);
    const id = `WHATIF-${crypto.randomUUID()}`;
    setSelected(id); setRunIds(previous => [id, ...previous].slice(0, 12));
    try {
      await conn.reducers.analyzeCascade({ rootComponentId: root, assessmentId: id });
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'Assessment failed'}. Check saved results before retrying; a disconnected call may already have committed.`);
    } finally { lock.current = false; setBusy(false); }
  }

  async function startResponse() {
    if (!enabled || !run || interpretationError || fault || lock.current) return;
    const conn = getConnection() as DbConnection | null;
    if (!conn) return;
    lock.current = true; setActionPending(true); setError(''); setNotice('');
    try {
      // Stable reading ID links the response to this assessment and makes retries idempotent.
      await conn.reducers.ingestDemoTelemetry({ readingId: `RESPONSE-${run.assessmentId}`, componentId: run.rootComponentId, operational: 0 });
      setNotice('Simulated response submitted. Review “How to respond properly” below: acknowledge the linked incident, verify the condition, coordinate affected services, approve a response, and verify recovery before closure.');
      setConfirmAction(false);
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'Response failed'}. Check the incident list before retrying.`);
    } finally { lock.current = false; setActionPending(false); }
  }

  return <section id="what-if" className="mt-6 scroll-mt-8 overflow-hidden rounded-2xl border border-[#c0d4cb] bg-white shadow-sm">
    <div className="bg-cbre-forest p-6 text-white sm:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#c7e48c]"><FlaskConical size={17} /> Interactive scenario lab</div>
      <h2 className="mt-3 !text-3xl !text-white">What breaks if…?</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50">Choose one asset to take offline in a hypothetical assessment. Trace threatened services, quantify tenant exposure, and decide where to act.</p>
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-[#c0d4cb]"><span>01 Select an asset</span><ArrowRight size={14}/><span>02 Assess consequences</span><ArrowRight size={14}/><span>03 Plan a response</span></div>
    </div>
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-semibold text-slate-700">Assume this asset fails
          <select value={root} onChange={event => setRoot(event.target.value)} disabled={!enabled || busy || actionPending} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3 font-normal">
            {modeledAssets.map(asset => <option key={asset.componentId} value={asset.componentId}>{asset.assetName} · {asset.componentId}</option>)}
          </select>
        </label>
        <button onClick={assess} disabled={!enabled || busy || actionPending} className={button}>{busy ? <span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin"/>Assessing…</span> : 'Run failure assessment'}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">Try a contrast:
        {[['MS-CHILLER-1', 'Primary chiller / backup available'], ['MS-PUMP-1', 'Shared cooling pump'], ['MS-UPS-1', 'UPS / cross-system risk']].map(([id, label]) => <button className={secondary} key={id} disabled={!enabled || busy || actionPending} onClick={() => setRoot(id)}>{label}</button>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Each run saves a hypothetical assessment. Other sources are assumed available; this model does not forecast failure probability, timing, capacity, or existing concurrent faults.</p>
      {!enabled && <p role="status" className="mt-3 text-sm text-amber-800">Waiting for the database connection and scenario tables…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">{notice}</p>}
      {selected && !run && !error && <p role="status" className="mt-4 text-sm text-slate-600">Waiting for saved assessment {selected}…</p>}
      {interpretationError && <p role="alert" className="mt-4 text-red-800">{interpretationError}</p>}
      {run && !interpretationError && <div className="mt-7 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Saved hypothetical result</span><h3 className="mt-1 text-xl font-semibold text-cbre-deep">{assetName(run.rootComponentId)} unavailable</h3><p className="mt-1 break-all text-xs text-slate-500">{run.rootComponentId} · {new Date(run.timestamp).toLocaleString()} · {run.assessmentId}</p></div>
          <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{ids.length ? 'Downstream disruption predicted' : 'No downstream loss predicted'}</span>
        </div>
        {root !== run.rootComponentId && <p className="mt-3 text-sm text-amber-800">Selection changed. Run a new assessment to update these results.</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[['Downstream assets at risk', String(ids.length)], ['Tenants potentially affected', String(tenantIds.length)], ['Potential SLA exposure / hour', money(run.hourlySlaExposure)]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f1f6f2] p-4"><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-3xl font-semibold text-cbre-forest">{value}</p></div>)}
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4"><label htmlFor="outage-minutes" className="text-sm font-semibold">Explore interruption duration: {minutes} minutes</label><strong className="text-xl text-cbre-forest">{money(exposureForMinutes(run.hourlySlaExposure, minutes))} potential exposure</strong></div>
          <input id="outage-minutes" aria-label="Hypothetical outage duration in minutes" className="mt-4 w-full accent-emerald-800" type="range" min="15" max="240" step="15" value={minutes} onChange={event => setMinutes(Number(event.target.value))}/>
          <p className="mt-2 text-xs leading-5 text-slate-500">Illustrative linear estimate: {money(run.hourlySlaExposure)}/hour × {minutes}/60. Assumes every affected tenant's full rate applies throughout. Excludes grace periods, caps, temperature thresholds, repair cost, and revenue loss. Not an invoice or a savings claim.</p>
          {affectedTenants.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Tenant / dependent service</th><th>Hourly rate</th><th>At {minutes} min</th></tr></thead><tbody>{affectedTenants.map(tenant => <tr key={tenant.tenantId} className="border-b last:border-0"><td className="py-3">{tenant.name}<span className="block text-xs text-slate-500">{assetName(tenant.dependentComponentId)}</span></td><td>{money(tenant.hourlySlaPenalty)}</td><td>{money(exposureForMinutes(tenant.hourlySlaPenalty, minutes))}</td></tr>)}</tbody></table></div>}
          {tenantIds.length !== affectedTenants.length && <p className="mt-2 text-sm text-amber-800">Some tenant details are unavailable; the headline rate is the saved engine result.</p>}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5"><h3 className="flex items-center gap-2 font-semibold text-amber-950"><TriangleAlert size={18}/>Potential emerging disruptions</h3>
            <p className="mt-2 text-xs leading-5 text-slate-600">Conditional consequences if the selected failure occurs. {domains.length ? `Affected domains: ${domains.join(', ')}.` : 'No downstream domains are predicted to lose service.'}</p>
            <ul className="mt-4 space-y-3">{explanation.disrupted.map(group => <li className="rounded-lg bg-white p-3 text-sm" key={`${group.child}/${group.group}`}><strong>{assetName(group.child)}</strong><p className="mt-1 text-slate-600">{group.relationship.toLowerCase().replace(/_/g, ' ')} requirement loses all modeled sources: {group.sources.map(assetName).join(', ')}.</p><p className="mt-1 text-xs text-slate-400">{group.child}</p></li>)}</ul>
            {!ids.length && <p className="mt-4 text-sm text-slate-600">The selected asset still needs investigation. A zero downstream count does not prove physical service continuity.</p>}
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5"><h3 className="flex items-center gap-2 font-semibold text-cbre-forest"><ShieldCheck size={18}/>Modeled resilience</h3><p className="mt-2 text-xs leading-5 text-slate-600">Surviving alternatives in the current dependency graph; capacity and physical readiness still need verification.</p>
            <ul className="mt-4 space-y-3">{explanation.protected.map(group => <li key={`${group.child}/${group.group}`} className="rounded-lg bg-white p-3 text-sm"><strong>{assetName(group.child)}</strong><p className="mt-1 text-slate-600">Requirement retained through {group.survivingSources.map(assetName).join(', ')}.</p></li>)}</ul>
            {!explanation.protected.length && <p className="mt-4 text-sm text-slate-600">No surviving alternate path shields a directly threatened requirement in this result.</p>}
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-5"><h3 className="font-semibold text-cbre-deep">Turn insight into a response</h3><p className="mt-2 text-sm leading-6 text-slate-600">{responseGuidance(source?.domain ?? '', run.rootComponentId)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">A what-if assessment alone opens no incident. Starting a simulated response writes a synthetic unavailable reading and lets the backend create an incident, work order, and fresh cascade assessment. No equipment is actuated or external team notified.</p>
          {fault ? <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-white p-4 text-sm"><strong>Open response recorded for this asset</strong><p className="mt-1 break-all">Incident: {fault.incidentId}</p><p className="break-all">Work order: {fault.workOrderId}</p><a className="mt-2 inline-block font-semibold text-emerald-800 underline" href="#work-orders">Review work orders →</a></div> : !confirmAction ? <button disabled={!enabled || busy || actionPending} className={`${button} mt-4`} onClick={() => setConfirmAction(true)}>Start simulated response…</button> : <div className="mt-4 rounded-lg border border-amber-300 bg-white p-4"><p className="text-sm">Create a simulated fault response for <strong>{assetName(run.rootComponentId)}</strong> in the development campus?</p><div className="mt-3 flex flex-wrap gap-3"><button className={button} disabled={!enabled || busy || actionPending} onClick={startResponse}>{actionPending ? 'Submitting…' : 'Create simulated incident + work order'}</button><button className={secondary} disabled={actionPending} onClick={() => setConfirmAction(false)}>Cancel</button></div></div>}
          <ResponseGuide key={run.assessmentId} componentId={run.rootComponentId} assetName={assetName(run.rootComponentId)} domain={source?.domain ?? ''} affectedServices={ids.map(assetName)} affectedTenants={affectedTenants.map(tenant => tenant.name)} hourlyExposure={run.hourlySlaExposure} incidentId={fault?.incidentId} workOrderId={fault?.workOrderId} lastFaultAt={fault?.lastDetectedAt}/>
        </div>
      </div>}
      {runs.length > 0 && <div className="mt-6 border-t pt-5"><h3 className="font-semibold text-cbre-deep">Compare this session's assessments</h3><p className="mt-1 text-xs text-slate-500">Saved engine results; duration estimates use the current {minutes}-minute assumption. Explanations use the currently subscribed graph.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{runs.map(row => <button key={row.assessmentId} disabled={busy || actionPending} onClick={() => { setSelected(row.assessmentId); setRoot(row.rootComponentId); setConfirmAction(false); setError(''); setNotice(''); }} className={`rounded-lg border p-4 text-left ${selected === row.assessmentId ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white'}`}><strong className="text-sm">{assetName(row.rootComponentId)}</strong><p className="mt-1 text-xs text-slate-600">{row.predictedAtRiskCount} downstream assets · {row.affectedTenantCount} tenants · {money(row.hourlySlaExposure)}/hour</p><p className="mt-1 text-xs text-slate-500">{new Date(row.timestamp).toLocaleTimeString()}</p></button>)}</div></div>}
    </div>
  </section>;
}
