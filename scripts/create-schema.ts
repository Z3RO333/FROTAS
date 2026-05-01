import "dotenv/config";
import { execute } from "../lib/db";

const SCHEMA = "manutencao.cd";

const ddl = [
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.frotas (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_geral STRING,
    placa STRING,
    modelo STRING,
    chassi STRING,
    renavam STRING,
    ano_fabricacao INT,
    localizacao STRING,
    km_atual BIGINT,
    status STRING,
    observacoes STRING,
    vendido BOOLEAN,
    ano_venda INT,
    ativo BOOLEAN,
    criado_em TIMESTAMP,
    atualizado_em TIMESTAMP,
    atualizado_por STRING
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.frotas_historico (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    campo STRING,
    valor_antigo STRING,
    valor_novo STRING,
    alterado_em TIMESTAMP,
    alterado_por STRING
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.email_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    tipo STRING,
    frota_id BIGINT,
    destinatarios STRING,
    assunto STRING,
    enviado_em TIMESTAMP,
    enviado_por STRING,
    status STRING,
    erro_msg STRING
  ) USING DELTA`,
];

(async () => {
  for (const stmt of ddl) {
    console.log("Executing:", stmt.split("\n")[0]);
    await execute(stmt);
  }
  console.log("✓ Schema criado com sucesso");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
