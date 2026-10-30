import "server-only";
import { env } from "@/lib/env";
import { createMockRepositories, RepositoryError } from "./mock";
import type { Repositories } from "./contracts";

export function getRepositories(): Repositories {
  if (env.NEXT_PUBLIC_DATA_MODE === "mock") return createMockRepositories();
  // Fail closed until Phase 2 supplies authenticated Catalyst repositories.
  throw new RepositoryError(
    "CATALYST_NOT_CONFIGURED",
    "Catalyst integration is scheduled for Phase 2. Use mock mode for local development.",
  );
}
