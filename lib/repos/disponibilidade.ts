import { supabaseManutencao } from "@/lib/supabase-manutencao";
export { normalizeCdNome } from "@/lib/cd-utils";
import { normalizeCdNome } from "@/lib/cd-utils";

const VEICULOS_DISPONIBILIDADE_SELECT =
  "id,codigo_frota,placa,modelo,local,status,status_operacional,ativo,vendido,km_atualizado_em,ultimo_checklist_em,ultimo_motorista_nome,manutencao_motivo,manutencao_tipo,manutencao_oficina,manutencao_destino,manutencao_destino_detalhe,manutencao_iniciado_em,manutencao_iniciado_por,manutencao_prev_retorno";

type VeiculoDisponibilidadeRow = {
  id: number;
  codigo_frota: string | null;
  placa: string | null;
  modelo: string | null;
  local: string | null;
  status: string | null;
  status_operacional: string | null;
  ativo: boolean | null;
  vendido: boolean | null;
  km_atualizado_em: string | null;
  ultimo_checklist_em: string | null;
  ultimo_motorista_nome: string | null;
  manutencao_motivo: string | null;
  manutencao_tipo: string | null;
  manutencao_oficina: string | null;
  manutencao_destino?: string | null;
  manutencao_destino_detalhe?: string | null;
  manutencao_iniciado_em: string | null;
  manutencao_iniciado_por: string | null;
  manutencao_prev_retorno: string | null;
};

export type DisponibilidadeCD = {
  cd_nome: string;
  total: number;
  disponiveis: number;
  em_manutencao: number;
  indisponiveis: number;
  em_operacao: number;
  paradas: number;
  percentual_disponibilidade: number;
  pontos_atencao: number;
};

export type DisponibilidadeGeral = Omit<DisponibilidadeCD, "cd_nome">;

function withoutCd(resumo: DisponibilidadeCD): DisponibilidadeGeral {
  return {
    total: resumo.total,
    disponiveis: resumo.disponiveis,
    em_manutencao: resumo.em_manutencao,
    indisponiveis: resumo.indisponiveis,
    em_operacao: resumo.em_operacao,
    paradas: resumo.paradas,
    percentual_disponibilidade: resumo.percentual_disponibilidade,
    pontos_atencao: resumo.pontos_atencao,
  };
}

export type PontoAtencao = {
  tipo: "km_desatualizado" | "sem_checklist_recente" | "manutencao_longa" | "manutencao_atrasada" | "bloqueio_checklist";
  titulo: string;
  descricao: string;
  cd_nome: string;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  severidade: "ATENCAO" | "CRITICO";
};

export type FrotaManutencaoDisponibilidade = {
  id: number;
  frota_geral: string | null;
  placa: string | null;
  modelo: string | null;
  cd_nome: string;
  motivo: string | null;
  tipo: string | null;
  data_envio: string | null;
  tempo_parado_dias: number | null;
  local_atual: string | null;
  responsavel: string | null;
  previsao_retorno: string | null;
};

function isIndisponivel(row: VeiculoDisponibilidadeRow): boolean {
  return (
    row.status === "critico" ||
    row.status === "indisponivel" ||
    row.status_operacional === "BLOQUEADA_CHECKLIST"
  );
}

function isManutencao(row: VeiculoDisponibilidadeRow): boolean {
  return row.status === "manutencao" || row.status_operacional === "EM_MANUTENCAO";
}

function isDisponivel(row: VeiculoDisponibilidadeRow): boolean {
  return !isManutencao(row) && !isIndisponivel(row) && row.status !== "vendido";
}

function isEmOperacao(row: VeiculoDisponibilidadeRow): boolean {
  return row.status_operacional === "EM_USO";
}

function diasDesde(value: string | null, agora = Date.now()): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((agora - time) / 86_400_000));
}

function buildResumo(rows: VeiculoDisponibilidadeRow[], cd_nome: string): DisponibilidadeCD {
  const total = rows.length;
  const disponiveis = rows.filter(isDisponivel).length;
  const em_manutencao = rows.filter(isManutencao).length;
  const indisponiveis = rows.filter((row) => !isManutencao(row) && isIndisponivel(row)).length;
  const em_operacao = rows.filter(isEmOperacao).length;
  const pontos_atencao = buildPontosAtencao(rows, undefined, 500).length;

  return {
    cd_nome,
    total,
    disponiveis,
    em_manutencao,
    indisponiveis,
    em_operacao,
    paradas: em_manutencao + indisponiveis,
    percentual_disponibilidade: total > 0 ? Math.round((disponiveis / total) * 100) : 0,
    pontos_atencao,
  };
}

async function listVeiculosDisponibilidade(): Promise<VeiculoDisponibilidadeRow[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select(VEICULOS_DISPONIBILIDADE_SELECT)
    .eq("ativo", true)
    .eq("vendido", false)
    .order("local", { ascending: true })
    .order("codigo_frota", { ascending: true })
    .limit(5000);

  if (error) throw new Error(`listVeiculosDisponibilidade: ${error.message}`);

  return (data ?? []) as VeiculoDisponibilidadeRow[];
}

