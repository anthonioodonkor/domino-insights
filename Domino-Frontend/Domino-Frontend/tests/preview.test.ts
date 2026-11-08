import { describe, expect, it } from "vitest";
import { createPreviewStore } from "../src/lib/preview/store";

describe("standalone frontend preview", () => {
  it("keeps separate tabs independent and restores fixtures on reset", async () => {
    const first = createPreviewStore();
    const second = createPreviewStore();
    await first.actions.injectScenario();
    await first.actions.injectScenario();
    expect(first.getSnapshot().incidents).toHaveLength(1);
    expect(second.getSnapshot().incidents).toHaveLength(0);
    await first.actions.resetDemo();
    expect(first.getSnapshot().incidents).toHaveLength(0);
    expect(first.getSnapshot().assets).toHaveLength(8);
    expect(first.getSnapshot().proposals).toHaveLength(0);
  });

  it("supports the existing response screens without server calls", async () => {
    const store = createPreviewStore();
    await store.actions.injectScenario();
    const incident = store.getSnapshot().incidents[0];
    await expect(store.actions.resolveIncident(incident.id)).rejects.toThrow();
    await store.actions.acknowledgeIncident(incident.id);
    await store.actions.assignIncident(incident.id, "preview-engineer");
    await store.actions.proposeAction(incident.id, "Temporary cooling", 1.5, 4500);
    const proposal = store.getSnapshot().proposals[0];
    expect(proposal.impact.estimatedSavings).toBe(49350);
    await store.actions.approveAction(proposal.id, proposal.revision);
    await expect(store.actions.updateAssumptions(incident.id, incident.assumptions)).rejects.toThrow();
    await store.actions.resolveIncident(incident.id);
    expect(store.getSnapshot().incidents[0].status).toBe("resolved");
    expect(store.getSnapshot().assets.find(asset => asset.id === "CH-02")?.status).toBe("simulated_restored");
  });

  it("does not commit invalid edits and rejects outdated proposal reviews", async () => {
    const store = createPreviewStore();
    await store.actions.injectScenario();
    const row = store.getSnapshot().incidents[0];
    const before = store.getSnapshot();
    await expect(store.actions.proposeAction(row.id, "Invalid estimate", -1, 100)).rejects.toThrow();
    expect(store.getSnapshot()).toBe(before);
    await store.actions.proposeAction(row.id, "Cooling", 1.5, 4500);
    const old = store.getSnapshot().proposals[0];
    await store.actions.updateAssumptions(row.id, { ...row.assumptions, disruptionHours: 8 });
    await expect(store.actions.approveAction(old.id, old.revision)).rejects.toThrow("Estimates changed");
    expect(store.getSnapshot().proposals[0].status).toBe("proposed");
    await store.actions.rejectAction(old.id);
    expect(store.getSnapshot().proposals[0].status).toBe("rejected");
  });
});
