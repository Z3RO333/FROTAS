import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { Veiculo, ServicoApp, TrocaPneuApp } from "./types";
import { gerarNumeroFogoSequencial } from "@/lib/numero-fogo";
import { safePostgrestTerm } from "@/lib/postgrest-filter";

// Colunas usadas pelo PneusWorkspace — evita transferir os 8 campos de intervalo
// que não são consumidos por essa tela.
const VEICULO_PNEUS_COLS = "id,codigo_frota,placa,modelo,qtd_pneus,local";

export async function listVeiculos(search?: string): Promise<Veiculo[]> {
  let q = supabaseManutencao.from("veiculos").select(VEICULO_PNEUS_COLS).order("codigo_frota");
  if (search) {
    const term = safePostgrestTerm(search.toLowerCase());
    if (term) {
      const s = `%${term}%`;
      q = q.or(`codigo_frota.ilike.${s},placa.ilike.${s},modelo.ilike.${s}`);
    }
  }
  const { data, error } = await q;
  if (error) throw new Error(`listVeiculos: ${error.message}`);
  return (data ?? []) as Veiculo[];
}

export async function getVeiculo(codigoFrota: string): Promise<Veiculo | null> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("*")
    .eq("codigo_frota", codigoFrota)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(`getVeiculo: ${error.message}`);
  return (data ?? null) as Veiculo | null;
}

async function getVeiculoByIdOrCodigo(idOrCodigo: string): Promise<Veiculo | null> {
  const codigo = String(idOrCodigo ?? "").trim();
  if (!codigo) return null;

  const { data: byCodigo, error: errCodigo } = await supabaseManutencao
    .from("veiculos")
    .select("*")
    .eq("codigo_frota", codigo)
    .limit(1)
    .maybeSingle();

  if (errCodigo) throw new Error(`getVeiculoByIdOrCodigo: ${errCodigo.message}`);
  if (byCodigo) return byCodigo as Veiculo;

  const id = Number(codigo);
  if (!Number.isInteger(id) || id <= 0) return null;

  const { data: byId, error: errId } = await supabaseManutencao
    .from("veiculos")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (errId) throw new Error(`getVeiculoByIdOrCodigo: ${errId.message}`);
  return (byId ?? null) as Veiculo | null;
}

