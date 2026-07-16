import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

const supabaseUrl = new URL(requiredEnv("SUPABASE_MANUTENCAO_URL"));
if (!["https:", "http:"].includes(supabaseUrl.protocol)) {
  throw new Error("SUPABASE_MANUTENCAO_URL deve usar HTTP(S).");
}

const supabaseManutencao = createClient(
  supabaseUrl.toString().replace(/\/$/, ""),
  requiredEnv("SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  console.log("1) Conectando no Supabase...");
  const { count, error } = await supabaseManutencao
    .from("veiculos")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  console.log(`   ok - ${count ?? 0} veiculos cadastrados`);

  console.log("2) Validando tabelas operacionais...");
  const tables = [
    "checklists_frota",
    "historico_km_frota",
    "movimentacoes_frota",
    "abastecimentos_frota",
    "unidades_operacionais",
    "email_logs",
  ];

  for (const table of tables) {
    const { error: tableError } = await supabaseManutencao
      .from(table)
      .select("*", { count: "exact", head: true });
    if (tableError) throw tableError;
    console.log(`   ok - ${table}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERRO:", error);
    process.exit(1);
  });
