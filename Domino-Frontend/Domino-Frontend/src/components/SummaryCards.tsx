import { Activity, Building2, CircleAlert, Users } from "lucide-react";
import type { Portfolio } from "../lib/types";
import { money, number } from "../lib/format";

export type SummaryDestination = "buildings" | "incidents" | "exposure" | "occupancy";
export function SummaryCards({ portfolio, onSelect }: { portfolio: Portfolio; onSelect: (destination: SummaryDestination) => void }) {
  const active = portfolio.incidents.filter((i) => i.status !== "resolved");
  const latest = new Map<string, (typeof portfolio.occupancy)[number]>();
  portfolio.occupancy.forEach((o) => {
    if (
      !latest.has(o.zoneId) ||
      latest.get(o.zoneId)!.recordedAt < o.recordedAt
    )
      latest.set(o.zoneId, o);
  });
  const metrics = [
    {
      title: "Connected buildings",
      destination: "buildings" as const,
      value: number(portfolio.buildings.length),
      detail: `${portfolio.assets.length} monitored assets`,
      icon: Building2,
      tone: "teal",
    },
    {
      title: "Active incidents",
      destination: "incidents" as const,
      value: number(active.length),
      detail: `${active.filter((i) => i.severity === "critical").length} require urgent attention`,
      icon: CircleAlert,
      tone: active.some((i) => i.severity === "critical") ? "coral" : active.length ? "amber" : "green",
    },
    {
      title: "Estimated exposure",
      destination: "exposure" as const,
      value: money(active.reduce((sum, i) => sum + i.estimatedImpact, 0)),
      detail: "Modeled baseline disruption cost",
      icon: Activity,
      tone: "amber",
    },
    {
      title: "Current occupancy",
      destination: "occupancy" as const,
      value: number([...latest.values()].reduce((sum, o) => sum + o.people, 0)),
      detail: "People across monitored zones",
      icon: Users,
      tone: "green",
    },
  ];
  return (
    <div className="summary-grid">
      {metrics.map(({ title, value, detail, icon: Icon, tone, destination }) => (
        <button type="button" className={`summary-card summary-${tone}`} key={title} onClick={() => onSelect(destination)} aria-label={`Explore ${title.toLowerCase()}`}>
          <div className="summary-label">
            {title}
            <span className="summary-icon"><Icon size={20} /></span>
          </div>
          <strong>{value}</strong>
          <span>{detail}</span>
          <span className="summary-link">Explore details →</span>
        </button>
      ))}
    </div>
  );
}
