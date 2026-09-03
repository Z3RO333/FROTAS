import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type AlertaRow = {
  id: number;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  checklist_id: number | null;
  analise_id: number | null;
  tipo: "CRITICO" | "MANUTENCAO" | "BLOQUEIO_SUGERIDO" | "KM_ANOMALO";
  titulo: string;
  descricao: string | null;
  status: "ABERTO" | "RESOLVIDO" | "IGNORADO";
  resolvido_por: string | null;
  resolvido_em: string | null;
  criado_em: string;
};

type AlertaDbRow = Omit<AlertaRow, "frota_geral" | "placa">;

export async function createAlerta(input: {
  frota_id: number;
  checklist_id: number | null;
  analise_id: number | null;
  tipo: AlertaRow["tipo"];
  titulo: string;
  descricao: string | null;
}): Promise<number> {
  const { data, error } = await supabaseManutencao
    .from("alertas_frota")
    .insert({
      frota_id: input.frota_id,
      checklist_id: input.checklist_id,
      analise_id: input.analise_id,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao,
      status: "ABERTO",
    })
    .select("id")
    .single();
  if (error) throw error;
  return Number(data.id);
}

export async function listAlertasAbertos(limit = 50): Promise<AlertaRow[]> {
  const { data, error } = await supabaseManutencao
    .from("alertas_frota")
    .select("*")
    .eq("status", "ABERTO")
    .order("criado_em", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as AlertaDbRow[];
  const frotaIds = [...new Set(rows.map((r) => r.frota_id))];

  if (frotaIds.length === 0) return [];

  const { data: veiculos, error: veiculosError } = await supabaseManutencao
    .from("veiculos")
    .select("id,codigo_frota,placa")
    .in("id", frotaIds);
  if (veiculosError) throw new Error(`listAlertasAbertos veiculos: ${veiculosError.message}`);

  const veiculoMap = new Map(
    (veiculos ?? []).map((v) => [Number(v.id), v as { id: number; codigo_frota: string | null; placa: string | null }])
  );

  return rows.map((row) => ({
    ...row,
    frota_geral: veiculoMap.get(row.frota_id)?.codigo_frota ?? null,
    placa: veiculoMap.get(row.frota_id)?.placa ?? null,
  }));
}

export async function resolverAlerta(
  alertaId: number,
  resolvidoPor: string,
  novoStatus: "RESOLVIDO" | "IGNORADO"
): Promise<void> {
  const { data, error } = await supabaseManutencao
    .from("alertas_frota")
    .update({ status: novoStatus, resolvido_por: resolvidoPor, resolvido_em: new Date().toISOString() })
    .eq("id", alertaId)
    .eq("status", "ABERTO")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Este alerta já foi tratado ou não está mais disponível.");
}

export async function countAlertasAbertos(): Promise<number> {
  const { count, error } = await supabaseManutencao
    .from("alertas_frota")
    .select("id", { count: "exact", head: true })
    .eq("status", "ABERTO");
  if (error) throw new Error(`countAlertasAbertos: ${error.message}`);
  return count ?? 0;
}
