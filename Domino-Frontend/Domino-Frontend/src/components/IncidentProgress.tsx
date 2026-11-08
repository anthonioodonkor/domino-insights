import { ArrowRight, Check, ClipboardCheck, ShieldCheck } from "lucide-react";
import type { DominoState, Incident } from "../lib/types";
import { ActionButton, Badge, Button } from "./ui";

export function IncidentProgress({ state, incident, onShowResponses }: { state: DominoState; incident: Incident; onShowResponses: () => void }) {
  const proposals = state.portfolio.proposals.filter(p => p.incidentId === incident.id);
  const pending = proposals.some(p => p.status === "proposed");
  const approved = proposals.some(p => p.status === "approved");
  const resolved = incident.status === "resolved";
  const acknowledged = incident.status === "acknowledged" || state.portfolio.events.some(
    e => e.incidentId === incident.id && e.eventType === "acknowledged",
  );
  const stage = resolved ? 4 : approved || incident.status === "mitigating" ? 3 : pending ? 2 : acknowledged ? 1 : 0;
  const steps = [
    { label: "Detected", reached: true },
    { label: "Acknowledged", reached: acknowledged },
    { label: "Response proposed", reached: proposals.length > 0 },
    { label: "Approved", reached: approved },
    { label: "Resolved", reached: resolved },
  ];
  const live = state.connectionStatus === "live" || state.connectionStatus === "preview";
  const enabled = live && !!state.member;
  const manager = state.member?.role === "manager";
  const title = !live ? "Reconnect to continue" : !state.member ? "Register to participate" : resolved ? "Response complete" : stage === 3 ? "Confirm the simulated response is complete" : pending ? manager ? "Review the proposed response" : "Waiting for manager approval" : acknowledged ? proposals.length ? "Revise the response plan" : "Propose a response" : "Acknowledge this incident";
  const description = !live ? "Progress reflects the last received update. Actions resume when live sync reconnects." : !state.member ? "Enter your display name in the registration panel above to join the response." : resolved ? "This simulation is resolved. You can still review its evidence and activity history below." : stage === 3 ? "An approved plan is in place. Mark the simulation resolved when your team has completed the response." : pending ? manager ? "Compare the costs and disruption estimates below, then approve or reject a proposal." : "Your team has submitted a plan. A manager must review it before the response can proceed." : acknowledged ? "Describe the response, expected disruption, and estimated cost. A manager will review your proposal." : "Review the risk evidence, then acknowledge that the team has seen this incident.";
  return (
    <>
    <section className="incident-progress" aria-labelledby="response-progress-title">
      <div className="progress-heading"><h2 id="response-progress-title">Response progress</h2><span>Human-reviewed workflow</span></div>
      <ol className="progress-steps" aria-label="Incident response stages">
        {steps.map((step, index) => (
          <li key={step.label} className={`${index === stage ? "is-current" : ""} ${step.reached ? "is-reached" : ""}`} aria-current={index === stage ? "step" : undefined}>
            <span className="step-marker" aria-hidden="true">{step.reached && index < stage ? <Check size={16} /> : index + 1}</span>
            <span>{step.label}<small>{index === stage ? resolved ? "Complete" : "Current stage" : step.reached ? "Recorded" : index < stage ? "Not recorded" : "Upcoming"}</small></span>
          </li>
        ))}
      </ol>
    </section>
      <div className={`next-step sticky-next-step ${resolved ? "next-step-complete" : ""}`}>
        <div aria-live="polite"><div className="next-step-status"><span className="next-step-eyebrow">{resolved ? "Outcome" : "Your next step"}</span><Badge value={incident.status} /></div><h3>{title}</h3><p>{description}</p></div>
        {enabled && !resolved && (stage === 3 ? (
          <ActionButton variant="primary" action={() => state.actions.resolveIncident(incident.id)}><Check size={17} />Resolve simulation</ActionButton>
        ) : pending || acknowledged ? (
          <Button variant={pending && !manager ? "secondary" : "primary"} onClick={onShowResponses}>{pending ? manager ? "Review proposals" : "View submitted plan" : "Prepare response"}<ArrowRight size={17} /></Button>
        ) : (
          <ActionButton variant="primary" action={() => state.actions.acknowledgeIncident(incident.id)}><ClipboardCheck size={17} />Acknowledge incident</ActionButton>
        ))}
        {resolved && <ShieldCheck className="completion-icon" size={28} aria-hidden="true" />}
      </div>
    </>
  );
}
