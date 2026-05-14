import "dotenv/config";
import { supabaseManutencao } from "../lib/supabase-manutencao";

(async () => {
  console.log("Aquecendo conexao Supabase...");
  const { count, error } = await supabaseManutencao
    .from("veiculos")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  console.log(`Supabase OK - ${count ?? 0} veiculos no banco`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
