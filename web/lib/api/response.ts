import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiResponse } from "../../../shared/contracts";
import { RepositoryError } from "@/lib/repositories/mock";

export function success<T>(
  data: T,
  meta: { page?: number; pageSize?: number; total?: number } = {},
) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
      error: null,
      meta: { requestId: crypto.randomUUID(), ...meta },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export function failure(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string[]>,
) {
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      data: null,
      error: { code, message, ...(fields ? { fields } : {}) },
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function handleApiError(error: unknown) {
  if (error instanceof ZodError)
    return failure(
      "VALIDATION_ERROR",
      "Please check your input.",
      400,
      error.flatten().fieldErrors,
    );
  if (error instanceof SyntaxError)
    return failure("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  if (error instanceof RepositoryError)
    return failure(error.code, error.message, 503);
  console.error("Unhandled API error", error);
  return failure("INTERNAL_ERROR", "Something went wrong. Please retry.", 500);
}
