// scripts/backfill-crlv-ocr.ts
//
// Roda a leitura de CRLV por IA sobre todos os documentos já cadastrados na
// Central de Documentos, corrigindo a data de vencimento digitada manualmente
// (ou preenchendo quando estava vazia). Uso: npx tsx scripts/backfill-crlv-ocr.ts
import "dotenv/config";
import { supabaseManutencao } from "../lib/supabase-manutencao";
import { readCrlvVencimento } from "../lib/ai/crlv-ocr";
import { resolveCrlvVencimento } from "../lib/ai/resolve-crlv-vencimento";

const DOCUMENTS_BUCKET = "documents";

type DocumentoParaBackfill = {
  id: string;
  frota: string;
  crlv_url: string | null;
  crlv_vencimento: string | null;
};

async function listarDocumentosComCrlv(): Promise<DocumentoParaBackfill[]> {
  const { data, error } = await supabaseManutencao
    .from("documents")
    .select("id,frota,crlv_url,crlv_vencimento")
    .not("crlv_url", "is", null);
  if (error) throw new Error(`Erro ao listar documentos: ${error.message}`);
  return (data ?? []) as DocumentoParaBackfill[];
}

async function baixarCrlv(path: string): Promise<Buffer | null> {
  const { data, error } = await supabaseManutencao.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) {
    console.error(`  falha ao baixar ${path}: ${error?.message ?? "sem dados"}`);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

async function main() {
  const documentos = await listarDocumentosComCrlv();
  console.log(`${documentos.length} documento(s) com CRLV encontrados.`);

  let atualizados = 0;
  let paraRevisao = 0;
  let falhasDownload = 0;

  for (const doc of documentos) {
    if (!doc.crlv_url) continue;

    const buffer = await baixarCrlv(doc.crlv_url);
    if (!buffer) {
      falhasDownload += 1;
      continue;
    }

    const reading = await readCrlvVencimento(buffer);
    const resolved = resolveCrlvVencimento(reading, doc.crlv_vencimento);

    const { error } = await supabaseManutencao.from("documents").update(resolved).eq("id", doc.id);
    if (error) {
      console.error(`  frota ${doc.frota}: falha ao atualizar — ${error.message}`);
      continue;
    }

    if (resolved.crlv_vencimento_origem === "IA") {
      atualizados += 1;
      console.log(`  frota ${doc.frota}: OK — vencimento ${resolved.crlv_vencimento} (confiança ${reading.confianca})`);
    } else {
      paraRevisao += 1;
      console.log(`  frota ${doc.frota}: marcado para revisão manual (${reading.motivo ?? "confiança baixa"})`);
    }
  }

  console.log("\n--- Resumo ---");
  console.log(`Atualizados pela IA: ${atualizados}`);
  console.log(`Marcados para revisão manual: ${paraRevisao}`);
  console.log(`Falhas de download: ${falhasDownload}`);
}

main().catch((error) => {
  console.error("Backfill falhou:", error);
  process.exit(1);
});
