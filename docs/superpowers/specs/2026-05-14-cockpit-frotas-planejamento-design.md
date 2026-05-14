# Cockpit de Frotas — Camada de Dados do PLANEJAMENTO

## Visão geral

Transformar a planilha `PLANEJAMENTO DE MANUTENÇÃO- ATUAL.xlsx` (19 abas) em dados estruturados no Supabase, alimentando dashboards, alertas e relatórios no Cockpit de Frotas.

## Decomposição em sub-projetos

| Sub-projeto | Escopo | Pré-requisito |
|---|---|---|
| **A — Schema + ETL simples** | Migrations + scripts para abas fáceis | Nenhum |
| **B — ETL complexo** | ALINHAMENTO & PREVENTIVA (pivot), MARCAÇÃO DE PNEUS, TACÓGRAFO | A |
| **C — Dashboards UI** | 10 telas de cockpit | A + B |
| **D — IA: Frotas Paradas** | STATUS- parados → análise IA + alertas | A |

---

## Sub-projeto A — Schema + ETL Simples

### Staging layer

**Tabela `staging_excel_importacao`**

Salva cada linha bruta antes de qualquer transformação. Garante rastreabilidade total.

```
id            bigserial PK
batch_id      uuid NOT NULL                    -- agrupa importações do mesmo arquivo
nome_arquivo  text NOT NULL
aba_origem    text NOT NULL
linha_origem  integer NOT NULL
dados_json    jsonb NOT NULL
hash_linha    text NOT NULL                    -- sha256(dados_json) para dedup
importado_em  timestamptz NOT NULL DEFAULT now()
processado    boolean NOT NULL DEFAULT false
```

### Tabelas de dimensão / fato

#### `dim_veiculos_planejamento`
Enriquece `veiculos` com dados do planejamento sem alterar a tabela principal.

```
equipamento   text PK                          -- CÓD EQUIP (750xxx)
frota_numero  text
placa         text
modelo        text
ano           integer
chassi        text
renavam       text
localizacao   text
setor         text
mes_licenciamento text
cidade        text
estado        text
atualizado_em timestamptz
```

#### `fact_km_frota`
Histórico de KM da aba IMPORTKM (24.562 registros).

```
id            bigserial PK
equipamento   text
frota_numero  text
km            integer NOT NULL
importado_em  timestamptz NOT NULL DEFAULT now()
batch_id      uuid
```

#### `fact_lavagem`
Controle de lavagem por veículo (aba Lavagem_2).

```
id            bigserial PK
equipamento   text
placa         text
frota_numero  text
setor         text
data_realizada date
intervalo_dias integer
proxima_data   date
dias_apos      integer
atraso_dias    integer
status         text
powerapps_id   text                            -- para rastreabilidade
batch_id       uuid
```

#### `fact_bateria_garantia`
Controle de bateria (aba Bateria - Garantia).

```
id            bigserial PK
equipamento   text
placa         text
frota_numero  text
setor         text
data_compra   date
modelo_bateria text
loja          text
orcamento     bigint
batch_id      uuid
```

#### `fact_kit_seguranca`
Status do kit de segurança por veículo (aba KIT DE SEGURANÇA).

```
id            bigserial PK
equipamento   text
placa         text
frota_numero  text
setor         text
triangulo_ok  boolean
extintor_ok   boolean
macaco_ok     boolean
chave_roda_ok boolean
data_verificacao date
batch_id      uuid
```

#### `fact_estepes`
Controle de estepes (aba Controle de Estepes).

```
id            bigserial PK
frota_numero  text
placa         text
modelo        text
ano           integer
local         text
setor         text
tem_estepe    boolean
data_verificacao date
batch_id      uuid
```

#### `fact_disponibilidade_diaria`
Disponibilidade total por dia (aba DISPOBILIDADE TOTAL).

```
id            bigserial PK
data          date NOT NULL
total         integer
parados       integer
disponibilidade numeric(5,4)
meta          numeric(5,4)
batch_id      uuid
UNIQUE(data)
```

#### `fact_disponibilidade_tipo_frota`
Disponibilidade por tipo de veículo por dia (aba Disponib. Tipo Frota).

```
id            bigserial PK
data          date NOT NULL
tipo_equipamento text NOT NULL
total         integer
parados       integer
disponibilidade numeric(5,4)
batch_id      uuid
UNIQUE(data, tipo_equipamento)
```

#### `fact_comparativo_ordens`
Comparativo de ordens por período (aba comparativo).

```
id            bigserial PK
data_periodo  date NOT NULL
qtd_ordens    integer
valor_total   numeric(12,2)
batch_id      uuid
```

---

## Sub-projeto B — ETL Complexo

### `fact_manutencao_programada`
Pivotamento da aba ALINHAMENTO E PREVENTIVA (43 colunas → 1 linha por veículo × tipo de serviço).

```
id              bigserial PK
equipamento     text
placa           text
frota_numero    text
local           text
setor           text
tipo_servico    text    -- AR_CONDICIONADO | ALINHAMENTO | PREVENTIVA_MOTOR |
                        --   EMBREAGEM | TACOGRAFO | PORTA_ROOL_UP | SUSPENSAO
data_realizada  date
km_inicial      integer
km_rodados      integer
media_intervalo integer  -- dias ou km conforme tipo
desvio          integer
status          text     -- NO_PRAZO | ATRASADO | PREVENTIVA | VENCIDO
batch_id        uuid
```

