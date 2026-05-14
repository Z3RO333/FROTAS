import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const ORIGEM_URL = "https://llullmnpyafsdarpwezs.supabase.co";
const DESTINO_URL = process.env.SUPABASE_MANUTENCAO_URL!;
const BUCKET = "documents";

const origem = createClient(ORIGEM_URL, process.env.SUPABASE_DOCS_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const destino = createClient(DESTINO_URL, process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllFiles(prefix = ""): Promise<string[]> {
  const { data, error } = await origem.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
  });

  if (error) {
    console.error(`  Erro ao listar ${prefix || "raiz"}: ${error.message}`);
    return [];
  }
  if (!data) return [];

  const paths: string[] = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.metadata) {
      // É um arquivo
      paths.push(fullPath);
    } else {
      // É uma pasta — listar recursivamente
      const subPaths = await listAllFiles(fullPath);
      paths.push(...subPaths);
    }
  }
  return paths;
}

async function migrateFile(path: string): Promise<boolean> {
  // Download da origem
  const { data: blob, error: errDown } = await origem.storage
    .from(BUCKET)
    .download(path);

  if (errDown || !blob) {
    console.warn(`  ✗ ${path}: ${errDown?.message ?? "sem dados"}`);
    return false;
  }

  // Upload no destino
  const arrayBuffer = await blob.arrayBuffer();
  const { error: errUp } = await destino.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: blob.type || "application/octet-stream",
      upsert: true,
    });

  if (errUp) {
    console.warn(`  ✗ ${path}: ${errUp.message}`);
    return false;
  }

  return true;
}

async function main() {
  if (!process.env.SUPABASE_DOCS_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_DOCS_SERVICE_ROLE_KEY não definida");
    process.exit(1);
  }
  if (!process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY não definida");
    process.exit(1);
  }

  console.log("=== Migração Storage: DUT/CRLV ===");
  console.log(`  Origem:  ${ORIGEM_URL}/storage/v1/object/${BUCKET}`);
  console.log(`  Destino: ${DESTINO_URL}/storage/v1/object/${BUCKET}\n`);

  console.log("→ Listando arquivos...");
  const files = await listAllFiles();
  console.log(`  ${files.length} arquivo(s) encontrado(s)\n`);

  if (files.length === 0) {
    console.log("✅ Nenhum arquivo para migrar.");
    return;
  }

  let ok = 0;
  let erros = 0;

  for (let i = 0; i < files.length; i++) {
    const path = files[i];
    process.stdout.write(`  [${i + 1}/${files.length}] ${path} ... `);
    const success = await migrateFile(path);
    if (success) {
      process.stdout.write("✓\n");
      ok++;
    } else {
      erros++;
    }
  }

  console.log(`\n✅ Storage migrado: ${ok} ok${erros > 0 ? `, ${erros} erros` : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
