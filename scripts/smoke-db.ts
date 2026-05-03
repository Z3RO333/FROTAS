import "dotenv/config";
import { query } from "../lib/db";

async function main() {
  console.log("1) SELECT sem parâmetros...");
  const a = await query<{ n: number }>(`SELECT 1 AS n`);
  console.log("   ok →", a[0]);

  console.log("2) SELECT com 1 parâmetro string...");
  const probe = "test'\\'-injection-attempt-- /*";
  const b = await query<{ s: string }>(`SELECT ? AS s`, [probe]);
  console.log("   enviado :", probe);
  console.log("   recebido:", b[0]?.s);
  console.log("   match   :", b[0]?.s === probe ? "✓" : "✗");

  console.log("3) SELECT com múltiplos parâmetros (number + string)...");
  const c = await query<{ id: number; label: string }>(`SELECT ? AS id, ? AS label`, [42, "fr_test"]);
  console.log("   ok →", c[0]);

  console.log("4) Query real na tabela frotas com filtro parametrizado...");
  const d = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM manutencao.cd.frotas WHERE ativo = ? AND vendido = ?`,
    [true, false]
  );
  console.log("   ok →", d[0]);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERRO:", e);
    process.exit(1);
  });
