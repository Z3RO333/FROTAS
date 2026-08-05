import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

// Fixup pontual: 3 frotas (115, 134, 258) tinham placa com erro de digitação
// num upload recente, gerando uma segunda linha em vez de atualizar a
// existente (mesmo bug corrigido em app/(app)/documentos/_actions.ts).
// Diferente de scripts/merge-duplicate-documents.ts, aqui a placa correta foi
// confirmada contra o cadastro oficial em veiculos.codigo_frota antes de mesclar.

const URL = process.env.SUPABASE_MANUTENCAO_URL!;
const KEY = process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!;
const BUCKET = "documents";
const APPLY = process.argv.includes("--apply");

const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const FIXES = [
  {
    frota: "115",
    keepId: "11791aad-7f6f-4ca5-828a-10237866f14e",
    correctPlaca: "PHR3268",
    newestCrlvUrl: "PHR3C68/crlv-1785867572522-01fbc7d5-68fd-4ffc-a28c-848020301469.pdf",
    deleteId: "e363c7bd-beab-4baa-85e4-d874cfd922cb",
    orphanFile: "documents/PHR3268/crlv-ecca4a10-7f66-459a-9b42-e984b16eaf3f.pdf",
  },
  {
    frota: "134",
    keepId: "0a2d512b-c20e-498a-8901-b593ee298b93",
    correctPlaca: "QZC9G98",
    newestCrlvUrl: null, // já é o mais novo, não precisa trocar
    deleteId: "d4aa5e4f-8be9-4810-8065-d724feb95a15",
    orphanFile: "documents/QZC9H28/crlv-0fd51862-6aa4-472e-86b4-d80244ab5306.pdf",
  },
  {
    frota: "258",
    keepId: "ae7b31c3-9909-4ad9-ba92-b497ee550899",
    correctPlaca: "TAF3F98",
    newestCrlvUrl: "TAF3F9/crlv-1785952602174-9a16c9f1-2263-459d-b5f1-ba1a68912cee.pdf",
    deleteId: "a615326a-5bf1-4404-b267-3bf6c823be8d",
    orphanFile: "TAF-3F98/crlv-1785269769517-618ffca0-695e-440b-a6f8-e9d7d8725724.pdf",
  },
];

async function main() {
  console.log(`Modo: ${APPLY ? "APLICANDO mudanças" : "DRY-RUN — use --apply para executar"}\n`);

  for (const fix of FIXES) {
    console.log(
      `[frota ${fix.frota}] mantém ${fix.keepId} com placa ${fix.correctPlaca}` +
        (fix.newestCrlvUrl ? ` (troca CRLV pelo mais recente)` : "") +
        ` — remove ${fix.deleteId} e ${fix.orphanFile}`
    );

    if (!APPLY) continue;

    const update: Record<string, string> = { placa: fix.correctPlaca, updated_at: new Date().toISOString() };
    if (fix.newestCrlvUrl) update.crlv_url = fix.newestCrlvUrl;

    const { error: updError } = await supabase.from("documents").update(update).eq("id", fix.keepId);
    if (updError) {
      console.error(`  Erro ao atualizar ${fix.keepId}: ${updError.message}`);
      continue;
    }

    const { error: delError } = await supabase.from("documents").delete().eq("id", fix.deleteId);
    if (delError) {
      console.error(`  Erro ao apagar ${fix.deleteId}: ${delError.message}`);
      continue;
    }

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([fix.orphanFile]);
    if (storageError) {
      console.error(`  Erro ao remover arquivo órfão ${fix.orphanFile}: ${storageError.message}`);
    }
  }

  console.log(`\n${APPLY ? "Concluído." : "Simulação concluída."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
