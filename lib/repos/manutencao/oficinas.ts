import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { OficinasApp } from "./types";

export async function listOficinas(apenasAtivas = true): Promise<OficinasApp[]> {
  let q = supabaseManutencao.from("operacao_oficinas_app").select("*").order("nome");
  if (apenasAtivas) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw new Error(`listOficinas: ${error.message}`);
  return (data ?? []) as OficinasApp[];
}

export async function criarOficina(input: {
  nome: string;
  categoria: string;
  localizacao: string;
  localizacao_lat?: number;
  localizacao_lng?: number;
  tipos_servico: string[];
}): Promise<number> {
  const { data, error } = await supabaseManutencao
    .from("operacao_oficinas_app")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(`criarOficina: ${error.message}`);
  return data.id as number;
}
