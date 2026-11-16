import type { DatabaseSync } from "node:sqlite";

/** Appends an entry to the audit log for a privileged action. */
export function recordAudit(
  db: DatabaseSync,
  entry: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    detail?: string;
  },
) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.actorId,
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.detail ?? "",
    new Date().toISOString(),
  );
}
