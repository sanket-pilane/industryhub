import "server-only";
import { getDb } from "@/lib/db";
import type { Repositories } from "./contracts";
import { createSqliteRepositories } from "./sqlite";

export function getRepositories(): Repositories {
  return createSqliteRepositories(getDb());
}
