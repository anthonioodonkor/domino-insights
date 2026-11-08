import { useState } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from './module_bindings';
import { buildResponsePlan, nextResponseStep } from './responsePlan';

type Props = {
  componentId: string;
  assetName: string;
  domain: string;
  affectedServices: string[];
  affectedTenants: string[];
  hourlyExposure: number;
  incidentId?: string;
  workOrderId?: string;
  lastFaultAt?: number;
};

export default function ResponseGuide(props: Props) {
  const [responses, ready] = useTable(tables.incidentResponse);
  const [copyStatus, setCopyStatus] = useState('');
  const response = responses.find(row => row.incidentId === props.incidentId);
  const steps = buildResponsePlan(props);
  const next = props.incidentId && !ready ? 'Loading the recorded response state…' : nextResponseStep(props.incidentId, response?.state, response?.approvedAt, props.lastFaultAt);
  const rate = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(props.hourlyExposure);

  async function copyBrief() {
    const brief = [
      'DOMINO INSIGHTS — SIMULATED OPERATOR RESPONSE BRIEF',
      `Asset: ${props.assetName} (${props.componentId})`,
      `Incident: ${props.incidentId ?? 'Not yet created'}`,
      `Work order: ${props.workOrderId ?? 'Not yet created'}`,
      `Potential exposure: ${rate}/hour; fictional rates, not confirmed losses.`,
      `Next step: ${next}`,
      ...steps.map((step, index) => `\n${index + 1}. ${step.title}\nOwner: ${step.owner}\nAction: ${step.task}\nEvidence: ${step.evidence}`),
      '\nThis is a suggested coordination plan, not an executed action or equipment operating procedure. The application does not send notifications or dispatch staff.',
    ].join('\n');
    try { await navigator.clipboard.writeText(brief); setCopyStatus('Response brief copied. Share it through your approved team channel.'); }
    catch { setCopyStatus('Clipboard access was unavailable. You can select and copy the checklist below.'); }
  }

  return <div className="mt-5 border-t border-slate-200 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="font-semibold text-cbre-deep">How to respond properly</h4><p className="mt-1 text-xs text-slate-500">Suggested operator checklist · tailored to {props.assetName}</p></div>
      <button type="button" onClick={copyBrief} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-cbre-forest hover:bg-emerald-50">Copy response brief</button>
    </div>
    {copyStatus && <p role="status" className="mt-2 text-sm text-emerald-800">{copyStatus}</p>}
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Your next step</p><p className="mt-1 text-sm font-medium text-cbre-deep">{next}</p>{response && <p className="mt-2 text-xs text-slate-600">Recorded workflow state: {response.state.replace(/_/g, ' ')}{response.action ? ` · ${response.action.replace(/_/g, ' ')}` : ''}</p>}</div>
    <ol className="mt-4 space-y-3">
      {steps.map((step, index) => <li key={step.title} className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-800">{index + 1}</span><div><h5 className="text-sm font-semibold text-cbre-deep">{step.title}</h5><p className="mt-1 text-xs font-medium text-emerald-800">Suggested owner: {step.owner}</p></div></div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{step.task}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500"><strong>Evidence needed:</strong> {step.evidence}</p>
      </li>)}
    </ol>
    <p className="mt-3 text-xs leading-5 text-slate-500">This checklist is guidance, not a record that tasks were completed. This screen creates the simulated incident/work order; acknowledgement, approval, recovery submission, and closure currently use the existing backend workflow and are not buttons here. Suggested owners are not automatic assignments.</p>
  </div>;
}
