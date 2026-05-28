import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { Veiculo, ServicoApp, TrocaPneuApp } from "./types";
import { randomUUID } from "crypto";
import { gerarNumeroFogoSequencial } from "@/lib/numero-fogo";

export async function listVeiculos(search?: string): Promise<Veiculo[]> {
  let q = supabaseManutencao.from("veiculos").select("*").order("codigo_frota");
  if (search) {
    const s = `%${search.toLowerCase()}%`;
    q = q.or(`codigo_frota.ilike.${s},placa.ilike.${s},modelo.ilike.${s}`);
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
 * Fallback: se a RPC não existir (ex.: dev sem migrations aplicadas), volta para o
 * SELECT MAX legado — sem garantia de unicidade sob concorrência.
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

  // Fallback legado (somente quando a RPC não existe). NÃO é seguro sob concorrência.
  if (error && /function .* does not exist/i.test(error.message)) {
    console.warn("[pneus] RPC reservar_contagens_numero_fogo ausente — usando fallback inseguro");
    const placa = normalizePlate(veiculo.placa);
    let query = supabaseManutencao
      .from("numero_fogo")
      .select("contagem")
      .eq("ultimo_digito_ano", digitoAno)
      .order("contagem", { ascending: false })
      .limit(1);
    if (veiculo.codigo_frota) query = query.eq("frota", veiculo.codigo_frota);
    else if (placa) query = query.eq("placa", placa);
    const { data: rows, error: fbErr } = await query;
    if (fbErr) throw new Error(`reservarContagemNumeroFogo fallback: ${fbErr.message}`);
    const ultima = Number(rows?.[0]?.contagem ?? 0);
    return Number.isFinite(ultima) && ultima > 0 ? Math.floor(ultima) + 1 : 1;
  }

  throw new Error(`reservarContagemNumeroFogo: ${error?.message ?? "sem retorno"}`);
}

export async function listUltimaContagemNumeroFogoPorFrota(
  ano = new Date().getFullYear()
): Promise<Record<string, number>> {
  const digitoAno = String(ano).slice(-1);
  const { data, error } = await supabaseManutencao
    .from("numero_fogo")
    .select("frota, contagem")
    .eq("ultimo_digito_ano", digitoAno)
    .not("frota", "is", null)
    .order("contagem", { ascending: false })
    .limit(5000);

  if (error) throw new Error(`listUltimaContagemNumeroFogoPorFrota: ${error.message}`);

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const frota = String(row.frota ?? "").trim();
    const contagem = Number(row.contagem ?? 0);
    if (frota && result[frota] == null && Number.isFinite(contagem)) {
      result[frota] = Math.max(0, Math.floor(contagem));
    }
  }
  return result;
}

export interface TrocaPneuInput {
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

  const idServico = randomUUID();
  const { error: errServico } = await supabaseManutencao.from("servicos_app").insert({
    id_servico: idServico,
    id_veiculo: veiculo.codigo_frota,
    tipo_servico: "troca_pneu",
    quilometragem: input.quilometragem,
    observacoes: input.observacoes ?? null,
    registrado_por_email: input.registrado_por_email,
    registrado_por_nome: input.registrado_por_nome,
  });
  if (errServico) throw new Error(`registrarTrocaPneu: ${errServico.message}`);

  const trocas = posicoes.map((p) => ({
    id_servico: idServico,
    posicao: p.posicao,
    numero_fogo: p.numero_fogo,
    quilometragem: input.quilometragem,
  }));

  const { error: errTrocas } = await supabaseManutencao.from("trocas_pneus_app").insert(trocas);
  if (errTrocas) {
    await supabaseManutencao.from("servicos_app").delete().eq("id_servico", idServico);
    throw new Error(`registrarTrocaPneu trocas: ${errTrocas.message}`);
  }

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

  const { error: errNumeroFogo } = await supabaseManutencao.from("numero_fogo").insert(numerosFogo);
  if (errNumeroFogo) {
    await supabaseManutencao.from("trocas_pneus_app").delete().eq("id_servico", idServico);
    await supabaseManutencao.from("servicos_app").delete().eq("id_servico", idServico);
    throw new Error(`registrarTrocaPneu numero_fogo: ${errNumeroFogo.message}`);
  }

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
