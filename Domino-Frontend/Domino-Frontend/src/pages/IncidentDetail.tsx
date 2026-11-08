import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowLeft,
  Clock3,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import type { DominoState, ImpactInput, Incident } from "../lib/types";
import type { Navigate } from "./Overview";
import { dateTime, money, shortIdentity } from "../lib/format";
import {
  ActionButton,
  Badge,
  Button,
  CommandFeedback,
  EmptyState,
  SectionTitle,
  useCommand,
} from "../components/ui";
import { ImpactComparison } from "../components/ImpactComparison";
import { IncidentTimeline } from "../components/IncidentTimeline";
import { IncidentProgress } from "../components/IncidentProgress";
import { SensorTrendChart } from "../components/SensorTrendChart";

function AssumptionsForm({
  incident,
  state,
  disabled,
}: {
  incident: Incident;
  state: DominoState;
  disabled: boolean;
}) {
  const shared = JSON.stringify(incident.assumptions);
  const [base, setBase] = useState(shared);
  const [values, setValues] = useState<Record<keyof ImpactInput, string>>(
    () =>
      Object.fromEntries(
        Object.entries(incident.assumptions).map(([key, value]) => [
          key,
          String(value),
        ]),
      ) as Record<keyof ImpactInput, string>,
  );
  const command = useCommand();
  const baseline = JSON.parse(base) as ImpactInput;
  const dirty = (Object.keys(values) as (keyof ImpactInput)[]).some(
    (key) => values[key] !== String(baseline[key]),
  );
  const conflict = shared !== base && dirty;
  useEffect(() => {
    if (!dirty && base !== shared) {
      setValues(
        Object.fromEntries(
          Object.entries(JSON.parse(shared)).map(([key, value]) => [
            key,
            String(value),
          ]),
        ) as Record<keyof ImpactInput, string>,
      );
      setBase(shared);
    }
  }, [shared, base, dirty]);
  const reload = () => {
    setValues(
      Object.fromEntries(
        Object.entries(incident.assumptions).map(([key, value]) => [
          key,
          String(value),
        ]),
      ) as Record<keyof ImpactInput, string>,
    );
    setBase(shared);
  };
  const fields: { key: keyof ImpactInput; title: string; unit: string }[] = [
    { key: "affectedPeople", title: "Affected people", unit: "people" },
    { key: "disruptionHours", title: "Baseline disruption", unit: "hours" },
    { key: "costPerPersonHour", title: "Cost per person / hour", unit: "USD" },
    {
      key: "baselineResponseCost",
      title: "Baseline response cost",
      unit: "USD",
    },
    {
      key: "proposalHours",
      title: "Default response disruption",
      unit: "hours",
    },
    {
      key: "proposalResponseCost",
      title: "Default response cost",
      unit: "USD",
    },
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (conflict || disabled) return;
        const numeric = Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, Number(value)]),
        ) as unknown as ImpactInput;
        void command.run(async () => {
          await state.actions.updateAssumptions(incident.id, numeric);
          setBase(JSON.stringify(numeric));
        }, "Assumptions updated.");
      }}
    >
      {conflict && (
        <div className="quality-warning" role="alert">
          Another operator changed these assumptions. Your draft is preserved.
          Load the shared values before editing and saving again.{" "}
          <Button variant="secondary" onClick={reload}>
            Load shared assumptions
          </Button>
        </div>
      )}
      <div className="assumption-fields">
        {fields.map(({ key, title, unit }) => (
          <label className="field" key={key}>
            {title}
            <div className="input-unit">
              <input
                type="number"
                min="0"
                step={key === "affectedPeople" ? "1" : "any"}
                required
                value={values[key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [key]: e.target.value }))
                }
                disabled={disabled || command.pending}
              />
              <span>{unit}</span>
            </div>
          </label>
        ))}
      </div>
      <Button
        variant="secondary"
        disabled={disabled || conflict || command.pending}
        type="submit"
      >
        {command.pending ? "Saving…" : "Save assumptions"}
      </Button>
      <CommandFeedback error={command.error} success={command.success} />
    </form>
  );
}

