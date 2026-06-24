import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const INTERNAL_SECRET = process.env.FROTAS_INTERNAL_SECRET ?? "";

export function isInternalAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("x-internal-secret") ?? "";
  if (!INTERNAL_SECRET || !header) return false;
  const a = Buffer.from(INTERNAL_SECRET);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
