import type { IncidentEvent, TeamMember } from "../lib/types";
import { dateTime, label, shortIdentity } from "../lib/format";

export function IncidentTimeline({
  events,
  members,
}: {
  events: IncidentEvent[];
  members: TeamMember[];
}) {
  if (!events.length)
    return <p className="muted empty-inline">No workflow events yet.</p>;
  return (
    <ol className="timeline">
      {[...events]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((event) => (
          <li key={event.id}>
            <span className="timeline-point" />
            <div className="timeline-heading">
              <strong>{label(event.eventType)}</strong>
              <time dateTime={new Date(event.createdAt).toISOString()}>
                {dateTime(event.createdAt)}
              </time>
            </div>
            <p>{event.detail}</p>
            <span className="small muted">
              {members.find((m) => m.identity === event.actorIdentity)
                ?.displayName ?? shortIdentity(event.actorIdentity)}
            </span>
          </li>
        ))}
    </ol>
  );
}
