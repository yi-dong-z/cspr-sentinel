import { SentinelError } from "@cspr-sentinel/core";

export function apiError(error: unknown): Response {
  if (error instanceof SentinelError) return Response.json({ error: error.code, message: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "internal_error", message: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
}
