import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { Veiculo, ServicoApp, TrocaPneuApp } from "./types";
import { randomUUID } from "crypto";

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

export interface TrocaPneuInput {
  id_veiculo: string;
  quilometragem: number;
  observacoes?: string;
  posicoes: Array<{ posicao: string; numero_fogo?: string }>;
  registrado_por_email: string;
  registrado_por_nome: string;
}

export async function registrarTrocaPneu(input: TrocaPneuInput): Promise<string> {
  const idServico = randomUUID();
  const { error: errServico } = await supabaseManutencao.from("servicos_app").insert({
    id_servico: idServico,
    id_veiculo: input.id_veiculo,
    tipo_servico: "troca_pneu",
    quilometragem: input.quilometragem,
    observacoes: input.observacoes ?? null,
    registrado_por_email: input.registrado_por_email,
    registrado_por_nome: input.registrado_por_nome,
  });
  if (errServico) throw new Error(`registrarTrocaPneu: ${errServico.message}`);

  const trocas = input.posicoes.map((p) => ({
    id_servico: idServico,
    posicao: p.posicao,
    numero_fogo: p.numero_fogo ?? null,
    quilometragem: input.quilometragem,
  }));
  const { error: errTrocas } = await supabaseManutencao.from("trocas_pneus_app").insert(trocas);
  if (errTrocas) throw new Error(`registrarTrocaPneu trocas: ${errTrocas.message}`);
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
