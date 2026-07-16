import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export function apiError(message: string, status: number, code: string, cause?: unknown): NextResponse {
  const requestId = randomUUID();
  if (status >= 500) {
    console.error(JSON.stringify({
      level: "error",
      type: "api_error",
      request_id: requestId,
      status,
      code,
      message,
      cause: cause instanceof Error ? cause.message : cause == null ? null : String(cause),
    }));
  }
  return NextResponse.json(
    { ok: false, error: message, code, request_id: requestId },
    { status, headers: { "x-request-id": requestId } }
  );
}
