# Cockpit de Frotas — Sub-projeto C: Dashboards de Planejamento

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`

**Goal:** 9 páginas de dashboard em `app/(app)/planejamento/` consumindo as fact tables criadas nos Sub-projetos A e B.

**Architecture:** RSC com `force-dynamic`. Queries centralizadas em `lib/repos/planejamento.ts`. Layout compartilhado com sub-navegação por tabs. Menu adicionado ao `app-shell.tsx`.

**Tech Stack:** Next.js App Router, Tailwind CSS, Supabase, shadcn-style components.

---

## Rotas

| Rota | Título | Dados principais |
|---|---|---|
| `/planejamento` | Visão Geral | KPIs de todos os módulos |
| `/planejamento/manutencao` | Manutenção | fact_manutencao_programada |
| `/planejamento/documentos` | Documentos | fact_documentos_frota |
| `/planejamento/disponibilidade` | Disponibilidade | fact_disponibilidade_diaria |
| `/planejamento/pneus` | Pneus | fact_pneus |
| `/planejamento/lavagem` | Lavagem | fact_lavagem |
| `/planejamento/seguranca` | Kit Segurança | fact_kit_seguranca |
| `/planejamento/bateria` | Bateria | fact_bateria_garantia |
| `/planejamento/estepes` | Estepes | fact_estepes |

---

## Arquivos

| Arquivo | Op |
|---|---|
| `lib/repos/planejamento.ts` | Criar |
| `app/(app)/planejamento/layout.tsx` | Criar |
| `app/(app)/planejamento/page.tsx` | Criar |
| `app/(app)/planejamento/manutencao/page.tsx` | Criar |
| `app/(app)/planejamento/documentos/page.tsx` | Criar |
| `app/(app)/planejamento/disponibilidade/page.tsx` | Criar |
| `app/(app)/planejamento/pneus/page.tsx` | Criar |
| `app/(app)/planejamento/lavagem/page.tsx` | Criar |
| `app/(app)/planejamento/seguranca/page.tsx` | Criar |
| `app/(app)/planejamento/bateria/page.tsx` | Criar |
| `app/(app)/planejamento/estepes/page.tsx` | Criar |
| `components/app-shell.tsx` | Modificar — adicionar nav |

---

## Status badge convention

```
VENCIDO / ATRASADO → bg-red-100 text-red-800
PREVENTIVA / PENDENTE → bg-amber-100 text-amber-800
NO_PRAZO / OK / LAVAGEM → bg-emerald-100 text-emerald-800
null → bg-slate-100 text-slate-600
```
