import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export const AUDIT_PAGE_SIZE = 25;

export type AuditRow = {
  id: number;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAt: string;
};

type Raw = {
  id: number;
  actor_id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: string;
  created_at: string;
};

const SELECT = `SELECT a.id, a.actor_id,
    COALESCE(u.first_name || ' ' || u.last_name, a.actor_id) AS actor_name,
    a.action, a.entity_type, a.entity_id, a.detail, a.created_at
  FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id`;

function toRow(r: Raw): AuditRow {
  return {
    id: r.id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    detail: r.detail,
    createdAt: r.created_at,
  };
}

export function latestAudit(db: DatabaseSync, limit = 10): AuditRow[] {
  return (
    db.prepare(`${SELECT} ORDER BY a.id DESC LIMIT ?`).all(limit) as Raw[]
  ).map(toRow);
}

export function auditEntityTypes(db: DatabaseSync): string[] {
  return (
    db
      .prepare(
        "SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type",
      )
      .all() as {
      entity_type: string;
    }[]
  ).map((r) => r.entity_type);
}

/** One page of the audit log, newest first, optionally for one entity type. */
export function pageAudit(
  db: DatabaseSync,
  options: { page?: number; entityType?: string } = {},
) {
  const where = options.entityType ? "WHERE a.entity_type = ?" : "";
  const params: SQLInputValue[] = options.entityType
    ? [options.entityType]
    : [];
  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM audit_log a ${where}`)
    .get(...params) as { n: number };
  const pages = Math.max(1, Math.ceil(n / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1) || 1), pages);
  const rows = (
    db
      .prepare(`${SELECT} ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`)
      .all(...params, AUDIT_PAGE_SIZE, (page - 1) * AUDIT_PAGE_SIZE) as Raw[]
  ).map(toRow);
  return { rows, page, pages, total: n, pageSize: AUDIT_PAGE_SIZE };
}
