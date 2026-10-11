import "server-only";
import { NextResponse } from "next/server";

// Enveloppe de réponse /api/v1 (Build Pack V4, partie 06.1).
export function requestId(req: Request) {
  const h = req.headers.get("x-request-id");
  return h && /^[0-9a-f-]{36}$/i.test(h) ? h : crypto.randomUUID();
}

export function ok<T>(rid: string, data: T, status = 200) {
  return NextResponse.json({ data, meta: { requestId: rid } }, { status });
}

export function fail(rid: string, status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details }, meta: { requestId: rid } }, { status });
}
