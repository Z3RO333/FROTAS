import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { listChecklistItems, type ChecklistItemRow } from "@/lib/repos/checklists";

export type FotoChecklist = {
  id: string;
  source_type: "hodometro" | "item" | "abastecimento";
  checklist_item_codigo: string | null;
  signed_url: string | null;
  storage_path: string;
};

export type HistoricoMovimentacao = {
  id: number;
  tipo_acao: string;
  motivo_bloqueio: string | null;
  observacao: string | null;
  usuario_portaria_id: string | null;
  data_hora: string;
};

export type ChecklistDetalhePortaria = {
  checklist_id: number;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  motorista_nome: string | null;
  motorista_id: string | null;
  km_informado: number | null;
  km_anterior: number | null;
  status_geral: string | null;
  observacao_original: string | null;
  observacao_corrigida_ia: string | null;
  criado_em: string | null;
  itens: ChecklistItemRow[];
  fotos: FotoChecklist[];
  historico_hoje: HistoricoMovimentacao[];
};

export async function getChecklistDetalhePortaria(
  checklistId: number,
  frotaId: number
): Promise<ChecklistDetalhePortaria | null> {
  const [checklistResult, itens, imagensResult, historicoResult] = await Promise.all([
    supabaseManutencao
      .from("checklists_frota")
      .select(`
        id, frota_id, motorista_id, motorista_nome,
        km_informado, status_geral, observacao_original,
        observacao_corrigida_ia, criado_em,
        veiculos!inner(codigo_frota, placa, modelo, km_atual)
      `)
      .eq("id", checklistId)
      .single(),

    listChecklistItems(checklistId),

    supabaseManutencao
      .from("checklist_image_inspections")
      .select("id, source_type, checklist_item_codigo, storage_path")
      .eq("checklist_id", checklistId),

    supabaseManutencao
      .from("movimentacoes_frota")
      .select("id, tipo_acao, motivo_bloqueio, observacao, usuario_portaria_id, data_hora")
      .eq("frota_id", frotaId)
      .order("data_hora", { ascending: false })
      .limit(10),
  ]);

  if (checklistResult.error || !checklistResult.data) {
    console.warn("[portaria-detail] checklist não encontrado", checklistResult.error?.message);
    return null;
  }

  const c = checklistResult.data;
  const veiculo = (c as unknown as { veiculos?: { codigo_frota?: string | null; placa?: string | null; modelo?: string | null; km_atual?: number | null } }).veiculos ?? {};

  const imagens = imagensResult.data ?? [];
  const fotos: FotoChecklist[] = await Promise.all(
    imagens.map(async (img) => {
      const { data: signed } = await supabaseManutencao.storage
        .from("checklist-images")
        .createSignedUrl(img.storage_path, 3600);
      return {
        id: String(img.id),
        source_type: img.source_type as FotoChecklist["source_type"],
        checklist_item_codigo: img.checklist_item_codigo ?? null,
        storage_path: img.storage_path,
        signed_url: signed?.signedUrl ?? null,
      };
    })
  );

  return {
    checklist_id: checklistId,
    frota_id: frotaId,
    frota_geral: veiculo.codigo_frota ?? null,
    placa: veiculo.placa ?? null,
    modelo: veiculo.modelo ?? null,
    motorista_nome: (c as { motorista_nome?: string | null }).motorista_nome ?? null,
    motorista_id: (c as { motorista_id?: string | null }).motorista_id ?? null,
    km_informado: (c as { km_informado?: number | null }).km_informado != null ? Number((c as { km_informado?: number | null }).km_informado) : null,
    km_anterior: veiculo.km_atual != null ? Number(veiculo.km_atual) : null,
    status_geral: (c as { status_geral?: string | null }).status_geral ?? null,
    observacao_original: (c as { observacao_original?: string | null }).observacao_original ?? null,
    observacao_corrigida_ia: (c as { observacao_corrigida_ia?: string | null }).observacao_corrigida_ia ?? null,
    criado_em: (c as { criado_em?: string | null }).criado_em ?? null,
    itens,
    fotos,
    historico_hoje: (historicoResult.data ?? []).map((h) => ({
      id: Number(h.id),
      tipo_acao: (h as { tipo_acao?: string | null }).tipo_acao ?? "SAIDA",
      motivo_bloqueio: (h as { motivo_bloqueio?: string | null }).motivo_bloqueio ?? null,
      observacao: h.observacao ?? null,
      usuario_portaria_id: h.usuario_portaria_id ?? null,
      data_hora: h.data_hora,
    })),
  };
}
