import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { EquipamentoApp, SegmentoEquipamento, TipoPreventiva } from "./types";

export async function listEquipamentos(
  segmento?: SegmentoEquipamento,
  apenasAtivos = true
): Promise<EquipamentoApp[]> {
  let q = supabaseManutencao.from("equipamentos_app").select("*");
  if (segmento) q = q.eq("segmento", segmento);
  if (apenasAtivos) q = q.eq("ativo", true);
  const { data, error } = await q.order("numero_equip");
  if (error) throw new Error(`listEquipamentos: ${error.message}`);
  return (data ?? []) as EquipamentoApp[];
}

export async function registrarPreventiva(input: {
  equipamento_id: string;
  tipo_preventiva: TipoPreventiva;
  data_servico: string;
  horimetro_servico: number;
  observacoes?: string;
  registrado_por_email: string;
  registrado_por_nome: string;
}): Promise<void> {
  const { error } = await supabaseManutencao.from("equipamentos_preventivas_app").insert({
    equipamento_id: input.equipamento_id,
    tipo_preventiva: input.tipo_preventiva,
    data_servico: input.data_servico,
    horimetro_servico: input.horimetro_servico,
    observacoes: input.observacoes ?? null,
    registrado_por_id: input.registrado_por_email,
    registrado_por_email: input.registrado_por_email,
    registrado_por_nome: input.registrado_por_nome,
  });
  if (error) throw new Error(`registrarPreventiva: ${error.message}`);

  const campo = input.tipo_preventiva === "300h" ? "horimetro_base_300h" : "horimetro_base_1500h";
  const { error: errUpdate } = await supabaseManutencao
    .from("equipamentos_app")
    .update({ horimetro_atual: input.horimetro_servico, [campo]: input.horimetro_servico })
    .eq("id", input.equipamento_id);
  if (errUpdate) throw new Error(`registrarPreventiva update: ${errUpdate.message}`);
}
