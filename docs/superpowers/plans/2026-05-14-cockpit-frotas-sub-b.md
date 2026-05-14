# Cockpit de Frotas — Sub-projeto B: ETL Complexo

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`

**Goal:** Importar as 3 abas complexas da planilha PLANEJAMENTO: ALINHAMENTO E PREVENTIVA (pivot de 7 serviços), MARCAÇÃO DE PNEUS (parser com contexto), FROTAS BEMOLGRU TACÓGRAFO.... (tacógrafo + CRLV por veículo).

**Architecture:** Cada script em `scripts/import-planejamento/` lê diretamente do XLSX, transforma e faz upsert nas fact tables criadas na migration 006.

**Tech Stack:** TypeScript, xlsx, Supabase, utils compartilhados de `./utils`.

---

## Estrutura de colunas — ALINHAMENTO E PREVENTIVA

Headers em 2 linhas. Dados de linha 2 em diante.
Colunas fixas: 0=EQUIP, 1=PLACA, 2=FROTA, 3=LOCAL, 4=SETOR

| tipo_servico | data | media | dias/km_inicial | km_rodados/dias_passados | desvio | status |
|---|---|---|---|---|---|---|
| AR_CONDICIONADO | 5 | 6 | 7 (dias_passados) | — | 8 | 9 |
| ALINHAMENTO | 10 | 12 | 11 (km_inicial) | 13 (km_rodados) | — | 14 |
| PREVENTIVA_MOTOR | 15 | 17 | 16 (km_inicial) | 18 (km_rodados) | 19 | 20 |
| EMBREAGEM | 22 | 23 | 24 (dias_passados) | — | 25 | 26 |
| TACOGRAFO | 27 | 28 | 29 (dias_passados) | — | 30 | 31 |
| PORTA_ROOL_UP | 32 | 33 | 34 (dias_passados) | — | 35 | 36 |
| SUSPENSAO | 37 | 38 | 39 (km_inicial) | 40 (km_rodado) | 41 | 42 |

## Estrutura de colunas — MARCAÇÃO DE PNEUS

Colunas 0-12: EQUIPAMENTO, FROTA, KM, POSIÇÃO, Nº FOGO, MARCA, DT MONTAGEM, ATUALIZADO, ANTERIOR(fogo), MARCA anterior, STATUS, MARCADO, OBSERVAÇÕES

Lógica de parsing:
- Se col0 = "EQUIPAMENTO" (texto) → header repetido, pular
- Se col0 é número grande (>= 700000) → atualizar current_equip
- Se col0 é texto de cidade → nova seção de veículo (col1=frota, col2=km)
- Se col0 é null e col2 não é null → continuação do veículo atual
- Um pneu é válido quando col3 (posição) não é null

## Estrutura de colunas — FROTAS BEMOLGRU TACÓGRAFO....

Header em linha 1. Dados de linha 2.
- col1=CÓD EQUIP, col3=Frota Geral, col4=PLACA, col26=LOCALIZAÇÃO
- Tacógrafo: col10=data, col11=media, col12=dias, col13=desvio, col14=vencimento, col15=status, col16=link
- CRLV: col18=data, col19=media, col20=dias, col21=desvio, col22=vencimento, col23=link, col25=status
- DUT: col24=vencimento (quando não é "-" ou null)

---

## Task 1: Script 07-alinhamento.ts

**Files:** Create `scripts/import-planejamento/07-alinhamento.ts`

Pivot de colunas largas em linhas por tipo de serviço. Para cada veículo (linha), gera até 7 registros em `fact_manutencao_programada`.

## Task 2: Script 08-pneus.ts

**Files:** Create `scripts/import-planejamento/08-pneus.ts`

Parser com estado: rastreia equipamento/km atual linha a linha, gera registros em `fact_pneus`.

## Task 3: Script 09-tacografo.ts

**Files:** Create `scripts/import-planejamento/09-tacografo.ts`

Para cada veículo, gera 2-3 registros em `fact_documentos_frota` (TACOGRAFO, CRLV, opcionalmente DUT).

## Task 4: Atualizar run-all.ts

**Files:** Modify `scripts/import-planejamento/run-all.ts`

Adicionar chamadas aos 3 novos scripts.
