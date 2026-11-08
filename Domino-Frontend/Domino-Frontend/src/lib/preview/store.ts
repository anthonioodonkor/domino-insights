import type { DominoActions, Portfolio } from "../types";
import { createDemoFixture, createFailureReadings, DEFAULT_IMPACT } from "./fixtures";
import { estimateImpact } from "./impact";

// Browser-only fixtures for UI development. No server, persistence, or authentication.
export function createPreviewStore() {
  const identity = "preview-manager";
  const initial = (): Portfolio => ({
    ...createDemoFixture(), incidents: [], events: [], proposals: [],
    members: [
      { identity, displayName: "Preview manager", role: "manager" },
      { identity: "preview-engineer", displayName: "Preview engineer", role: "engineer" },
    ],
  });
  let portfolio = initial();
  let sequence = 0;
  const listeners = new Set<() => void>();
  const id = (prefix: string) => `${prefix}-${++sequence}`;
  const change = async (operation: (draft: Portfolio) => void) => {
    const draft = structuredClone(portfolio);
    operation(draft);
    portfolio = draft;
    listeners.forEach(listener => listener());
  };
  const incident = (draft: Portfolio, incidentId: string) => {
    const row = draft.incidents.find(item => item.id === incidentId);
    if (!row) throw new Error("This preview incident no longer exists.");
    return row;
  };
  const editable = (draft: Portfolio, incidentId: string) => {
    const row = incident(draft, incidentId);
    if (["resolved", "mitigating"].includes(row.status)) throw new Error("This response is already approved or resolved.");
    return row;
  };
  const event = (draft: Portfolio, incidentId: string, eventType: string, detail: string) => {
    const time = Date.now();
    incident(draft, incidentId).updatedAt = time;
    draft.events.push({ id: id("event"), incidentId, actorIdentity: identity, eventType, detail, createdAt: time });
  };
  const proposal = (draft: Portfolio, proposalId: string) => {
    const row = draft.proposals.find(item => item.id === proposalId);
    if (!row || row.status !== "proposed") throw new Error("Choose a pending preview proposal.");
    editable(draft, row.incidentId);
    return row;
  };
  const title = (value: string, max: number) => {
    if (!value.trim() || value.trim().length > max) throw new Error(`Enter 1–${max} characters.`);
    return value.trim();
  };
  const actions: DominoActions = {
    register: name => change(draft => { draft.members[0].displayName = title(name, 60); }),
    seedDemo: () => change(draft => {
      if (draft.buildings.length) throw new Error("Preview data already exists. Use Reset demo.");
      Object.assign(draft, initial());
    }),
    resetDemo: () => change(draft => { Object.assign(draft, initial()); }),
    injectScenario: () => change(draft => {
      if (draft.incidents.some(row => row.assetId === "CH-02")) return;
      draft.readings.push(...createFailureReadings());
      const target = draft.assets.find(asset => asset.id === "CH-02")!;
      target.status = "critical";
      const incidentId = id("incident");
      draft.incidents.push({
        id: incidentId, assetId: target.id, riskScore: 100, severity: "critical", status: "open",
        estimatedImpact: 71400, dataQuality: "sufficient", assignedTo: "",
        createdAt: Date.now(), updatedAt: Date.now(), assumptions: { ...DEFAULT_IMPACT },
        evidence: [
          { source: "telemetry", label: "Low equipment output", detail: "Sample output is 54%, below the illustrative 70% threshold.", points: 35 },
          { source: "telemetry", label: "Rising zone temperature", detail: "Sample temperature rises to 28.1°C in the scripted chiller scenario.", points: 30 },
          { source: "maintenance", label: "Unresolved maintenance", detail: "Sample work order WO-CH02-001 awaits inspection.", points: 20 },
          { source: "occupancy", label: "High zone occupancy", detail: "Sample occupancy is 180 people in a zone with capacity 200.", points: 15 },
        ],
      });
      event(draft, incidentId, "incident_detected", "Loaded a scripted preview incident. No live risk evaluation was performed.");
    }),
    acknowledgeIncident: incidentId => change(draft => {
      const row = editable(draft, incidentId);
      if (row.status === "acknowledged") throw new Error("Already acknowledged.");
      row.status = "acknowledged";
      event(draft, incidentId, "acknowledged", "Preview incident acknowledged.");
    }),
    assignIncident: (incidentId, assigneeIdentity) => change(draft => {
      const row = incident(draft, incidentId);
      if (row.status === "resolved") throw new Error("This preview incident is resolved.");
      const member = draft.members.find(item => item.identity === assigneeIdentity);
      if (!member) throw new Error("Choose a preview operator.");
      row.assignedTo = assigneeIdentity;
      event(draft, incidentId, "assigned", `Assigned to ${member.displayName}.`);
    }),
    proposeAction: (incidentId, name, proposalHours, estimatedCost) => change(draft => {
      const row = editable(draft, incidentId);
      const impact = estimateImpact({ ...row.assumptions, proposalHours, proposalResponseCost: estimatedCost });
      draft.proposals.push({ id: id("proposal"), incidentId, name: title(name, 160), proposalHours,
        estimatedCost, impact, status: "proposed", createdBy: identity, createdAt: Date.now(), revision: 0 });
      event(draft, incidentId, "action_proposed", `Preview response proposed: ${name}.`);
    }),
    approveAction: (proposalId, expectedRevision) => change(draft => {
      const selected = proposal(draft, proposalId);
      if (selected.revision !== expectedRevision) throw new Error("Estimates changed. Review the latest proposal.");
      const row = incident(draft, selected.incidentId);
      draft.proposals.filter(item => item.incidentId === row.id && item.status === "proposed")
        .forEach(item => { item.status = item.id === proposalId ? "approved" : "rejected"; });
      row.status = "mitigating";
      row.assumptions.proposalHours = selected.proposalHours;
      row.assumptions.proposalResponseCost = selected.estimatedCost;
      draft.assets.find(asset => asset.id === row.assetId)!.status = "mitigating";
      event(draft, row.id, "action_approved", `Preview approved: ${selected.name}. This does not authorize a real operation.`);
    }),
    rejectAction: proposalId => change(draft => {
      const selected = proposal(draft, proposalId);
      selected.status = "rejected";
      event(draft, selected.incidentId, "action_rejected", `Preview response rejected: ${selected.name}.`);
    }),
    resolveIncident: incidentId => change(draft => {
      const row = incident(draft, incidentId);
      if (row.status !== "mitigating") throw new Error("Approve a preview response before resolving it.");
      row.status = "resolved";
      draft.assets.find(asset => asset.id === row.assetId)!.status = "simulated_restored";
      event(draft, incidentId, "resolved", "Preview simulation marked complete.");
    }),
    updateAssumptions: (incidentId, assumptions) => change(draft => {
      const row = editable(draft, incidentId);
      row.estimatedImpact = estimateImpact(assumptions).baselineCost;
      row.assumptions = { ...assumptions };
      draft.proposals.filter(item => item.incidentId === incidentId && item.status === "proposed").forEach(item => {
        item.impact = estimateImpact({ ...assumptions, proposalHours: item.proposalHours, proposalResponseCost: item.estimatedCost });
        item.revision++;
      });
      event(draft, incidentId, "assumptions_updated", "Preview cost estimates updated locally.");
    }),
  };
  return {
    identity, actions,
    getSnapshot: () => portfolio,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
