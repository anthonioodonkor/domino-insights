import { ArrowDownRight } from "lucide-react";
import type { ImpactResult } from "../lib/types";
import { money } from "../lib/format";

export function ImpactComparison({ impact }: { impact: ImpactResult }) {
  const max = Math.max(impact.baselineCost, impact.proposalCost, 1);
  return (
    <div className="impact-comparison">
      <div className="comparison-row">
        <div>
          <span>Baseline disruption</span>
          <strong>{money(impact.baselineCost)}</strong>
        </div>
        <div className="comparison-track">
          <span style={{ width: `${(impact.baselineCost / max) * 100}%` }} />
        </div>
      </div>
      <div className="comparison-row response">
        <div>
          <span>With proposed response</span>
          <strong>{money(impact.proposalCost)}</strong>
        </div>
        <div className="comparison-track">
          <span style={{ width: `${(impact.proposalCost / max) * 100}%` }} />
        </div>
      </div>
      <div className="savings">
        <ArrowDownRight size={22} />
        <div>
          <span>Estimated avoided cost</span>
          <strong>{money(impact.estimatedSavings)}</strong>
        </div>
      </div>
      <p className="small muted">
        Simulated estimates, not realized savings. Based on occupancy,
        disruption duration, and response costs.
      </p>
      {impact.assumptions.length > 0 && (
        <details>
          <summary>Calculation assumptions</summary>
          <ul className="assumption-list">
            {impact.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
