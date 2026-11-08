import type { ImpactInput, ImpactResult } from "../types";

/** Estimated disruption = people × hours × assumed hourly cost + response cost. */
export function estimateImpact(input: ImpactInput): ImpactResult {
  const keys: (keyof ImpactInput)[] = [
    "affectedPeople",
    "disruptionHours",
    "costPerPersonHour",
    "baselineResponseCost",
    "proposalHours",
    "proposalResponseCost",
  ];
  for (const key of keys) {
    if (!Number.isFinite(input[key]) || input[key] < 0) {
      throw new RangeError(key + " must be a finite, nonnegative number.");
    }
  }
  const baselineCost =
    input.affectedPeople * input.disruptionHours * input.costPerPersonHour +
    input.baselineResponseCost;
  const proposalCost =
    input.affectedPeople * input.proposalHours * input.costPerPersonHour +
    input.proposalResponseCost;
  const estimatedSavings = baselineCost - proposalCost;
  if (![baselineCost, proposalCost, estimatedSavings].every(Number.isFinite)) {
    throw new RangeError("Impact arithmetic exceeds the finite numeric range.");
  }
  return {
    baselineCost,
    proposalCost,
    estimatedSavings,
    assumptions: [
      "Synthetic simulated estimates in USD; assumptions are illustrative, not measured losses or savings.",
      "Affected people: " +
        input.affectedPeople +
        "; assumed cost per person-hour: $" +
        input.costPerPersonHour +
        ".",
      "Baseline: " +
        input.affectedPeople +
        " people × " +
        input.disruptionHours +
        " disruption hours × $" +
        input.costPerPersonHour +
        " + $" +
        input.baselineResponseCost +
        " response cost = $" +
        baselineCost +
        ".",
      "Proposed response: " +
        input.affectedPeople +
        " people × " +
        input.proposalHours +
        " disruption hours × $" +
        input.costPerPersonHour +
        " + $" +
        input.proposalResponseCost +
        " response cost = $" +
        proposalCost +
        ".",
      "Estimated savings = baseline cost minus proposed-response cost = $" +
        estimatedSavings +
        ".",
    ],
  };
}
