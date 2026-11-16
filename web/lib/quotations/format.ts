const date = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** en-IN date for an ISO timestamp or a YYYY-MM-DD date. */
export function formatDate(value: string) {
  const d = new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value);
  return Number.isNaN(d.getTime()) ? value : date.format(d);
}
