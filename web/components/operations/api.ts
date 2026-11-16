import type { ApiResponse } from "../../../shared/contracts";

export type CallResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string; fields: Record<string, string[]> };

/** Calls an API route and folds every failure (network, HTTP, validation) into one shape. */
export async function callApi<T = unknown>(
  url: string,
  method: "POST" | "PATCH",
  body?: unknown,
): Promise<CallResult<T>> {
  try {
    const isForm = body instanceof FormData;
    const response = await fetch(url, {
      method,
      headers:
        isForm || body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiResponse<T> | null;
    if (payload?.success) return { ok: true, data: payload.data };
    return {
      ok: false,
      message: payload?.error?.message ?? "Something went wrong. Please retry.",
      fields: payload?.error?.fields ?? {},
    };
  } catch {
    return {
      ok: false,
      message: "Network error. Check your connection and retry.",
      fields: {},
    };
  }
}