export function IncidentDetail({
  state,
  id,
  navigate,
}: {
  state: DominoState;
  id: string;
  navigate: Navigate;
}) {
  const p = state.portfolio;
  const incident = p.incidents.find((i) => i.id === id);
  const [tab, setTab] = useState<"overview" | "telemetry" | "response">("overview");
  const showResponses = () => {
    setTab("response");
    requestAnimationFrame(() => {
      const section = document.getElementById("response-proposals");
      section?.scrollIntoView({ behavior: "instant", block: "start" });
      section?.focus({ preventScroll: true });
    });
  };
  const [assignee, setAssignee] = useState("");
  const [proposalName, setProposalName] = useState(
    "Dispatch inspection and temporary cooling",
  );
  const [hours, setHours] = useState("1.5");
  const [cost, setCost] = useState("4500");
  const assign = useCommand();
  const propose = useCommand();
  if (!incident)
    return (
      <EmptyState title="Incident unavailable">
        This incident may have been removed by a demo reset.{" "}
        <button className="text-link" onClick={() => navigate("overview")}>
          Return to overview
        </button>
      </EmptyState>
    );
  const asset = p.assets.find((a) => a.id === incident.assetId);
  const building = p.buildings.find((b) => b.id === asset?.buildingId);
  const zone = p.zones.find((z) => z.id === asset?.zoneId);
  const proposals = p.proposals
    .filter((a) => a.incidentId === id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const manager = state.member?.role === "manager";
  const enabled = (state.connectionStatus === "live" || state.connectionStatus === "preview") && !!state.member;
  const closed = incident.status === "resolved";
  const editable = !closed && incident.status !== "mitigating";
  const assigned = p.members.find((m) => m.identity === incident.assignedTo);
  const handleProposal = (e: FormEvent) => {
    e.preventDefault();
    void propose.run(
      () =>
        state.actions.proposeAction(
          id,
          proposalName,
          Number(hours),
          Number(cost),
        ),
      "Proposal submitted for manager review.",
    );
  };
  return (
    <>
      <button
        className="back-link"
        onClick={() =>
          building ? navigate("building", building.id) : navigate("overview")
        }
      >
        <ArrowLeft size={15} />
        {building?.name ?? "Portfolio overview"}
      </button>
      <div className="page-heading incident-heading">
        <div>
          <h1>
            {asset?.name ?? incident.assetId} <span>Operational risk</span>
          </h1>
          <p>
            {building?.name} <span className="separator">/</span> {zone?.name}{" "}
            <span className="separator">/</span> Opened{" "}
            {dateTime(incident.createdAt)}
          </p>
        </div>
        <div className="heading-badges">
          <Badge value={incident.severity} />
          <Badge value={incident.status} />
        </div>
      </div>
      <div className="incident-strip">
        <div className={`incident-score risk-${incident.severity}`}>
          <strong>
            {incident.riskScore}
            <span>/100</span>
          </strong>
          <span>Rules-based risk score</span>
        </div>
        <div>
          <span className="strip-label">Estimated baseline exposure</span>
          <strong>{money(incident.estimatedImpact)}</strong>
          <span className="small muted">Illustrative disruption estimate</span>
        </div>
        <div>
          <span className="strip-label">Assigned operator</span>
          <strong className="assignee-name">
            {assigned?.displayName ??
              (incident.assignedTo
                ? shortIdentity(incident.assignedTo)
                : "Unassigned")}
          </strong>
          <span className="small muted">
            {assigned?.role ?? "Awaiting assignment"}
          </span>
        </div>
      </div>
      <IncidentProgress state={state} incident={incident} onShowResponses={showResponses} />
      <div className="incident-tabs" role="tablist" aria-label="Incident details">
        {(["overview", "telemetry", "response"] as const).map((name, index, tabs) => (
          <button key={name} type="button" role="tab" id={"tab-" + name} aria-controls={"panel-" + name} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)} onKeyDown={event => {
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault(); setTab(tabs[next]); document.getElementById("tab-" + tabs[next])?.focus();
            }}>{name === "overview" ? "Overview" : name === "telemetry" ? "Telemetry" : "Response"}{name === "response" && proposals.some(p => p.status === "proposed") && <span className="tab-count">{proposals.filter(p => p.status === "proposed").length}<span className="sr-only"> pending proposals</span></span>}</button>
        ))}
      </div>
      <div className={`incident-columns ${tab === "telemetry" ? "telemetry-layout" : ""}`}>
        <div className="incident-main">
          <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={tab !== "overview"} tabIndex={0}>
          <section className="panel">
            <SectionTitle
              title="Why this needs attention"
              description="Transparent signals behind this risk score"
            >
              <Badge
                value={
                  incident.dataQuality === "sufficient"
                    ? "sufficient"
                    : "insufficient"
                }
              />
            </SectionTitle>
            {incident.dataQuality === "insufficient" && (
              <div className="quality-warning">
                Some required telemetry is missing or stale. This score is
                incomplete and should not be treated as a confident assessment.
              </div>
            )}
            <div className="evidence-list">
              {incident.evidence.map((e, index) => {
                const Icon =
                  e.source === "telemetry"
                    ? Activity
                    : e.source === "maintenance"
                      ? Wrench
                      : Users;
                return (
                  <div className="evidence-item" key={`${e.source}-${index}`}>
                    <span className="evidence-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <h3>{e.label}</h3>
                      <p>{e.detail}</p>
                      <span className="small muted">{e.source}</span>
                    </div>
                    <strong>
                      +{e.points}
                      <span>points</span>
                    </strong>
                  </div>
                );
              })}
            </div>
            <p className="method-note">
              Deterministic demonstration rules · illustrative weights · not a
              calibrated failure probability
            </p>
          </section>
          </div>
          <div role="tabpanel" id="panel-telemetry" aria-labelledby="tab-telemetry" hidden={tab !== "telemetry"} tabIndex={0}>
          <section className="panel">
            <SectionTitle
              title="Telemetry evidence"
              description={`${asset?.name ?? incident.assetId} · synthetic sensor history`}
            />
            {tab === "telemetry" && <SensorTrendChart
              readings={p.readings.filter(
                (r) => r.assetId === incident.assetId,
              )}
            />}
          </section>
          </div>
          <div role="tabpanel" id="panel-response" aria-labelledby="tab-response" hidden={tab !== "response"} tabIndex={0}>
          <section className="panel" id="response-proposals" tabIndex={-1}>
            <SectionTitle
              title="Response proposals"
              description="Compare simulated options. A manager reviews every approval."
            />
            {proposals.length ? (
              <div className="proposal-list">
                {proposals.map((proposal) => (
                  <article
                    className={`proposal proposal-${proposal.status}`}
                    key={proposal.id}
                  >
                    <div className="proposal-heading">
                      <div>
                        <h3>{proposal.name}</h3>
                        <p className="small muted">
                          {p.members.find(
                            (m) => m.identity === proposal.createdBy,
                          )?.displayName ??
                            shortIdentity(proposal.createdBy)}{" "}
                          · {dateTime(proposal.createdAt)}
                        </p>
                      </div>
                      <Badge value={proposal.status} />
                    </div>
                    <div className="proposal-meta">
                      <span>
                        <Clock3 size={14} />
                        {proposal.proposalHours}h modeled disruption
                      </span>
                      <span>
                        {money(proposal.estimatedCost)} estimated response cost
                      </span>
                    </div>
                    <ImpactComparison impact={proposal.impact} />
                    {proposal.status === "proposed" && !closed && (
                      <div className="proposal-actions">
                        {manager ? (
                          <>
                            <ActionButton
                              variant="primary"
                              action={() =>
                                state.actions.approveAction(
                                  proposal.id,
                                  proposal.revision,
                                )
                              }
                              disabled={!enabled}
                            >
                              Approve simulated response
                            </ActionButton>
                            <ActionButton
                              variant="ghost"
                              action={() =>
                                state.actions.rejectAction(proposal.id)
                              }
                              disabled={!enabled}
                            >
                              Reject
                            </ActionButton>
                          </>
                        ) : (
                          <p className="review-note">
                            <ShieldCheck size={15} />
                            Awaiting manager approval
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-inline muted">
                No response proposed yet. Add a plan for human review.
              </div>
            )}
            {editable && (
              <form className="proposal-form" onSubmit={handleProposal}>
                <h3>Propose a response</h3>
                <label className="field">
                  Response plan
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={proposalName}
                    onChange={(e) => setProposalName(e.target.value)}
                    disabled={!enabled || propose.pending}
                  />
                </label>
                <div className="form-two-col">
                  <label className="field">
                    Expected disruption (hours)
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      disabled={!enabled || propose.pending}
                    />
                  </label>
                  <label className="field">
                    Estimated response cost (USD)
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      disabled={!enabled || propose.pending}
                    />
                  </label>
                </div>
                <Button type="submit" disabled={!enabled || propose.pending}>
                  {propose.pending ? "Submitting…" : "Submit for review"}
                </Button>
                <CommandFeedback
                  error={propose.error}
                  success={propose.success}
                />
                <p className="small muted">
                  A proposal records a simulated plan. Approval does not control
                  building equipment.
                </p>
              </form>
            )}
          </section>
          <details className="panel assumptions-disclosure">
            <summary><span><strong>Impact assumptions</strong><span className="small muted">Review or edit the inputs behind the estimate</span></span><span className="disclosure-chevron" aria-hidden="true">+</span></summary>
            <AssumptionsForm
              key={incident.id}
              incident={incident}
              state={state}
              disabled={!enabled || !editable}
            />
            {!editable && (
              <p className="method-note">
                Assumptions are locked after approval to preserve the reviewed
                response.
              </p>
            )}
          </details>
          </div>
        </div>
        <aside className="incident-sidebar" hidden={tab === "telemetry"}>
          <section className="panel">
            <SectionTitle title="Response ownership" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void assign.run(() =>
                  state.actions.assignIncident(
                    id,
                    assignee || incident.assignedTo,
                  ),
                );
              }}
            >
              <label className="field">
                Assigned operator
                <select
                  value={assignee || incident.assignedTo}
                  onChange={(e) => setAssignee(e.target.value)}
                  required
                  disabled={!enabled || closed || assign.pending}
                >
                  <option value="">Choose an operator</option>
                  {p.members.map((m) => (
                    <option value={m.identity} key={m.identity}>
                      {m.displayName} ({m.role})
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="submit"
                variant="secondary"
                disabled={
                  !enabled ||
                  closed ||
                  assign.pending ||
                  !(assignee || incident.assignedTo)
                }
              >
                {assign.pending ? "Assigning…" : "Update assignment"}
              </Button>
              <CommandFeedback error={assign.error} success={assign.success} />
            </form>
          </section>
          <section className="panel timeline-panel" hidden={tab !== "overview"}>
            <SectionTitle
              title="Activity timeline"
              description={state.connectionStatus === "preview" ? "Local preview activity" : "Shared, attributable workflow history"}
            />
            <IncidentTimeline
              events={p.events.filter((e) => e.incidentId === id)}
              members={p.members}
            />
          </section>
          <div className="simulation-note">
            <ShieldCheck size={19} />
            <div>
              <strong>Human decisions. Shared context.</strong>
              <p>
                Severity describes the risk. Lifecycle tracks the response. All
                actions are synthetic. Preview activity is kept in this browser tab.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
