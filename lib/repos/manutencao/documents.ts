import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { validatePdfFile } from "@/lib/upload-validation";
import type { DocumentRecord, DocumentRecordWithSignedUrls } from "./types";

const T = "documents";
const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 15;

export type DocumentUpsertInput = Pick<DocumentRecord, "frota" | "placa" | "modelo"> & {
  dut_url?: string | null;
  crlv_url?: string | null;
};

export async function listDocuments(filters: {
  frota?: string;
  placa?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ rows: DocumentRecordWithSignedUrls[]; total: number }> {
  const { frota, placa, page = 1, pageSize = 25 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabaseManutencao.from(T).select("*", { count: "exact" });
  if (frota) q = q.eq("frota", frota);
  if (placa) q = q.eq("placa", placa);

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`listDocuments: ${error.message}`);
  const rows = await Promise.all(((data ?? []) as DocumentRecord[]).map(withSignedUrls));
  return { rows, total: count ?? 0 };
}

// A tela de Documentos (components/documentos/documentos-workspace.tsx) filtra e
// soma os contadores (completos/parciais/sem DUT/sem CRLV) em memória sobre todo
// o conjunto — não tem paginação na UI —, então precisa de todas as linhas, não
// só a primeira página.
export async function listAllDocuments(): Promise<DocumentRecordWithSignedUrls[]> {
  const rows: DocumentRecord[] = [];
  const chunkSize = 1000;
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabaseManutencao
      .from(T)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + chunkSize - 1);
    if (error) throw new Error(`listAllDocuments: ${error.message}`);
    const chunk = (data ?? []) as DocumentRecord[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }
  return Promise.all(rows.map(withSignedUrls));
}

export async function createDocument(
  input: DocumentUpsertInput,
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
  input: Partial<DocumentUpsertInput>
): Promise<void> {
  const { error } = await supabaseManutencao.from(T).update(input).eq("id", id);
  if (error) throw new Error(`updateDocument: ${error.message}`);
}

export async function deleteDocument(id: string): Promise<void> {
  const current = await getDocumentById(id);
  const { error } = await supabaseManutencao.from(T).delete().eq("id", id);
  if (error) throw new Error(`deleteDocument: ${error.message}`);
  if (current) {
    await removeDocumentFiles([current.dut_url, current.crlv_url]).catch((storageError) => {
      console.error("[documents] registro removido, mas arquivos antigos ficaram órfãos", storageError);
    });
  }
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const { data, error } = await supabaseManutencao.from(T).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getDocumentById: ${error.message}`);
  return (data as DocumentRecord | null) ?? null;
}

// frota+placa (já normalizada, ver normalizePlate em app/(app)/documentos/_actions.ts) já tem
// registro? Usado no "Enviar PDFs" pra atualizar em vez de duplicar (era o bug que gerava
// linhas repetidas na Central de Documentos — mesma frota com CRLV numa linha e DUT noutra).
export async function getDocumentByFrotaPlaca(frota: string, placaNormalizada: string): Promise<DocumentRecord | null> {
  const { data, error } = await supabaseManutencao
    .from(T)
    .select("*")
    .eq("frota", frota)
    .eq("placa", placaNormalizada)
    .maybeSingle();
  if (error) throw new Error(`getDocumentByFrotaPlaca: ${error.message}`);
  return (data as DocumentRecord | null) ?? null;
}

export async function uploadDocumentFile(file: File, placa: string, kind: "dut" | "crlv"): Promise<string> {
  await validatePdfFile(file, kind.toUpperCase());

  const plateSegment = toStorageSegment(placa);
  if (!plateSegment) throw new Error("Placa invalida para gerar caminho de armazenamento.");

  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const path = `${plateSegment}/${kind}-${unique}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseManutencao.storage.from(DOCUMENTS_BUCKET).upload(path, buffer, {
    cacheControl: "3600",
    contentType: "application/pdf",
    upsert: false,
  });

  if (error) throw new Error(`uploadDocumentFile: ${error.message}`);
  return path;
}

export async function replaceDocumentFiles(
  current: DocumentRecord,
  files: { dut?: File | null; crlv?: File | null },
  placa: string
): Promise<{ dut_url?: string | null; crlv_url?: string | null; uploadedPaths: string[]; oldPaths: Array<string | null> }> {
  const uploadedPaths: string[] = [];
  const oldPaths: Array<string | null> = [];
  const updates: { dut_url?: string | null; crlv_url?: string | null } = {};

  try {
    if (files.dut) {
      const path = await uploadDocumentFile(files.dut, placa, "dut");
      uploadedPaths.push(path);
      oldPaths.push(current.dut_url);
      updates.dut_url = path;
    }

    if (files.crlv) {
      const path = await uploadDocumentFile(files.crlv, placa, "crlv");
      uploadedPaths.push(path);
      oldPaths.push(current.crlv_url);
      updates.crlv_url = path;
    }
  } catch (error) {
    await removeDocumentFiles(uploadedPaths).catch((cleanupError) => {
      console.error("[documents] falha ao limpar upload parcial", cleanupError);
    });
    throw error;
  }

  return { ...updates, uploadedPaths, oldPaths };
}

export async function removeDocumentFiles(paths: Array<string | null | undefined>): Promise<void> {
  const storagePaths = paths
    .map(normalizeDocumentStoragePath)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length === 0) return;

  const { error } = await supabaseManutencao.storage.from(DOCUMENTS_BUCKET).remove(storagePaths);
  if (error) throw new Error(`removeDocumentFiles: ${error.message}`);
}

async function withSignedUrls(doc: DocumentRecord): Promise<DocumentRecordWithSignedUrls> {
  const [dutSignedUrl, crlvSignedUrl] = await Promise.all([
    createSignedDocumentUrl(doc.dut_url),
    createSignedDocumentUrl(doc.crlv_url),
  ]);

  return {
    ...doc,
    dut_signed_url: dutSignedUrl,
    crlv_signed_url: crlvSignedUrl,
  };
}

async function createSignedDocumentUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;

  const path = normalizeDocumentStoragePath(pathOrUrl);
  if (!path) return null;

  const { data, error } = await supabaseManutencao.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS, {
      download: path.split("/").at(-1) ?? "documento.pdf",
    });

  if (error) return null;
  return data?.signedUrl ?? null;
}

export function normalizeDocumentStoragePath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const value = pathOrUrl.trim();
  if (!value) return null;

  if (!isHttpUrl(value)) return value.replace(/^\/+/, "");

  try {
    const url = new URL(value);
    const markers = [
      `/storage/v1/object/public/${DOCUMENTS_BUCKET}/`,
      `/storage/v1/object/sign/${DOCUMENTS_BUCKET}/`,
    ];
    const marker = markers.find((item) => url.pathname.includes(item));
    if (!marker) return null;
    return decodeURIComponent(url.pathname.split(marker)[1] ?? "").replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

function toStorageSegment(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