export async function listCDsDisponibilidade(): Promise<string[]> {
  const rows = await listVeiculosDisponibilidade();
  return Array.from(new Set(rows.map((row) => normalizeCdNome(row.local)))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export async function getDisponibilidadePorCD(): Promise<DisponibilidadeCD[]> {
  const rows = await listVeiculosDisponibilidade();
  const grouped = new Map<string, VeiculoDisponibilidadeRow[]>();

  for (const row of rows) {
    const cd = normalizeCdNome(row.local);
    grouped.set(cd, [...(grouped.get(cd) ?? []), row]);
  }

  return Array.from(grouped.entries())
    .map(([cd, cdRows]) => buildResumo(cdRows, cd))
    .sort((a, b) => a.cd_nome.localeCompare(b.cd_nome, "pt-BR"));
}

export async function getDisponibilidadeGeral(): Promise<DisponibilidadeGeral> {
  const rows = await listVeiculosDisponibilidade();
  return withoutCd(buildResumo(rows, "Todos os CDs"));
}

export async function getDisponibilidadeResumo(cdNome?: string): Promise<DisponibilidadeCD | DisponibilidadeGeral> {
  const rows = await listVeiculosDisponibilidade();
  const filtered = cdNome ? rows.filter((row) => normalizeCdNome(row.local) === cdNome) : rows;
  const resumo = buildResumo(filtered, cdNome ?? "Todos os CDs");
  if (cdNome) return resumo;
  return withoutCd(resumo);
}

function buildPontosAtencao(
  rows: VeiculoDisponibilidadeRow[],
  cdNome?: string,
  limite = 20
): PontoAtencao[] {
  const agora = Date.now();
  const pontos: PontoAtencao[] = [];

  for (const row of rows) {
    const cd_nome = normalizeCdNome(row.local);
    if (cdNome && cd_nome !== cdNome) continue;

    const diasKm = diasDesde(row.km_atualizado_em, agora);
    if (diasKm != null && diasKm > 15) {
      pontos.push({
        tipo: "km_desatualizado",
        titulo: "KM desatualizado",
        descricao: `Frota ${row.codigo_frota ?? row.id} sem atualizacao de KM ha ${diasKm} dias`,
        cd_nome,
        frota_id: row.id,
        frota_geral: row.codigo_frota,
        placa: row.placa,
        severidade: diasKm > 30 ? "CRITICO" : "ATENCAO",
      });
    }

    const diasChecklist = diasDesde(row.ultimo_checklist_em, agora);
    if (isDisponivel(row) && diasChecklist != null && diasChecklist > 7) {
      pontos.push({
        tipo: "sem_checklist_recente",
        titulo: "Sem checklist recente",
        descricao: `Frota ${row.codigo_frota ?? row.id} sem checklist ha ${diasChecklist} dias`,
        cd_nome,
        frota_id: row.id,
        frota_geral: row.codigo_frota,
        placa: row.placa,
        severidade: diasChecklist > 15 ? "CRITICO" : "ATENCAO",
      });
    }

    const diasManutencao = diasDesde(row.manutencao_iniciado_em, agora);
    if (isManutencao(row) && diasManutencao != null && diasManutencao > 7) {
      pontos.push({
        tipo: "manutencao_longa",
        titulo: "Manutenção prolongada",
        descricao: `Frota ${row.codigo_frota ?? row.id} em manutenção há ${diasManutencao} dias`,
        cd_nome,
        frota_id: row.id,
        frota_geral: row.codigo_frota,
        placa: row.placa,
        severidade: diasManutencao > 15 ? "CRITICO" : "ATENCAO",
      });
    }

    if (isManutencao(row) && row.manutencao_prev_retorno) {
      const atraso = diasDesde(row.manutencao_prev_retorno, agora);
      if (atraso != null && atraso > 0) {
        pontos.push({
          tipo: "manutencao_atrasada",
          titulo: "Retorno atrasado",
          descricao: `Previsao de retorno vencida ha ${atraso} dias`,
          cd_nome,
          frota_id: row.id,
          frota_geral: row.codigo_frota,
          placa: row.placa,
          severidade: atraso > 3 ? "CRITICO" : "ATENCAO",
        });
      }
    }

    if (row.status_operacional === "BLOQUEADA_CHECKLIST") {
      pontos.push({
        tipo: "bloqueio_checklist",
        titulo: "Bloqueada por checklist",
        descricao: `Frota ${row.codigo_frota ?? row.id} bloqueada ate nova analise operacional`,
        cd_nome,
        frota_id: row.id,
        frota_geral: row.codigo_frota,
        placa: row.placa,
        severidade: "CRITICO",
      });
    }
  }

  return pontos
    .sort((a, b) => {
      if (a.severidade !== b.severidade) return a.severidade === "CRITICO" ? -1 : 1;
      return a.cd_nome.localeCompare(b.cd_nome, "pt-BR");
    })
    .slice(0, limite);
}

export async function getPontosAtencao(limite = 20, cdNome?: string): Promise<PontoAtencao[]> {
  const rows = await listVeiculosDisponibilidade();
  return buildPontosAtencao(rows, cdNome, limite);
}

export async function listFrotasEmManutencao(
  cdNome?: string,
  limite = 100
): Promise<FrotaManutencaoDisponibilidade[]> {
  const rows = await listVeiculosDisponibilidade();
  const agora = Date.now();

  return rows
    .filter((row) => isManutencao(row))
    .filter((row) => !cdNome || normalizeCdNome(row.local) === cdNome)
    .map((row) => ({
      id: row.id,
      frota_geral: row.codigo_frota,
      placa: row.placa,
      modelo: row.modelo,
      cd_nome: normalizeCdNome(row.local),
      motivo: row.manutencao_motivo,
      tipo: row.manutencao_tipo,
      data_envio: row.manutencao_iniciado_em,
      tempo_parado_dias: diasDesde(row.manutencao_iniciado_em, agora),
      local_atual: row.manutencao_destino_detalhe ?? row.manutencao_oficina ?? row.manutencao_destino ?? row.local,
      responsavel: row.ultimo_motorista_nome ?? row.manutencao_iniciado_por,
      previsao_retorno: row.manutencao_prev_retorno,
    }))
    .sort((a, b) => (b.tempo_parado_dias ?? -1) - (a.tempo_parado_dias ?? -1))
    .slice(0, limite);
}
