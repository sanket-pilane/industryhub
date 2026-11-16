import { StatusBadge } from "./status-badge";

export type TimelineEntry = {
  id: string | number;
  status: string;
  at: string;
  by?: string;
  comment?: string;
};

const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Vertical status history, oldest first. */
export function Timeline({
  entries,
  label = "Status history",
}: {
  entries: TimelineEntry[];
  label?: string;
}) {
  if (entries.length === 0) return <p className="muted">No history yet.</p>;
  return (
    <ol className="timeline" aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <div className="timeline-head">
            <StatusBadge status={entry.status} />
            <time dateTime={entry.at}>{stamp.format(new Date(entry.at))}</time>
          </div>
          {(entry.by || entry.comment) && (
            <p>
              {entry.comment}
              {entry.by && <span className="table-sub">by {entry.by}</span>}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
