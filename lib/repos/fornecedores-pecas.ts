import "server-only";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type FornecedorPecas = {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
};

export type NovoFornecedorInput = {
  nome: string;
  email: string;
};

export function normalizeFornecedorInput(input: NovoFornecedorInput): NovoFornecedorInput {
  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
  };
}

export function dedupeNovosFornecedores(novos: NovoFornecedorInput[]): NovoFornecedorInput[] {
  const seen = new Set<string>();
  const result: NovoFornecedorInput[] = [];
  for (const novo of novos) {
    const normalizado = normalizeFornecedorInput(novo);
    if (seen.has(normalizado.email)) continue;
    seen.add(normalizado.email);
    result.push(normalizado);
  }
  return result;
}

const FORNECEDOR_SELECT = "id,nome,email,ativo,ordem,criado_em,atualizado_em";

function fromRow(row: Omit<FornecedorPecas, "id" | "ordem"> & { id: number | string; ordem: number | string }): FornecedorPecas {
  return { ...row, id: Number(row.id), ordem: Number(row.ordem) };
}

export async function listFornecedoresPecas(options: { ativo?: boolean } = {}): Promise<FornecedorPecas[]> {
  let query = supabaseManutencao.from("fornecedores_pecas").select(FORNECEDOR_SELECT).order("ordem").order("id");
  if (options.ativo !== undefined) query = query.eq("ativo", options.ativo);
  const { data, error } = await query;
  if (error) throw new Error(`listFornecedoresPecas: ${error.message}`);
  return (data ?? []).map(fromRow);
}

export async function criarFornecedorPecas(input: NovoFornecedorInput): Promise<FornecedorPecas> {
  const normalizado = normalizeFornecedorInput(input);
  const { data, error } = await supabaseManutencao
    .from("fornecedores_pecas")
    .upsert(
      { nome: normalizado.nome, email: normalizado.email, ativo: true },
      { onConflict: "email" }
    )
    .select(FORNECEDOR_SELECT)
    .single();
  if (error) throw new Error(`criarFornecedorPecas: ${error.message}`);
  return fromRow(data);
}

export async function atualizarFornecedorPecas(
  id: number,
  input: { nome: string; email: string; ativo: boolean }
): Promise<void> {
  const normalizado = normalizeFornecedorInput(input);
  const { error } = await supabaseManutencao
    .from("fornecedores_pecas")
    .update({ nome: normalizado.nome, email: normalizado.email, ativo: input.ativo })
    .eq("id", id);
  if (error) throw new Error(`atualizarFornecedorPecas: ${error.message}`);
}