function normalizePlate(value: string | null | undefined): string {
  return String(value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

/**
 * Reserva atomicamente um intervalo de contagens para uma frota+ano usando a RPC
 * `reservar_contagens_numero_fogo` (migration 021). Retorna a primeira contagem do
 * intervalo. Concorrência: serializado por row-lock em numero_fogo_sequencia.
 *
 * A operação falha de forma segura se a RPC não estiver instalada; não usamos
 * SELECT MAX porque ele gera duplicidades sob concorrência.
 */
async function reservarContagemNumeroFogo(
  veiculo: Veiculo,
  digitoAno: string,
  quantidade: number
): Promise<number> {
  const chaveFrota = veiculo.codigo_frota?.trim() || normalizePlate(veiculo.placa);
  if (!chaveFrota) {
    throw new Error("Veículo sem código de frota nem placa para gerar número de fogo.");
  }

  const { data, error } = await supabaseManutencao.rpc("reservar_contagens_numero_fogo", {
    p_chave_frota: chaveFrota,
    p_digito_ano: digitoAno,
    p_quantidade: quantidade,
  });

  if (!error && typeof data === "number" && Number.isFinite(data) && data > 0) {
    return Math.floor(data);
  }

  throw new Error(`reservarContagemNumeroFogo: ${error?.message ?? "sem retorno"}`);
}

export async function listUltimaContagemNumeroFogoPorFrota(
  ano = new Date().getFullYear()
): Promise<Record<string, number>> {
  const digitoAno = String(ano).slice(-1);

  // PostgREST limita a 1000 linhas por request (db.max_rows) independente do .limit() pedido —
  // pagina com .range() para não perder frotas cuja maior contagem fica fora do topo global.
  const rows: { frota: string | null; contagem: number | null }[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from("numero_fogo")
      .select("frota, contagem")
      .eq("ultimo_digito_ano", digitoAno)
      .not("frota", "is", null)
      .order("contagem", { ascending: false })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`listUltimaContagemNumeroFogoPorFrota: ${error.message}`);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }

  const result: Record<string, number> = {};
  for (const row of rows) {
    const frota = String(row.frota ?? "").trim();
    const contagem = Number(row.contagem ?? 0);
    if (frota && result[frota] == null && Number.isFinite(contagem)) {
      result[frota] = Math.max(0, Math.floor(contagem));
    }
  }
  return result;
}

export interface TrocaPneuInput {
  submission_id: string;
  id_veiculo: string;
  quilometragem: number;
  observacoes?: string;
  posicoes: Array<{ posicao: string; numero_fogo?: string }>;
  registrado_por_email: string;
  registrado_por_nome: string;
}

export async function registrarTrocaPneu(input: TrocaPneuInput): Promise<string> {
  const veiculo = await getVeiculoByIdOrCodigo(input.id_veiculo);
  if (!veiculo) throw new Error("Veiculo nao encontrado para registrar troca de pneu.");

  if (input.posicoes.length === 0) {
    throw new Error("Selecione ao menos uma posição.");
  }
  const normalizedPositions = input.posicoes.map((item) => item.posicao.trim().toUpperCase());
  if (new Set(normalizedPositions).size !== normalizedPositions.length) {
    throw new Error("Não repita a mesma posição de pneu.");
  }

  const idServico = input.submission_id;
  const { data: existing, error: existingError } = await supabaseManutencao
    .from("servicos_app")
    .select("id_servico")
    .eq("id_servico", idServico)
    .maybeSingle();
  if (existingError) throw new Error(`registrarTrocaPneu idempotencia: ${existingError.message}`);
  if (existing) return idServico;

  const dataServico = new Date();
  const ano = dataServico.getFullYear();
  const digitoAno = String(ano).slice(-1);
  // Reserva atomicamente N contagens consecutivas via RPC (migration 021).
  // Antes: SELECT MAX + INSERT separados → race condition gerava numero_fogo duplicado
  // entre trocas concorrentes do mesmo veículo.
  const contagemInicial = await reservarContagemNumeroFogo(
    veiculo,
    digitoAno,
    input.posicoes.length
  );
  const placaNormalizada = normalizePlate(veiculo.placa);

  const posicoes = input.posicoes.map((p, index) => {
    const gerado = gerarNumeroFogoSequencial({
      frota: veiculo.codigo_frota,
      placa: veiculo.placa,
      ano,
      contagem: contagemInicial + index,
    });
    return {
      posicao: p.posicao,
      numero_fogo: gerado.numeroFogo,
      contagem: gerado.contagem,
    };
  });

  const servico = {
    id_servico: idServico,
    id_veiculo: veiculo.codigo_frota,
    tipo_servico: "troca_pneu",
    quilometragem: input.quilometragem,
    observacoes: input.observacoes ?? null,
    registrado_por_email: input.registrado_por_email,
    registrado_por_nome: input.registrado_por_nome,
  };

  const trocas = posicoes.map((p) => ({
    id_servico: idServico,
    posicao: p.posicao,
    numero_fogo: p.numero_fogo,
    quilometragem: input.quilometragem,
  }));

  const numerosFogo = posicoes.map((p) => ({
    numero_fogo: p.numero_fogo,
    contagem: p.contagem,
    data: dataServico.toISOString().slice(0, 10),
    mes: dataServico.getMonth() + 1,
    placa: placaNormalizada || null,
    frota: veiculo.codigo_frota,
    ultimo_digito_ano: digitoAno,
    qtd_pneus: 1,
  }));

  const { error } = await supabaseManutencao.rpc("registrar_troca_pneu_atomica", {
    p_servico: servico,
    p_trocas: trocas,
    p_numeros_fogo: numerosFogo,
  });
  if (error) throw new Error(`registrarTrocaPneu: ${error.message}`);

  return idServico;
}

export async function listTrocasByVeiculo(
  codigoFrota: string,
  limit = 50
): Promise<Array<ServicoApp & { trocas: TrocaPneuApp[] }>> {
  const { data, error } = await supabaseManutencao
    .from("servicos_app")
    .select("*, trocas:trocas_pneus_app(*)")
    .eq("id_veiculo", codigoFrota)
    .eq("tipo_servico", "troca_pneu")
    .order("data_servico", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listTrocasByVeiculo: ${error.message}`);
  return data as Array<ServicoApp & { trocas: TrocaPneuApp[] }>;
}
