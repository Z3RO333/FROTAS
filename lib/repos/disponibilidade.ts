import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type DisponibilidadeCD = {
  cd_nome: string;
  total: number;
  disponiveis: number;
  em_manutencao: number;
  paradas: number;
  percentual_disponibilidade: number;
};

export type DisponibilidadeGeral = {
  total: number;
  disponiveis: number;
  em_manutencao: number;
  paradas: number;
  percentual_disponibilidade: number;
};

export type PontoAtencao = {
  tipo: "km_desatualizado" | "sem_checklist_recente" | "manutencao_longa";
  titulo: string;
  descricao: string;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  severidade: "ATENCAO" | "CRITICO";
};

export async function getDisponibilidadePorCD(): Promise<DisponibilidadeCD[]> {
  const { data, error } = await supabaseManutencao
    .from("v_disponibilidade_cd")
    .select("*");
  if (error) {
    console.warn("[disponibilidade] falha ao buscar por CD", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    cd_nome: String(row.cd_nome ?? "Sem CD"),
    total: Number(row.total ?? 0),
    disponiveis: Number(row.disponiveis ?? 0),
    em_manutencao: Number(row.em_manutencao ?? 0),
    paradas: Number(row.paradas ?? 0),
    percentual_disponibilidade: Math.round(Number(row.percentual_disponibilidade ?? 0)),
  }));
}

export async function getDisponibilidadeGeral(): Promise<DisponibilidadeGeral> {
  const rows = await getDisponibilidadePorCD();
  const total = rows.reduce((s, r) => s + r.total, 0);
  const disponiveis = rows.reduce((s, r) => s + r.disponiveis, 0);
  const em_manutencao = rows.reduce((s, r) => s + r.em_manutencao, 0);
  const paradas = rows.reduce((s, r) => s + r.paradas, 0);
  return {
    total,
    disponiveis,
    em_manutencao,
    paradas,
    percentual_disponibilidade: total > 0 ? Math.round((disponiveis / total) * 100) : 0,
  };
}

export async function getPontosAtencao(limite = 20): Promise<PontoAtencao[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("id, codigo_frota, placa, km_atualizado_em, ultimo_checklist_em, manutencao_iniciado_em, status")
    .eq("ativo", true)
    .eq("vendido", false)
    .limit(500);

  if (error || !data) return [];

  const agora = Date.now();
  const pontos: PontoAtencao[] = [];

  for (const v of data) {
    if (v.km_atualizado_em) {
      const dias = Math.floor((agora - new Date(v.km_atualizado_em).getTime()) / 86_400_000);
      if (dias > 15) {
        pontos.push({
          tipo: "km_desatualizado",
          titulo: "KM desatualizado",
          descricao: `Frota ${v.codigo_frota ?? v.id} sem atualização de KM há ${dias} dias`,
          frota_id: v.id,
          frota_geral: v.codigo_frota ?? null,
          placa: v.placa ?? null,
          severidade: dias > 30 ? "CRITICO" : "ATENCAO",
        });
      }
    }

    if (v.status === "disponivel" && v.ultimo_checklist_em) {
      const dias = Math.floor((agora - new Date(v.ultimo_checklist_em).getTime()) / 86_400_000);
      if (dias > 7) {
        pontos.push({
          tipo: "sem_checklist_recente",
          titulo: "Sem checklist recente",
          descricao: `Frota ${v.codigo_frota ?? v.id} sem checklist há ${dias} dias`,
          frota_id: v.id,
          frota_geral: v.codigo_frota ?? null,
          placa: v.placa ?? null,
          severidade: dias > 15 ? "CRITICO" : "ATENCAO",
        });
      }
    }

    if (v.status === "manutencao" && v.manutencao_iniciado_em) {
      const dias = Math.floor((agora - new Date(v.manutencao_iniciado_em).getTime()) / 86_400_000);
      if (dias > 15) {
        pontos.push({
          tipo: "manutencao_longa",
          titulo: "Manutenção prolongada",
          descricao: `Frota ${v.codigo_frota ?? v.id} em manutenção há ${dias} dias`,
          frota_id: v.id,
          frota_geral: v.codigo_frota ?? null,
          placa: v.placa ?? null,
          severidade: dias > 30 ? "CRITICO" : "ATENCAO",
        });
      }
    }
  }

  return pontos
    .sort((a, b) => (a.severidade === "CRITICO" ? -1 : 1))
    .slice(0, limite);
}
