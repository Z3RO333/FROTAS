import "dotenv/config";
import { query } from "../lib/db";

(async () => {
  console.log("Aquecendo warehouse...");
  const r = await query<{ n: number }>("SELECT COUNT(*) AS n FROM manutencao.cd.frotas");
  console.log(`Warehouse OK — ${r[0]?.n ?? 0} frotas no banco`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
