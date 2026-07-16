import "server-only";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export async function consumeRateLimit(args: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const { data, error } = await supabaseManutencao.rpc("consume_api_rate_limit", {
    p_rate_key: args.key,
    p_limit: args.limit,
    p_window_seconds: args.windowSeconds,
  });
  if (error) throw new Error(`consumeRateLimit: ${error.message}`);
  return data === true;
}

