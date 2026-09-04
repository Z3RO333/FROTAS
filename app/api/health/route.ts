import { NextResponse } from "next/server";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export const dynamic = "force-dynamic";

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const result = await supabaseManutencao
      .from("veiculos")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(controller.signal);

    if (result.error) throw result.error;
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } finally {
    clearTimeout(timeout);
  }
}
