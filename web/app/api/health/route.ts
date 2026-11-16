import { success, failure } from "@/lib/api/response";
import { getDb } from "@/lib/db";

export function GET() {
  try {
    const { version } = getDb()
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number };
    return success({
      service: "INDUSTRIHUB",
      database: "ok",
      schemaVersion: version,
    });
  } catch {
    return failure("DATABASE_UNAVAILABLE", "Database is not reachable.", 503);
  }
}
