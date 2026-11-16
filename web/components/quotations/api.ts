import type { ApiResponse } from "../../../shared/contracts";

export type PostResult =
  | { ok: true }
  | { ok: false; message: string; fields: Record<string, string[]> };

/** POSTs JSON to an API route and flattens the shared response envelope. */
export async function postJson(
  url: string,
  body: unknown,
): Promise<PostResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const result = (await response
      .json()
      .catch(() => null)) as ApiResponse<unknown> | null;
    if (response.ok && result?.success) return { ok: true };
    return {
      ok: false,
      message: result?.error?.message ?? "Something went wrong. Please retry.",
      fields: result?.error?.fields ?? {},
    };
  } catch {
    return {
      ok: false,
      message: "Network error. Check your connection and retry.",
      fields: {},
    };
  }
}
