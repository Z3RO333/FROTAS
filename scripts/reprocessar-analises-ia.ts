// scripts/reprocessar-analises-ia.ts
//
// Reprocessa a análise de checklists por IA que ficou pra trás.
//
// Contexto: o `claim_checklists_analise` só pega checklists com
// `analise_status = 'PENDENTE'`. Quando a análise falha (ex.: chave de IA
// inválida) o checklist vai pra 'ERRO', e quando o processo morre no meio ele
// fica preso em 'PROCESSANDO' — nos dois casos ele nunca mais é tentado de
// novo. Este script devolve esses checklists pra fila e drena o lote.
//
// Uso:
//   npx tsx scripts/reprocessar-analises-ia.ts --dry
//   npx tsx scripts/reprocessar-analises-ia.ts
//   npx tsx scripts/reprocessar-analises-ia.ts --desde=2026-08-01
//   BASE_URL=https://gestaofrotas.azurewebsites.net npx tsx scripts/reprocessar-analises-ia.ts
//
// IMPORTANTE: o código corrigido precisa estar NO AR antes de rodar isso — o
// script chama o endpoint da aplicação, então ele usa a versão implantada, não
// a do seu working tree.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Client próprio em vez de reusar lib/supabase-manutencao: aquele módulo importa
// "server-only", que só resolve dentro do build do Next e quebra sob tsx.
function requiredEnv(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
}

const supabaseManutencao = createClient(
  requiredEnv("SUPABASE_MANUTENCAO_URL"),
  requiredEnv("SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const STATUS_PRESOS = ["ERRO", "PROCESSANDO"] as const;
const TAMANHO_LOTE = 20;
const PAUSA_ENTRE_LOTES_MS = 1_000;

function arg(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1];
}

function temFlag(nome: string): boolean {
  return process.argv.includes(`--${nome}`);
}

async function contarPorStatus(desde?: string) {
  const contagens: Record<string, number> = {};
  for (const status of STATUS_PRESOS) {
    let query = supabaseManutencao
      .from("checklists_frota")
      .select("id", { count: "exact", head: true })
      .eq("analise_status", status);
    if (desde) query = query.gte("data_checklist", desde);
    const { count, error } = await query;
    if (error) throw new Error(`contarPorStatus(${status}): ${error.message}`);
    contagens[status] = count ?? 0;
  }
  return contagens;
}

async function devolverParaFila(desde?: string): Promise<number> {
  let query = supabaseManutencao
    .from("checklists_frota")
    .update({ analise_status: "PENDENTE" })
    .in("analise_status", STATUS_PRESOS as unknown as string[]);
  if (desde) query = query.gte("data_checklist", desde);
  const { data, error } = await query.select("id");
  if (error) throw new Error(`devolverParaFila: ${error.message}`);
  return (data ?? []).length;
}

async function drenarFila(baseUrl: string, secret: string): Promise<void> {
  let lote = 0;
  let totalProcessado = 0;

  for (;;) {
    lote += 1;
    const res = await fetch(`${baseUrl}/api/checklists/analyze`, {
      method: "GET",
      headers: { "x-internal-secret": secret },
    });

    if (!res.ok) {
      throw new Error(`lote ${lote} falhou: HTTP ${res.status} ${await res.text().catch(() => "")}`);
    }

    const body = (await res.json()) as {
      processados: number;
      results: Array<{ checklist_id: number; status: string }>;
    };

    if (body.processados === 0) {
      console.log(`Fila vazia. Total processado: ${totalProcessado}.`);
      return;
    }

    totalProcessado += body.processados;
    const porStatus = body.results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`Lote ${lote}: ${body.processados} processado(s) — ${JSON.stringify(porStatus)}`);

    // Se todo o lote deu erro, algo sistêmico está quebrado (chave inválida,
    // modelo indisponível). Parar aqui evita queimar a fila inteira em falhas.
    if ((porStatus["erro_ia"] ?? 0) + (porStatus["erro"] ?? 0) === body.processados) {
      throw new Error(
        `Lote ${lote} falhou inteiro — interrompendo. Verifique as credenciais de IA antes de tentar de novo.`
      );
    }

    await new Promise((r) => setTimeout(r, PAUSA_ENTRE_LOTES_MS));
  }
}

async function main() {
  const desde = arg("desde");
  const dry = temFlag("dry");
  const baseUrl = (process.env.BASE_URL ?? "https://gestaofrotas.azurewebsites.net").replace(/\/$/, "");
  const secret = process.env.FROTAS_INTERNAL_SECRET?.trim();

  const contagens = await contarPorStatus(desde);
  const total = Object.values(contagens).reduce((a, b) => a + b, 0);

  console.log(`Checklists presos${desde ? ` desde ${desde}` : ""}:`);
  for (const [status, qtd] of Object.entries(contagens)) console.log(`  ${status}: ${qtd}`);

  if (total === 0) {
    console.log("Nada a reprocessar.");
    return;
  }

  if (dry) {
    console.log(`\n[dry] ${total} checklist(s) seriam devolvidos para 'PENDENTE' e reanalisados via ${baseUrl}.`);
    return;
  }

  if (!secret) throw new Error("FROTAS_INTERNAL_SECRET não configurada — necessária para chamar o endpoint.");

  const devolvidos = await devolverParaFila(desde);
  console.log(`\n${devolvidos} checklist(s) devolvidos para a fila. Drenando via ${baseUrl}...\n`);

  await drenarFila(baseUrl, secret);
}

main().catch((err) => {
  console.error("FALHOU:", err instanceof Error ? err.message : err);
  process.exit(1);
});
