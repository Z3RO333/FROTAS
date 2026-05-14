import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { DocumentRecord } from "./types";

const T = "documents";

export async function listDocuments(filters: {
  frota?: string;
  placa?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ rows: DocumentRecord[]; total: number }> {
  const { frota, placa, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabaseManutencao.from(T).select("*", { count: "exact" });
  if (frota) q = q.ilike("frota", `%${frota}%`);
  if (placa) q = q.ilike("placa", `%${placa}%`);

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`listDocuments: ${error.message}`);
  return { rows: (data ?? []) as DocumentRecord[], total: count ?? 0 };
}

export async function createDocument(
  input: Omit<DocumentRecord, "id" | "created_at" | "created_by">,
  createdBy: string
): Promise<DocumentRecord> {
  const { data, error } = await supabaseManutencao
    .from(T)
    .insert({ ...input, created_by: createdBy })
    .select()
    .single();
  if (error) throw new Error(`createDocument: ${error.message}`);
  return data as DocumentRecord;
}

export async function updateDocument(
  id: string,
  input: Partial<Pick<DocumentRecord, "frota" | "placa" | "modelo" | "dut_url" | "crlv_url">>
): Promise<void> {
  const { error } = await supabaseManutencao.from(T).update(input).eq("id", id);
  if (error) throw new Error(`updateDocument: ${error.message}`);
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabaseManutencao.from(T).delete().eq("id", id);
  if (error) throw new Error(`deleteDocument: ${error.message}`);
}
