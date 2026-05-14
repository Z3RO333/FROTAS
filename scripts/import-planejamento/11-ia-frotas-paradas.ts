import "dotenv/config";
import { supabaseManutencao } from "../../lib/supabase-manutencao";
import { analyzeParada } from "../../lib/ai/frotas-paradas-analyzer";

type ParadaRow = {
  id: number;
  frota_numero: string | null;
  placa: string | null;
  descricao_original: string;
  ia_analisado_em: string | null;
};

export async function runIaFrotasParadas(): Promise<void> {
  const { data, error } = await supabaseManutencao
    .from("fact_frotas_paradas")
    .select("id,frota_numero,placa,descricao_original,ia_analisado_em")
    .is("ia_analisado_em", null)
    .order("id");

  if (error) throw error;
  const pendentes = (data ?? []) as ParadaRow[];

  if (pendentes.length === 0) {
    console.log("[11-ia-paradas] Nenhuma parada pendente de análise IA");
    return;
  }

  console.log(`[11-ia-paradas] Analisando ${pendentes.length} frotas paradas...`);
  let ok = 0;

  for (const row of pendentes) {
    const frota = row.frota_numero ?? row.placa;
    const result = await analyzeParada(frota, row.descricao_original);

    const { error: updateErr } = await supabaseManutencao
      .from("fact_frotas_paradas")
      .update({
        ia_texto_corrigido: result.texto_corrigido,
        ia_classificacao: result.classificacao,
        ia_criticidade: result.criticidade,
        ia_acao_recomendada: result.acao_recomendada,
        ia_justificativa: result.justificativa,
        ia_analisado_em: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateErr) {
      console.warn(`[11-ia-paradas] erro id=${row.id}:`, updateErr.message);
    } else {
      ok++;
      console.log(`  [${ok}/${pendentes.length}] Frota ${frota ?? "?"} → ${result.criticidade} | ${result.classificacao}`);
    }

    // Throttle para não sobrecarregar a API
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[11-ia-paradas] ${ok}/${pendentes.length} analisados pela IA`);
}

if (require.main === module) {
  runIaFrotasParadas()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
