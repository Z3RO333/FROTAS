import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_MANUTENCAO_URL;
const key = process.env.SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "SUPABASE_MANUTENCAO_URL e SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY são obrigatórios"
  );
}

export const supabaseManutencao = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