### `fact_pneus`
Marcação de pneus normalizada (aba MARCAÇÃO DE PNEUS).

```
id              bigserial PK
equipamento     text
frota_numero    text
km_frota        integer
posicao         text     -- DD | DE | TDE | TDI | TEE | TEI | STEP | etc.
numero_fogo     text
marca           text
dt_montagem     date
dt_atualizado   date
numero_fogo_anterior text
marca_anterior  text
status          text
marcado         boolean
observacoes     text
batch_id        uuid
```

### `fact_documentos_frota`
Tacógrafo + CRLV por veículo (abas FROTAS BEMOLGRU TACÓGRAFO...).

```
id              bigserial PK
equipamento     text
placa           text
frota_numero    text
tipo_documento  text     -- TACOGRAFO | CRLV | DUT
data_realizada  date
media_dias      integer
dias_passados   integer
desvio          integer
data_vencimento date
status          text     -- VENCIDO | NO_PRAZO | PREVENTIVA
link_documento  text
localizacao     text
batch_id        uuid
```

---

## Sub-projeto D — IA: Frotas Paradas

### `fact_frotas_paradas`
Frotas em manutenção/paradas (aba STATUS- parados).

```
id              bigserial PK
frota_numero    text
placa           text
descricao_original text NOT NULL      -- texto ORIGINAL preservado
servicos        text
classificacao   text
oficina         text
proxima_programacao date
inicio_em       date
prev_saida      date
setor           text
status          text
batch_id        uuid
-- campos IA (nunca sobrescrevem original)
ia_texto_corrigido text
ia_classificacao   text
ia_criticidade     text              -- BAIXA | MEDIA | ALTA | CRITICA
ia_acao_recomendada text
ia_justificativa   text
ia_analisado_em    timestamptz
```

---

## Regras de transformação

### Datas (serial Excel → date)
```
data = new Date(Math.round((serial - 25569) * 86400 * 1000))
```
Excel epoch: 1 Jan 1900 = serial 1 (com bug intencional do Lotus 123: 1900 é tratado como bissexto).

### Limpeza de valores
- `"-"`, `" "`, `""`, `"N/A"` → `null`
- Whitespace em status: `"NO PRAZO "` → `"NO_PRAZO"`, `" NO PRAZO"` → `"NO_PRAZO"`
- Placa: remover espaços e hífens, uppercase: `"NDC 7103"` → `"NDC7103"`
- Setor: trim + uppercase

### Deduplicação
- `hash_linha = SHA256(JSON.stringify(dados_json))` no staging
- Não reimportar linha com mesmo `(batch_id, aba_origem, hash_linha)`

---

## Scripts de importação

Cada script TypeScript em `scripts/import-planejamento/`:

```
scripts/import-planejamento/
  00-staging.ts          -- carrega TODAS as abas no staging
  01-km.ts               -- IMPORTKM → fact_km_frota
  02-lavagem.ts          -- Lavagem_2 → fact_lavagem
  03-bateria.ts          -- Bateria - Garantia → fact_bateria_garantia
  04-kit-seguranca.ts    -- KIT DE SEGURANÇA → fact_kit_seguranca
  05-estepes.ts          -- Controle de Estepes → fact_estepes
  06-disponibilidade.ts  -- DISPOBILIDADE TOTAL + Disponib. Tipo Frota
  07-alinhamento.ts      -- ALINHAMENTO E PREVENTIVA (pivot)
  08-pneus.ts            -- MARCAÇÃO DE PNEUS
  09-tacografo.ts        -- FROTAS BEMOLGRU TACÓGRAFO....
  10-frotas-paradas.ts   -- STATUS- parados (sem IA, apenas raw)
  11-ia-frotas-paradas.ts -- aplica IA nas frotas paradas
```

Cada script: idempotente, usa `batch_id` único por execução, loga progresso.

---

## Dashboards (Sub-projeto C)

Todas as páginas em `app/(app)/planejamento/`:

| Rota | Dashboard |
|---|---|
| `/planejamento` | Visão geral — KPIs, disponibilidade, radar |
| `/planejamento/manutencao` | Radar de manutenção por serviço |
| `/planejamento/paradas` | Frotas paradas com análise IA |
| `/planejamento/documentos` | Tacógrafo + CRLV vencidos/próximos |
| `/planejamento/pneus` | Status de pneus por frota |
| `/planejamento/seguranca` | Kit de segurança |
| `/planejamento/lavagem` | Controle de lavagem |
| `/planejamento/bateria` | Controle de bateria |
| `/planejamento/disponibilidade` | Curva de disponibilidade diária |
| `/planejamento/relatorios` | Relatório diário/semanal/mensal |

---

## Implementação por fases

**Fase 1 (Sub-projeto A):** Migration 006 + scripts 00–06 + dashboards de disponibilidade/lavagem/bateria/segurança
**Fase 2 (Sub-projeto B):** Scripts 07–09 + dashboards de manutenção/pneus/documentos
**Fase 3 (Sub-projeto D):** Script 10–11 + dashboard de frotas paradas com IA
**Fase 4 (Sub-projeto C):** Dashboard de visão geral + radar + relatórios
