import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const ORIGEM_URL = "https://llullmnpyafsdarpwezs.supabase.co";
const DESTINO_URL = process.env.SUPABASE_MANUTENCAO_URL!;

const origem = createClient(ORIGEM_URL, process.env.SUPABASE_DOCS_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const destino = createClient(DESTINO_URL, process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  if (!process.env.SUPABASE_DOCS_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_DOCS_SERVICE_ROLE_KEY não definida no .env");
    process.exit(1);
  }
  if (!process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY não definida no .env");
    process.exit(1);
  }

  console.log("=== Migração consulta-documentos → plataforma unificada ===");
  console.log(`  Origem: ${ORIGEM_URL}`);
  console.log(`  Destino: ${DESTINO_URL}\n`);

  console.log("→ Migrando documents...");
  let offset = 0;
  let total = 0;
  let erros = 0;

  while (true) {
    const { data, error } = await origem
      .from("documents")
      .select("id,frota,placa,modelo,dut_url,crlv_url,created_at")
      .range(offset, offset + 999);

    if (error) { console.error(`Erro: ${error.message}`); break; }
    if (!data || data.length === 0) break;

    // created_by era uuid ref para auth.users — descartado na migração
    const rows = data.map((d) => ({ ...d, created_by: null }));

    const { error: ei } = await destino
      .from("documents")
      .upsert(rows, { onConflict: "id" });

    if (ei) {
      console.warn(`  Erro no lote: ${ei.message}`);
      for (const row of rows) {
        const { error: e } = await destino.from("documents").upsert(row, { onConflict: "id" });
        if (e) { console.warn(`  Skip: ${e.message}`); erros++; }
        else total++;
      }
    } else {
      total += data.length;
    }

    offset += 1000;
    if (data.length < 1000) break;
  }

  const status = erros > 0 ? `${total} ok, ${erros} erros` : `${total} ok`;
  console.log(`  ✓ documents: ${status}`);

  console.log("\n⚠️  Arquivos do Storage (DUT/CRLV) precisam de migração manual:");
  console.log("   1. Baixar do bucket 'documents' em llullmnpyafsdarpwezs");
  console.log("   2. Re-upload para bucket 'documents' em nwoqastjgkgsifmxdqwp");

  console.log("\n✅ Migração de documentos concluída.");
}

main().catch((e) => { console.error(e); process.exit(1); });
