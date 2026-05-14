import "dotenv/config";
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["supabase", "db", "push"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("Nao foi possivel executar Supabase CLI:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
