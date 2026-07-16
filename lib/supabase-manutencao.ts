import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requiredEnv, requiredUrlEnv } from "@/lib/env";

const url = requiredUrlEnv("SUPABASE_MANUTENCAO_URL");
const key = requiredEnv("SUPABASE_MANUTENCAO_SERVICE_ROLE_KEY");

export const supabaseManutencao = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
