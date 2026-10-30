import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getRepositories } from "@/lib/repositories";
import { verifyMockToken } from "./mock-token";
import { findRegisteredProfile } from "./mock-users";

export const SESSION_COOKIE = "industrihub-demo-session";
export function mockSessionSecret() {
  return (
    process.env.MOCK_SESSION_SECRET || "local-demo-only-change-before-sharing"
  );
}
export async function getSessionUser() {
  if (env.NEXT_PUBLIC_DATA_MODE !== "mock") return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = token ? verifyMockToken(token, mockSessionSecret()) : null;
  if (!id) return null;
  return (
    (await getRepositories().profiles.getById(id)) ?? findRegisteredProfile(id)
  );
}
