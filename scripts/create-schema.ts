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

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.usuarios (
    id STRING,
    nome STRING,
    email STRING,
    matricula STRING,
    perfil STRING,
    ativo BOOLEAN,
    criado_em TIMESTAMP,
    atualizado_em TIMESTAMP
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.checklists_frota (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    motorista_id STRING,
    motorista_nome STRING,
    data_checklist TIMESTAMP,
    km_informado BIGINT,
    km_lido_ocr BIGINT,
    ocr_confianca DOUBLE,
    km_confirmado BOOLEAN,
    foto_km_url STRING,
    status_geral STRING,
    observacao_original STRING,
    observacao_corrigida_ia STRING,
    criado_em TIMESTAMP
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.checklist_itens (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    checklist_id BIGINT,
    item_codigo STRING,
    item_nome STRING,
    grupo STRING,
    status STRING,
    obrigatorio BOOLEAN,
    critico BOOLEAN,
    observacao STRING,
    foto_url STRING
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.pendencias_frota (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    checklist_id BIGINT,
    item_nome STRING,
    gravidade STRING,
    status STRING,
    responsavel_id STRING,
    criado_em TIMESTAMP,
    resolvido_em TIMESTAMP
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.anexos_checklist (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    checklist_id BIGINT,
    checklist_item_id BIGINT,
    tipo STRING,
    nome_arquivo STRING,
    mime_type STRING,
    tamanho_bytes BIGINT,
    storage_url STRING,
    criado_em TIMESTAMP
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.historico_status_frota (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    status_antigo STRING,
    status_novo STRING,
    motivo STRING,
    alterado_em TIMESTAMP,
    alterado_por STRING
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.movimentacoes_frota (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    motorista_id STRING,
    checklist_id BIGINT,
    tipo_movimentacao STRING,
    data_hora TIMESTAMP,
    usuario_portaria_id STRING,
    observacao STRING,
    criado_em TIMESTAMP
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.historico_km_frota (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    checklist_id BIGINT,
    motorista_id STRING,
    motorista_nome STRING,
    km_anterior BIGINT,
    km_novo BIGINT,
    diferenca_km BIGINT,
    origem STRING,
    foto_km_url STRING,
    validado BOOLEAN,
    validado_por STRING,
    validado_em TIMESTAMP,
    observacao_validacao STRING,
    criado_em TIMESTAMP
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.abastecimentos_frota (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    frota_id BIGINT,
    motorista_id STRING,
    motorista_nome STRING,
    checklist_id BIGINT,
    data_hora TIMESTAMP,
    tipo_combustivel STRING,
    litros_combustivel DOUBLE,
    litros_arla DOUBLE,
    km_no_abastecimento BIGINT,
    foto_comprovante_url STRING,
    origem STRING,
    criado_em TIMESTAMP
  ) USING DELTA`,

  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.unidades_operacionais (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    uf STRING,
    negocio STRING,
    loja STRING,
    centro STRING,
    centro_custo STRING,
    local_negocio STRING,
    cnpj STRING,
    inscricao_estadual STRING,
    inscricao_suframa STRING,
    inscricao_municipal STRING,
    cep STRING,
    endereco STRING,
    ie_subst_tributario STRING,
    origem_arquivo STRING,
    importado_em TIMESTAMP
  ) USING DELTA`,
];

const alters: string[] = [
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (km_origem STRING)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (km_atualizado_em TIMESTAMP)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (km_validado BOOLEAN)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (ultimo_checklist_id BIGINT)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (ultimo_checklist_em TIMESTAMP)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (ultimo_motorista_id STRING)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (ultimo_motorista_nome STRING)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (ultimo_abastecimento_em TIMESTAMP)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (ultimo_abastecimento_litros DOUBLE)`,
  `ALTER TABLE ${SCHEMA}.frotas ADD COLUMNS (status_operacional STRING)`,
];

(async () => {
  for (const stmt of ddl) {
    console.log("Executing:", stmt.split("\n")[0]);
    await execute(stmt);
  }
  for (const stmt of alters) {
    console.log("Altering:", stmt);
    try {
      await execute(stmt);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/already exists|FIELDS_ALREADY_EXISTS|DELTA_ADD_COLUMN_PARENT_NOT_STRUCT|DUPLICATE_COLUMN/i.test(msg)) {
        console.log("  -> coluna ja existe, ignorando");
        continue;
      }
      throw error;
    }
  }
  console.log("✓ Schema criado com sucesso");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
