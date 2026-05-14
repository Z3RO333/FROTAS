import "dotenv/config";
import { randomUUID } from "node:crypto";
import { runStaging } from "./00-staging";
import { runKm } from "./01-km";
import { runLavagem } from "./02-lavagem";
import { runBateria } from "./03-bateria";
import { runKitSeguranca } from "./04-kit-seguranca";
import { runEstepes } from "./05-estepes";
import { runDisponibilidade } from "./06-disponibilidade";
import { runAlinhamento } from "./07-alinhamento";
import { runPneus } from "./08-pneus";
import { runTacografo } from "./09-tacografo";
import { runFrotasParadas } from "./10-frotas-paradas";

(async () => {
  const batchId = randomUUID();
  console.log(`\n=== PLANEJAMENTO IMPORT ===`);
  console.log(`batch_id: ${batchId}\n`);

  await runStaging(batchId);
  await runKm(batchId);
  await runLavagem(batchId);
  await runBateria(batchId);
  await runKitSeguranca(batchId);
  await runEstepes(batchId);
  await runDisponibilidade(batchId);
  await runAlinhamento(batchId);
  await runPneus(batchId);
  await runTacografo(batchId);
  await runFrotasParadas(batchId);

  console.log("\n=== CONCLUÍDO ===");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
