# Evolução da Plataforma FROTAS — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o sistema em uma plataforma completa de controle de frotas com disponibilidade por CD, KPIs de preventivas, perfil de motorista com programações, movimentações rastreadas, custos e envio automático de e-mails.

**Architecture:** 5 sub-projetos independentes com dados já parcialmente mapeados nas tabelas `fact_*` do Databricks/staging, `movimentacoes_frota`, e `veiculos`. Cada sub-projeto produz software funcional independente. A ordem de implementação recomendada é A → B → C → D → E. Nenhum sub-projeto depende do seguinte.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase/PostgreSQL, Tailwind CSS, shadcn/ui, SendGrid (já configurado), Databricks staging tables.

**Estado atual relevante:**
- `veiculos.local` = CD/localização; `fact_disponibilidade_diaria` já existe
- `fact_manutencao_programada` já tem TACOGRAFO, ALINHAMENTO, AR_CONDICIONADO
- `movimentacoes_frota` tem `motorista_id` mas não tem `destino`, `motivo`, `tipo_destino`
- SendGrid configurado em `lib/email.ts`; `email_logs` table existe
- `fact_comparativo_ordens` tem qtd_ordens + valor_total por período

---

## Sub-projeto A — Disponibilidade por CD e KPIs Reformulados

**Itens do spec:** 1 (Disponibilidade por CD), 2 (KPIs reformulados), 12 (Outros pontos de atenção)

**Arquivos afetados:**
- Criar: `lib/repos/disponibilidade.ts`
- Criar: `app/(app)/operacao/disponibilidade/page.tsx`
- Criar: `components/dashboard/disponibilidade-cd-card.tsx`
- Criar: `components/dashboard/atencao-card.tsx`
- Modificar: `components/dashboard/kpi-cards.tsx`
- Modificar: `lib/repos/frotas.ts` — função `kpis()` + tipo `Kpis`
- Modificar: `components/dashboard/cockpit-summary.tsx`
- Criar: `supabase/migrations/012_disponibilidade_cd.sql`

---

### A-1: Migration — campo CD canônico + view de disponibilidade

**Arquivos:**
- Criar: `supabase/migrations/012_disponibilidade_cd.sql`

- [ ] **Criar migration com view `v_disponibilidade_cd`**

```sql
-- supabase/migrations/012_disponibilidade_cd.sql

-- Regra de negócio: CD Tarumã fica agrupado com o CD-mãe
-- Os 5 CDs são definidos pela coluna veiculos.local

-- View: disponibilidade consolidada por CD
CREATE OR REPLACE VIEW public.v_disponibilidade_cd AS
SELECT
  -- Normaliza Tarumã para o nome do CD pai conforme regra de negócio
  CASE
    WHEN lower(v.local) LIKE '%taruma%' OR lower(v.local) LIKE '%tarumã%'
      THEN COALESCE(
        (SELECT v2.local FROM public.veiculos v2
         WHERE lower(v2.local) NOT LIKE '%taruma%'
           AND lower(v2.local) NOT LIKE '%tarumã%'
           AND v2.ativo = true AND v2.vendido = false
         LIMIT 1),
        'CD Manaus'
      )
    ELSE COALESCE(v.local, 'Sem CD')
  END AS cd_nome,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false) AS total,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND v.status = 'disponivel') AS disponiveis,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND v.status = 'manutencao') AS em_manutencao,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND v.status = 'indisponivel') AS paradas,
  COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false AND v.status IN ('disponivel'))::numeric
    / NULLIF(COUNT(*) FILTER (WHERE v.ativo = true AND v.vendido = false), 0) * 100 AS percentual_disponibilidade
FROM public.veiculos v
WHERE v.ativo = true AND v.vendido = false
GROUP BY 1
ORDER BY 1;

-- Atenção: a view agrupa Tarumã. Para editar a regra, ajustar o CASE acima.
GRANT SELECT ON public.v_disponibilidade_cd TO service_role;
```

- [ ] **Aplicar migration no Supabase MCP**

```
mcp__claude_ai_Supabase__apply_migration(
  project_id: "nwoqastjgkgsifmxdqwp",
  name: "012_disponibilidade_cd",
  query: <conteúdo acima>
)
```

- [ ] **Validar com query de teste**

```sql
SELECT * FROM public.v_disponibilidade_cd;
-- Deve retornar 1 linha por CD (Tarumã agrupado)
-- percentual_disponibilidade entre 0 e 100
```

- [ ] **Commit**

```bash
git add supabase/migrations/012_disponibilidade_cd.sql
git commit -m "feat(db): view v_disponibilidade_cd com agrupamento Tarumã"
```

---

### A-2: Repositório de disponibilidade por CD

**Arquivos:**
- Criar: `lib/repos/disponibilidade.ts`

- [ ] **Criar `lib/repos/disponibilidade.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type DisponibilidadeCD = {
  cd_nome: string;
  total: number;
  disponiveis: number;
  em_manutencao: number;
  paradas: number;
  percentual_disponibilidade: number;
};

export type DisponibilidadeGeral = {
  total: number;
  disponiveis: number;
  em_manutencao: number;
  paradas: number;
  percentual_disponibilidade: number;
};

export async function getDisponibilidadePorCD(): Promise<DisponibilidadeCD[]> {
  const { data, error } = await supabaseManutencao
    .from("v_disponibilidade_cd")
    .select("*");
  if (error) {
    console.warn("[disponibilidade] falha ao buscar por CD", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    cd_nome: String(row.cd_nome ?? "Sem CD"),
    total: Number(row.total ?? 0),
    disponiveis: Number(row.disponiveis ?? 0),
    em_manutencao: Number(row.em_manutencao ?? 0),
    paradas: Number(row.paradas ?? 0),
    percentual_disponibilidade: Math.round(Number(row.percentual_disponibilidade ?? 0)),
  }));
}

export async function getDisponibilidadeGeral(): Promise<DisponibilidadeGeral> {
  const rows = await getDisponibilidadePorCD();
  const total = rows.reduce((s, r) => s + r.total, 0);
  const disponiveis = rows.reduce((s, r) => s + r.disponiveis, 0);
  const em_manutencao = rows.reduce((s, r) => s + r.em_manutencao, 0);
  const paradas = rows.reduce((s, r) => s + r.paradas, 0);
  return {
    total,
    disponiveis,
    em_manutencao,
    paradas,
    percentual_disponibilidade: total > 0 ? Math.round((disponiveis / total) * 100) : 0,
  };
}

export type PontoAtencao = {
  tipo: "km_desatualizado" | "sem_checklist_recente" | "manutencao_longa" | "sem_foto_painel" | "docs_pendentes";
  titulo: string;
  descricao: string;
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  severidade: "ATENCAO" | "CRITICO";
};

export async function getPontosAtencao(limite = 20): Promise<PontoAtencao[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculos")
    .select("id, codigo_frota, placa, km_atual, km_atualizado_em, ultimo_checklist_em, manutencao_iniciado_em, status")
    .eq("ativo", true)
    .eq("vendido", false)
    .limit(200);

  if (error || !data) return [];

  const agora = Date.now();
  const pontos: PontoAtencao[] = [];

  for (const v of data) {
    // KM desatualizado (mais de 15 dias)
    if (v.km_atualizado_em) {
      const diasSemKm = Math.floor((agora - new Date(v.km_atualizado_em).getTime()) / 86_400_000);
      if (diasSemKm > 15) {
        pontos.push({
          tipo: "km_desatualizado",
          titulo: "KM desatualizado",
          descricao: `Frota ${v.codigo_frota ?? v.id} sem atualização de KM há ${diasSemKm} dias`,
          frota_id: v.id,
          frota_geral: v.codigo_frota,
          placa: v.placa,
          severidade: diasSemKm > 30 ? "CRITICO" : "ATENCAO",
        });
      }
    }

    // Sem checklist recente (mais de 7 dias, frota em operação)
    if (v.status === "disponivel" && v.ultimo_checklist_em) {
      const diasSemChecklist = Math.floor((agora - new Date(v.ultimo_checklist_em).getTime()) / 86_400_000);
      if (diasSemChecklist > 7) {
        pontos.push({
          tipo: "sem_checklist_recente",
          titulo: "Sem checklist recente",
          descricao: `Frota ${v.codigo_frota ?? v.id} sem checklist há ${diasSemChecklist} dias`,
          frota_id: v.id,
          frota_geral: v.codigo_frota,
          placa: v.placa,
          severidade: diasSemChecklist > 15 ? "CRITICO" : "ATENCAO",
        });
      }
    }

    // Em manutenção há muito tempo (>15 dias)
    if (v.status === "manutencao" && v.manutencao_iniciado_em) {
      const diasManutencao = Math.floor((agora - new Date(v.manutencao_iniciado_em).getTime()) / 86_400_000);
      if (diasManutencao > 15) {
        pontos.push({
          tipo: "manutencao_longa",
          titulo: "Manutenção prolongada",
          descricao: `Frota ${v.codigo_frota ?? v.id} em manutenção há ${diasManutencao} dias`,
          frota_id: v.id,
          frota_geral: v.codigo_frota,
          placa: v.placa,
          severidade: diasManutencao > 30 ? "CRITICO" : "ATENCAO",
        });
      }
    }
  }

  return pontos
    .sort((a, b) => (a.severidade === "CRITICO" ? -1 : 1))
    .slice(0, limite);
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/dev"
# Deve passar sem erros
```

- [ ] **Commit**

```bash
git add lib/repos/disponibilidade.ts
git commit -m "feat(repo): disponibilidade por CD e pontos de atenção"
```

---

### A-3: Componente DisponibilidadeCDCard

**Arquivos:**
- Criar: `components/dashboard/disponibilidade-cd-card.tsx`

- [ ] **Criar `components/dashboard/disponibilidade-cd-card.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { DisponibilidadeCD } from "@/lib/repos/disponibilidade";

function PillBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DisponibilidadeCDCard({ cd }: { cd: DisponibilidadeCD }) {
  const pct = cd.percentual_disponibilidade;
  const cor = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
  const barCor = pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {cd.cd_nome}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{cd.total}</p>
          <p className="text-xs text-muted-foreground">frotas ativas</p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-bold tabular-nums", cor)}>{pct}%</p>
          <p className="text-xs text-muted-foreground">disponível</p>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <PillBar value={cd.disponiveis} max={cd.total} color="bg-emerald-400" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Disponíveis" value={cd.disponiveis} color="text-emerald-600" />
        <Stat label="Manutenção" value={cd.em_manutencao} color="text-violet-600" />
        <Stat label="Paradas" value={cd.paradas} color="text-red-600" />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function DisponibilidadeGeralCard({
  total, disponiveis, em_manutencao, paradas, percentual_disponibilidade,
}: {
  total: number; disponiveis: number; em_manutencao: number; paradas: number; percentual_disponibilidade: number;
}) {
  const pct = percentual_disponibilidade;
  const cor = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";

  return (
    <div className="rounded-xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Consolidado — Todas as operações</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-bold tabular-nums tracking-tight">{total}</p>
          <p className="text-sm text-muted-foreground">frotas ativas</p>
        </div>
        <p className={cn("text-4xl font-bold tabular-nums", cor)}>{pct}%</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Stat label="Disponíveis" value={disponiveis} color="text-emerald-600" />
        <Stat label="Manutenção" value={em_manutencao} color="text-violet-600" />
        <Stat label="Paradas" value={paradas} color="text-red-600" />
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add components/dashboard/disponibilidade-cd-card.tsx
git commit -m "feat(ui): DisponibilidadeCDCard e DisponibilidadeGeralCard"
```

---

### A-4: Componente AtencaoCard

**Arquivos:**
- Criar: `components/dashboard/atencao-card.tsx`

- [ ] **Criar `components/dashboard/atencao-card.tsx`**

```tsx
import Link from "next/link";
import { AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PontoAtencao } from "@/lib/repos/disponibilidade";

export function AtencaoSection({ pontos }: { pontos: PontoAtencao[] }) {
  if (pontos.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        Outros pontos de atenção
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {pontos.map((p, i) => (
          <AtencaoCard key={i} ponto={p} />
        ))}
      </div>
    </div>
  );
}

function AtencaoCard({ ponto }: { ponto: PontoAtencao }) {
  const critico = ponto.severidade === "CRITICO";
  return (
    <Link
      href={`/frotas/${ponto.frota_id}`}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-slate-50",
        critico ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"
      )}
    >
      {critico ? (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{ponto.titulo}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{ponto.descricao}</p>
        {ponto.placa && (
          <p className="mt-1 text-[10px] font-mono text-muted-foreground/70">{ponto.placa}</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Commit**

```bash
git add components/dashboard/atencao-card.tsx
git commit -m "feat(ui): AtencaoSection com cards de pontos de atenção"
```

---

### A-5: Página de Disponibilidade por CD

**Arquivos:**
- Criar: `app/(app)/operacao/disponibilidade/page.tsx`

- [ ] **Criar `app/(app)/operacao/disponibilidade/page.tsx`**

```tsx
import { requireAppUser } from "@/lib/rbac";
import { getDisponibilidadePorCD, getDisponibilidadeGeral, getPontosAtencao } from "@/lib/repos/disponibilidade";
import { DisponibilidadeCDCard, DisponibilidadeGeralCard } from "@/components/dashboard/disponibilidade-cd-card";
import { AtencaoSection } from "@/components/dashboard/atencao-card";

export const dynamic = "force-dynamic";

export default async function DisponibilidadePage() {
  await requireAppUser();

  const [cds, geral, pontos] = await Promise.all([
    getDisponibilidadePorCD(),
    getDisponibilidadeGeral(),
    getPontosAtencao(15),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Operação</p>
        <h1 className="text-3xl font-semibold tracking-tight">Disponibilidade por CD</h1>
      </div>

      <DisponibilidadeGeralCard {...geral} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Por centro de distribuição</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cds.map((cd) => (
            <DisponibilidadeCDCard key={cd.cd_nome} cd={cd} />
          ))}
        </div>
      </div>

      <AtencaoSection pontos={pontos} />
    </div>
  );
}
```

- [ ] **Adicionar link no nav — `components/app-shell.tsx`**

No array `OPERACAO_NAV`, substituir o item de Operação:
```ts
{ href: "/operacao/disponibilidade", label: "Disponibilidade", icon: "Gauge" },
```

- [ ] **Testar no browser: `http://localhost:3000/operacao/disponibilidade`**

Verificar:
- Card consolidado mostra total geral
- Cada CD aparece com card separado
- Tarumã agrupado (não aparece como CD separado)
- Pontos de atenção listados abaixo

- [ ] **Commit**

```bash
git add app/(app)/operacao/disponibilidade/page.tsx components/app-shell.tsx
git commit -m "feat(page): disponibilidade por CD com view consolidada e pontos de atenção"
```

---

### A-6: KPIs reformulados — remover Kit Segurança, adicionar preventivas

**Arquivos:**
- Modificar: `lib/repos/frotas.ts` — tipo `Kpis` + função `kpis()`
- Modificar: `components/dashboard/kpi-cards.tsx`

- [ ] **Adicionar campos de preventiva ao tipo `Kpis` em `lib/repos/frotas.ts`**

Localizar o tipo `Kpis` (linha ~104) e adicionar:
```typescript
export type Kpis = {
  // ... campos existentes ...
  // NOVOS:
  preventiva_atrasada: number;
  alinhamento_atrasado: number;
  arcondicionado_atrasado: number;
  tacografo_atrasado: number;
  lavagem_atrasada: number;
  disponibilidade_pct: number;
};
```

- [ ] **Atualizar função `kpis()` em `lib/repos/frotas.ts`** para incluir contagem de preventivas usando `fact_manutencao_programada`:

```typescript
// Dentro de kpis(), após os cálculos existentes:
const { data: preventivas } = await supabaseManutencao
  .from("fact_manutencao_programada")
  .select("tipo_servico, status")
  .in("status", ["VENCIDO", "PROXIMO_VENCIMENTO"]);

const prevRows = preventivas ?? [];
const preventiva_atrasada = prevRows.filter((p) => p.tipo_servico === "PREVENTIVA_MOTOR" && p.status === "VENCIDO").length;
const alinhamento_atrasado = prevRows.filter((p) => p.tipo_servico === "ALINHAMENTO" && p.status === "VENCIDO").length;
const arcondicionado_atrasado = prevRows.filter((p) => p.tipo_servico === "AR_CONDICIONADO" && p.status === "VENCIDO").length;
const tacografo_atrasado = prevRows.filter((p) => p.tipo_servico === "TACOGRAFO" && p.status === "VENCIDO").length;
const lavagem_atrasada = prevRows.filter((p) => p.tipo_servico === "LAVAGEM" && p.status === "VENCIDO").length;
const total_ativos = frotas.filter((f) => f.ativo && !f.vendido).length;
const total_disponiveis_calc = frotas.filter((f) => f.ativo && !f.vendido && f.status === "disponivel").length;
const disponibilidade_pct = total_ativos > 0 ? Math.round((total_disponiveis_calc / total_ativos) * 100) : 0;

return {
  ...existingKpis,
  preventiva_atrasada,
  alinhamento_atrasado,
  arcondicionado_atrasado,
  tacografo_atrasado,
  lavagem_atrasada,
  disponibilidade_pct,
};
```

- [ ] **Atualizar `components/dashboard/kpi-cards.tsx`**

Remover o card de "Kit segurança" e adicionar os KPIs de preventiva:
```tsx
// Remover: card de kit_seguranca se existir

// Adicionar cards:
<MetricCard
  label="Preventiva motor atrasada"
  value={kpis.preventiva_atrasada}
  href="/planejamento/manutencao?tipo=PREVENTIVA_MOTOR"
  severity={kpis.preventiva_atrasada > 0 ? "CRITICO" : "OK"}
/>
<MetricCard
  label="Alinhamento atrasado"
  value={kpis.alinhamento_atrasado}
  href="/planejamento/manutencao?tipo=ALINHAMENTO"
  severity={kpis.alinhamento_atrasado > 0 ? "ATENCAO" : "OK"}
/>
<MetricCard
  label="Ar-condicionado atrasado"
  value={kpis.arcondicionado_atrasado}
  href="/planejamento/manutencao?tipo=AR_CONDICIONADO"
  severity={kpis.arcondicionado_atrasado > 0 ? "ATENCAO" : "OK"}
/>
<MetricCard
  label="Tacógrafo atrasado"
  value={kpis.tacografo_atrasado}
  href="/planejamento/manutencao?tipo=TACOGRAFO"
  severity={kpis.tacografo_atrasado > 0 ? "CRITICO" : "OK"}
/>
<MetricCard
  label="Disponibilidade geral"
  value={`${kpis.disponibilidade_pct}%`}
  href="/operacao/disponibilidade"
  severity={kpis.disponibilidade_pct >= 80 ? "OK" : kpis.disponibilidade_pct >= 60 ? "ATENCAO" : "CRITICO"}
/>
```

- [ ] **Verificar TypeScript e commit**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/dev"
git add lib/repos/frotas.ts components/dashboard/kpi-cards.tsx
git commit -m "feat(kpis): preventivas, tacógrafo, disponibilidade% — remove kit segurança"
```

---

## Sub-projeto B — Tacógrafo, Fluxo de Manutenção e Ordens

**Itens do spec:** 3 (Tacógrafo), 6 (Fluxo manutenção), 11 (Ordens de manutenção)

**Arquivos afetados:**
- Criar: `supabase/migrations/013_manutencao_destino.sql`
- Criar: `lib/repos/tacografo.ts`
- Criar: `app/(app)/planejamento/manutencao/tacografo/page.tsx`
- Criar: `app/(app)/manutencao/ordens/page.tsx`
- Modificar: `components/frotas/manutencao/enviar-manutencao-dialog.tsx`
- Modificar: `lib/services/veiculo-status.ts`

---

### B-1: Migration — campo destino em manutenção

**Arquivos:**
- Criar: `supabase/migrations/013_manutencao_destino.sql`

- [ ] **Criar migration**

```sql
-- supabase/migrations/013_manutencao_destino.sql

-- Tipo de destino ao enviar frota para manutenção/parada
DO $$ BEGIN
  CREATE TYPE public.tipo_destino_manutencao AS ENUM (
    'OFICINA',
    'LAVAGEM',
    'PREVENTIVA',
    'CORRETIVA',
    'ALINHAMENTO',
    'AR_CONDICIONADO',
    'TACOGRAFO',
    'OUTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS manutencao_destino public.tipo_destino_manutencao,
  ADD COLUMN IF NOT EXISTS manutencao_destino_detalhe text;

-- Histórico de tacógrafo por veículo
CREATE TABLE IF NOT EXISTS public.veiculo_tacografo_historico (
  id          bigserial PRIMARY KEY,
  veiculo_id  integer NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  data_servico date NOT NULL,
  data_proxima date,
  observacao  text,
  registrado_por text,
  criado_em   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tacografo_veiculo ON public.veiculo_tacografo_historico (veiculo_id, data_servico DESC);

ALTER TABLE public.veiculo_tacografo_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.veiculo_tacografo_historico
  USING (auth.role() = 'service_role');
```

- [ ] **Aplicar via Supabase MCP**
- [ ] **Commit**

```bash
git add supabase/migrations/013_manutencao_destino.sql
git commit -m "feat(db): campo destino manutenção + tabela tacógrafo histórico"
```

---

### B-2: Repositório de tacógrafo

**Arquivos:**
- Criar: `lib/repos/tacografo.ts`

- [ ] **Criar `lib/repos/tacografo.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type TacografoStatus = "EM_DIA" | "PROXIMO_VENCIMENTO" | "VENCIDO" | "SEM_REGISTRO";

export type TacografoVeiculo = {
  veiculo_id: number;
  frota_geral: string | null;
  placa: string | null;
  localizacao: string | null;
  data_servico: string | null;
  data_proxima: string | null;
  dias_desde_servico: number | null;
  dias_para_vencer: number | null;
  status: TacografoStatus;
};

export type TacografoHistoricoRow = {
  id: number;
  veiculo_id: number;
  data_servico: string;
  data_proxima: string | null;
  observacao: string | null;
  registrado_por: string | null;
  criado_em: string;
};

const INTERVALO_PADRAO_DIAS = 365; // 1 ano, ajustável

function calcStatus(dataSer: string | null, dataProx: string | null): TacografoStatus {
  if (!dataSer) return "SEM_REGISTRO";
  const proxima = dataProx ? new Date(dataProx) : new Date(new Date(dataSer).getTime() + INTERVALO_PADRAO_DIAS * 86400000);
  const hoje = new Date();
  const diasParaVencer = Math.ceil((proxima.getTime() - hoje.getTime()) / 86400000);
  if (diasParaVencer < 0) return "VENCIDO";
  if (diasParaVencer <= 30) return "PROXIMO_VENCIMENTO";
  return "EM_DIA";
}

export async function listTacografoPorFrota(): Promise<TacografoVeiculo[]> {
  const { data: veiculos, error } = await supabaseManutencao
    .from("veiculos")
    .select("id, codigo_frota, placa, local")
    .eq("ativo", true)
    .eq("vendido", false);

  if (error || !veiculos) return [];

  const ids = veiculos.map((v) => v.id);
  const { data: historico } = await supabaseManutencao
    .from("veiculo_tacografo_historico")
    .select("veiculo_id, data_servico, data_proxima")
    .in("veiculo_id", ids)
    .order("data_servico", { ascending: false });

  const ultimoPorVeiculo = new Map<number, { data_servico: string; data_proxima: string | null }>();
  for (const h of historico ?? []) {
    if (!ultimoPorVeiculo.has(h.veiculo_id)) {
      ultimoPorVeiculo.set(h.veiculo_id, { data_servico: h.data_servico, data_proxima: h.data_proxima });
    }
  }

  const hoje = Date.now();
  return veiculos.map((v) => {
    const ult = ultimoPorVeiculo.get(v.id) ?? null;
    const diasDesde = ult ? Math.floor((hoje - new Date(ult.data_servico).getTime()) / 86400000) : null;
    const proxima = ult?.data_proxima ?? (ult ? new Date(new Date(ult.data_servico).getTime() + INTERVALO_PADRAO_DIAS * 86400000).toISOString().slice(0, 10) : null);
    const diasPara = proxima ? Math.ceil((new Date(proxima).getTime() - hoje) / 86400000) : null;
    return {
      veiculo_id: v.id,
      frota_geral: v.codigo_frota,
      placa: v.placa,
      localizacao: v.local,
      data_servico: ult?.data_servico ?? null,
      data_proxima: proxima,
      dias_desde_servico: diasDesde,
      dias_para_vencer: diasPara,
      status: calcStatus(ult?.data_servico ?? null, proxima),
    };
  });
}

export async function getHistoricoTacografo(veiculoId: number): Promise<TacografoHistoricoRow[]> {
  const { data, error } = await supabaseManutencao
    .from("veiculo_tacografo_historico")
    .select("*")
    .eq("veiculo_id", veiculoId)
    .order("data_servico", { ascending: false });
  if (error) return [];
  return (data ?? []) as TacografoHistoricoRow[];
}

export async function registrarTacografo(input: {
  veiculo_id: number;
  data_servico: string;
  data_proxima?: string | null;
  observacao?: string | null;
  registrado_por: string;
}): Promise<void> {
  const { error } = await supabaseManutencao
    .from("veiculo_tacografo_historico")
    .insert({
      veiculo_id: input.veiculo_id,
      data_servico: input.data_servico,
      data_proxima: input.data_proxima ?? null,
      observacao: input.observacao ?? null,
      registrado_por: input.registrado_por,
    });
  if (error) throw new Error(`registrarTacografo: ${error.message}`);
}
```

- [ ] **Commit**

```bash
git add lib/repos/tacografo.ts
git commit -m "feat(repo): tacógrafo — listagem, histórico e registro por frota"
```

---

### B-3: Página de tacógrafo

**Arquivos:**
- Criar: `app/(app)/planejamento/manutencao/tacografo/page.tsx`

- [ ] **Criar página**

```tsx
import { requireAppUser } from "@/lib/rbac";
import { listTacografoPorFrota } from "@/lib/repos/tacografo";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_CLASS = {
  EM_DIA: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PROXIMO_VENCIMENTO: "border-amber-200 bg-amber-50 text-amber-800",
  VENCIDO: "border-red-200 bg-red-50 text-red-800",
  SEM_REGISTRO: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

const STATUS_LABEL = {
  EM_DIA: "Em dia",
  PROXIMO_VENCIMENTO: "Próximo do vencimento",
  VENCIDO: "Vencido",
  SEM_REGISTRO: "Sem registro",
} as const;

export default async function TacografoPage() {
  await requireAppUser();
  const frotas = await listTacografoPorFrota();
  const ordenado = [...frotas].sort((a, b) => {
    const order = { VENCIDO: 0, PROXIMO_VENCIMENTO: 1, SEM_REGISTRO: 2, EM_DIA: 3 };
    return order[a.status] - order[b.status];
  });

  const resumo = {
    vencidos: frotas.filter((f) => f.status === "VENCIDO").length,
    proximos: frotas.filter((f) => f.status === "PROXIMO_VENCIMENTO").length,
    sem_registro: frotas.filter((f) => f.status === "SEM_REGISTRO").length,
    em_dia: frotas.filter((f) => f.status === "EM_DIA").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Tacógrafo</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Vencidos", value: resumo.vencidos, color: "text-red-600" },
          { label: "Próximos", value: resumo.proximos, color: "text-amber-600" },
          { label: "Sem registro", value: resumo.sem_registro, color: "text-slate-500" },
          { label: "Em dia", value: resumo.em_dia, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Frota</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Placa</th>
              <th className="p-3 text-left font-medium text-muted-foreground">CD</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Último serviço</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Próxima previsão</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordenado.map((f) => (
              <tr key={f.veiculo_id} className="border-b odd:bg-white even:bg-slate-50/60 last:border-0">
                <td className="p-3 font-medium">{f.frota_geral ?? f.veiculo_id}</td>
                <td className="p-3">{f.placa ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{f.localizacao ?? "—"}</td>
                <td className="p-3">{f.data_servico ? formatDate(f.data_servico) : "—"}</td>
                <td className="p-3">
                  {f.data_proxima ? formatDate(f.data_proxima) : "—"}
                  {f.dias_para_vencer != null && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({f.dias_para_vencer > 0 ? `${f.dias_para_vencer}d` : `${Math.abs(f.dias_para_vencer)}d atrás`})
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={STATUS_CLASS[f.status]}>
                    {STATUS_LABEL[f.status]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Adicionar ao nav em `app-shell.tsx`**

```ts
// Em MANUTENCAO_NAV, adicionar:
{ href: "/planejamento/manutencao/tacografo", label: "Tacógrafo", icon: "ClipboardCheck" },
```

- [ ] **Commit**

```bash
git add app/(app)/planejamento/manutencao/tacografo/page.tsx components/app-shell.tsx
git commit -m "feat(page): tacógrafo — listagem por frota com status e histórico"
```

---

### B-4: Destino no fluxo de enviar para manutenção

**Arquivos:**
- Modificar: `components/frotas/manutencao/enviar-manutencao-dialog.tsx`
- Modificar: `lib/services/veiculo-status.ts`

- [ ] **Adicionar `destino` e `destino_detalhe` ao tipo `EnviarManutencaoInput` em `lib/services/veiculo-status.ts`**

```typescript
// No tipo EnviarManutencaoInput, adicionar:
destino?: "OFICINA" | "LAVAGEM" | "PREVENTIVA" | "CORRETIVA" | "ALINHAMENTO" | "AR_CONDICIONADO" | "TACOGRAFO" | "OUTRO" | null;
destino_detalhe?: string | null;
```

- [ ] **No patch de `enviarFrotaParaManutencao`, adicionar os novos campos:**

```typescript
const patch = {
  // ... campos existentes ...
  manutencao_destino: input.destino ?? null,
  manutencao_destino_detalhe: input.destino_detalhe ?? null,
};
```

- [ ] **Adicionar campo `destino` no `EnviarManutencaoDialog`**

No formulário, adicionar antes do campo de observação:
```tsx
<div className="space-y-1.5">
  <Label htmlFor="destino">Destino</Label>
  <select
    id="destino"
    name="destino"
    defaultValue=""
    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
  >
    <option value="">Selecione o destino</option>
    <option value="OFICINA">Oficina</option>
    <option value="LAVAGEM">Lavagem</option>
    <option value="PREVENTIVA">Manutenção preventiva</option>
    <option value="CORRETIVA">Manutenção corretiva</option>
    <option value="ALINHAMENTO">Alinhamento</option>
    <option value="AR_CONDICIONADO">Ar-condicionado</option>
    <option value="TACOGRAFO">Tacógrafo</option>
    <option value="OUTRO">Outro destino</option>
  </select>
</div>
<div className="space-y-1.5">
  <Label htmlFor="destino_detalhe">Detalhe do destino (opcional)</Label>
  <Input id="destino_detalhe" name="destino_detalhe" placeholder="Ex: Oficina Amazonas Diesel" />
</div>
```

- [ ] **Verificar TypeScript e commit**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/dev"
git add components/frotas/manutencao/enviar-manutencao-dialog.tsx lib/services/veiculo-status.ts
git commit -m "feat(manutencao): campo destino no fluxo enviar para manutenção"
```

---

### B-5: Página de ordens de manutenção

**Arquivos:**
- Criar: `lib/repos/ordens.ts`
- Criar: `app/(app)/manutencao/ordens/page.tsx`

- [ ] **Criar `lib/repos/ordens.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type OrdemResumo = {
  data_periodo: string;
  qtd_ordens: number;
  valor_total: number;
};

export type OrdemPorFrota = {
  veiculo_id: number | null;
  frota_geral: string | null;
  placa: string | null;
  qtd_ordens: number;
  valor_total: number;
};

export async function getResumoOrdens(): Promise<OrdemResumo[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_comparativo_ordens")
    .select("data_periodo, qtd_ordens, valor_total")
    .order("data_periodo", { ascending: false })
    .limit(12); // últimos 12 períodos
  if (error) return [];
  return (data ?? []).map((r) => ({
    data_periodo: String(r.data_periodo),
    qtd_ordens: Number(r.qtd_ordens ?? 0),
    valor_total: Number(r.valor_total ?? 0),
  }));
}
```

- [ ] **Criar `app/(app)/manutencao/ordens/page.tsx`**

```tsx
import { requireAppUser } from "@/lib/rbac";
import { getResumoOrdens } from "@/lib/repos/ordens";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdensPage() {
  await requireAppUser();
  const ordens = await getResumoOrdens();
  const totalQtd = ordens.reduce((s, o) => s + o.qtd_ordens, 0);
  const totalValor = ordens.reduce((s, o) => s + o.valor_total, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Ordens de manutenção</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de ordens (12 meses)</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{formatNumber(totalQtd)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor total</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Período</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Qtd. ordens</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {ordens.map((o) => (
              <tr key={o.data_periodo} className="border-b odd:bg-white even:bg-slate-50/60 last:border-0">
                <td className="p-3">{o.data_periodo}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(o.qtd_ordens)}</td>
                <td className="p-3 text-right tabular-nums">
                  R$ {o.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Adicionar ao nav em `app-shell.tsx`**

```ts
// Em MANUTENCAO_NAV, adicionar:
{ href: "/manutencao/ordens", label: "Ordens", icon: "FileText" },
```

- [ ] **Commit**

```bash
git add lib/repos/ordens.ts app/(app)/manutencao/ordens/page.tsx components/app-shell.tsx
git commit -m "feat(page): ordens de manutenção com histórico por período"
```

---

## Sub-projeto C — Motoristas e Movimentações

**Itens do spec:** 5 (Perfil motorista), 7 (Designação motorista para movimentação)

**Arquivos afetados:**
- Criar: `supabase/migrations/014_movimentacoes_destino.sql`
- Criar: `lib/repos/motoristas.ts`
- Criar: `app/(app)/motorista/historico/page.tsx`
- Criar: `app/(app)/administracao/motoristas/page.tsx`
- Modificar: `app/(app)/portaria/_actions.ts`
- Modificar: `app/(app)/portaria/page.tsx`

---

### C-1: Migration — movimentações com destino e histórico por motorista

- [ ] **Criar `supabase/migrations/014_movimentacoes_destino.sql`**

```sql
-- Adiciona campos de destino e motivo nas movimentações
ALTER TABLE public.movimentacoes_frota
  ADD COLUMN IF NOT EXISTS destino text,
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS tipo_destino text; -- MANUTENCAO, LAVAGEM, OPERACAO, OUTRO

-- View: estatísticas por motorista
CREATE OR REPLACE VIEW public.v_motorista_stats AS
SELECT
  m.motorista_id,
  u.nome AS motorista_nome,
  COUNT(*) AS total_movimentacoes,
  COUNT(DISTINCT m.frota_id) AS frotas_distintas,
  MAX(m.data_hora) AS ultima_movimentacao,
  COUNT(*) FILTER (WHERE m.tipo_movimentacao = 'SAIDA') AS total_saidas
FROM public.movimentacoes_frota m
LEFT JOIN public.usuarios u ON u.email = m.motorista_id
GROUP BY m.motorista_id, u.nome;

GRANT SELECT ON public.v_motorista_stats TO service_role;

-- View: histórico de frotas por motorista
CREATE OR REPLACE VIEW public.v_motorista_frotas AS
SELECT
  m.motorista_id,
  m.frota_id,
  v.codigo_frota AS frota_geral,
  v.placa,
  COUNT(*) AS qtd_movimentacoes,
  MAX(m.data_hora) AS ultima_vez
FROM public.movimentacoes_frota m
JOIN public.veiculos v ON v.id = m.frota_id
GROUP BY m.motorista_id, m.frota_id, v.codigo_frota, v.placa;

GRANT SELECT ON public.v_motorista_frotas TO service_role;
```

- [ ] **Aplicar via Supabase MCP**
- [ ] **Commit**

```bash
git add supabase/migrations/014_movimentacoes_destino.sql
git commit -m "feat(db): destino em movimentações + views de stats e histórico por motorista"
```

---

### C-2: Repositório de motoristas

**Arquivos:**
- Criar: `lib/repos/motoristas.ts`

- [ ] **Criar `lib/repos/motoristas.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type MotoristaStats = {
  motorista_id: string;
  motorista_nome: string | null;
  total_movimentacoes: number;
  frotas_distintas: number;
  ultima_movimentacao: string | null;
  total_saidas: number;
};

export type MotoristaFrotaHistorico = {
  frota_id: number;
  frota_geral: string | null;
  placa: string | null;
  qtd_movimentacoes: number;
  ultima_vez: string | null;
};

export type MotoristaChecklistStats = {
  total_checklists: number;
  km_total: number;
  ultimo_checklist: string | null;
  frotas_distintas: number;
};

export async function listMotoristasStats(): Promise<MotoristaStats[]> {
  const { data, error } = await supabaseManutencao
    .from("v_motorista_stats")
    .select("*")
    .order("total_movimentacoes", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    motorista_id: String(r.motorista_id),
    motorista_nome: r.motorista_nome ?? null,
    total_movimentacoes: Number(r.total_movimentacoes ?? 0),
    frotas_distintas: Number(r.frotas_distintas ?? 0),
    ultima_movimentacao: r.ultima_movimentacao ?? null,
    total_saidas: Number(r.total_saidas ?? 0),
  }));
}

export async function getFrotasDoMotorista(motoristaId: string): Promise<MotoristaFrotaHistorico[]> {
  const { data, error } = await supabaseManutencao
    .from("v_motorista_frotas")
    .select("*")
    .eq("motorista_id", motoristaId)
    .order("qtd_movimentacoes", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    frota_id: Number(r.frota_id),
    frota_geral: r.frota_geral ?? null,
    placa: r.placa ?? null,
    qtd_movimentacoes: Number(r.qtd_movimentacoes ?? 0),
    ultima_vez: r.ultima_vez ?? null,
  }));
}

export async function getChecklistStatsMotorista(motoristaId: string): Promise<MotoristaChecklistStats> {
  const { data, error } = await supabaseManutencao
    .from("checklists_frota")
    .select("id, km_informado, criado_em, frota_id")
    .eq("motorista_id", motoristaId);

  if (error || !data) return { total_checklists: 0, km_total: 0, ultimo_checklist: null, frotas_distintas: 0 };

  const km_total = data.reduce((s, c) => s + (c.km_informado ?? 0), 0);
  const ultimo = data.sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0]?.criado_em ?? null;
  const frotas = new Set(data.map((c) => c.frota_id)).size;

  return {
    total_checklists: data.length,
    km_total,
    ultimo_checklist: ultimo,
    frotas_distintas: frotas,
  };
}
```

- [ ] **Commit**

```bash
git add lib/repos/motoristas.ts
git commit -m "feat(repo): estatísticas e histórico de frotas por motorista"
```

---

### C-3: Perfil do motorista expandido

**Arquivos:**
- Modificar: `app/(app)/motorista/page.tsx`
- Criar: `app/(app)/motorista/historico/page.tsx`

- [ ] **Criar `app/(app)/motorista/historico/page.tsx`** — histórico de frotas do motorista logado

```tsx
import Link from "next/link";
import { requireAppUser } from "@/lib/rbac";
import { getFrotasDoMotorista, getChecklistStatsMotorista } from "@/lib/repos/motoristas";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristaHistoricoPage() {
  const user = await requireAppUser();
  const [frotas, stats] = await Promise.all([
    getFrotasDoMotorista(user.email),
    getChecklistStatsMotorista(user.email),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Motorista</p>
        <h1 className="text-3xl font-semibold tracking-tight">Meu histórico</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Checklists", value: stats.total_checklists },
          { label: "KM registrado", value: formatNumber(stats.km_total) },
          { label: "Frotas distintas", value: stats.frotas_distintas },
          { label: "Último checklist", value: stats.ultimo_checklist ? formatDate(stats.ultimo_checklist) : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Frotas que já levei</h2>
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="p-3 text-left font-medium text-muted-foreground">Frota</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Placa</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Movimentações</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Última vez</th>
              </tr>
            </thead>
            <tbody>
              {frotas.map((f) => (
                <tr key={f.frota_id} className="border-b odd:bg-white even:bg-slate-50/60 last:border-0">
                  <td className="p-3 font-medium">
                    <Link href={`/frotas/${f.frota_id}`} className="hover:text-blue-600 hover:underline">
                      {f.frota_geral ?? f.frota_id}
                    </Link>
                  </td>
                  <td className="p-3">{f.placa ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{f.qtd_movimentacoes}</td>
                  <td className="p-3 text-right">{f.ultima_vez ? formatDate(f.ultima_vez) : "—"}</td>
                </tr>
              ))}
              {frotas.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Adicionar link no nav de motorista (`app-shell.tsx`)**

```ts
// Em MOTORISTA_NAV:
{ href: "/motorista/historico", label: "Meu histórico", icon: "History" },
```

Importar `History` no `app-sidebar.tsx`:
```ts
import { ..., History, ... } from "lucide-react";
// Adicionar ao NAV_ICONS: History,
```

- [ ] **Commit**

```bash
git add app/(app)/motorista/historico/page.tsx components/app-shell.tsx components/app-sidebar.tsx
git commit -m "feat(motorista): página de histórico de frotas e estatísticas do motorista"
```

---

### C-4: Painel de motoristas para admin/gestor

**Arquivos:**
- Criar: `app/(app)/administracao/motoristas/page.tsx`

- [ ] **Criar `app/(app)/administracao/motoristas/page.tsx`**

```tsx
import { requireAppUser } from "@/lib/rbac";
import { listMotoristasStats } from "@/lib/repos/motoristas";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MotoristasAdminPage() {
  await requireAppUser();
  const motoristas = await listMotoristasStats();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Administração</p>
        <h1 className="text-3xl font-semibold tracking-tight">Motoristas</h1>
        <p className="text-sm text-muted-foreground">{motoristas.length} motorista(s) com movimentações registradas.</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-muted-foreground">Motorista</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Movimentações</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Frotas distintas</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Saídas</th>
              <th className="p-3 text-right font-medium text-muted-foreground">Última movimentação</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((m) => (
              <tr key={m.motorista_id} className="border-b odd:bg-white even:bg-slate-50/60 last:border-0">
                <td className="p-3">
                  <div className="font-medium">{m.motorista_nome ?? m.motorista_id}</div>
                  <div className="text-xs text-muted-foreground">{m.motorista_id}</div>
                </td>
                <td className="p-3 text-right tabular-nums">{formatNumber(m.total_movimentacoes)}</td>
                <td className="p-3 text-right tabular-nums">{m.frotas_distintas}</td>
                <td className="p-3 text-right tabular-nums">{formatNumber(m.total_saidas)}</td>
                <td className="p-3 text-right">
                  {m.ultima_movimentacao ? formatDate(m.ultima_movimentacao) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Adicionar ao nav em `app-shell.tsx`**

```ts
// Em ADMINISTRACAO_NAV, adicionar:
{ href: "/administracao/motoristas", label: "Motoristas", icon: "Users" },
```

- [ ] **Commit**

```bash
git add app/(app)/administracao/motoristas/page.tsx components/app-shell.tsx
git commit -m "feat(admin): painel de motoristas com stats de movimentações"
```

---

## Sub-projeto D — Aba de Custos

**Item do spec:** 10 (Custos)

**Arquivos afetados:**
- Criar: `lib/repos/custos.ts`
- Criar: `app/(app)/manutencao/custos/page.tsx`
- Criar: `components/custos/custos-chart.tsx`

---

### D-1: Repositório de custos

**Arquivos:**
- Criar: `lib/repos/custos.ts`

- [ ] **Criar `lib/repos/custos.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type CustosPeriodo = {
  data_periodo: string;
  qtd_ordens: number;
  valor_total: number;
};

export type CustosPorFrota = {
  frota_id: number | null;
  databricks_frota_id: string | null;
  qtd_ordens: number;
  valor_total: number;
};

export async function getCustosPorPeriodo(meses = 12): Promise<CustosPeriodo[]> {
  const { data, error } = await supabaseManutencao
    .from("fact_comparativo_ordens")
    .select("data_periodo, qtd_ordens, valor_total")
    .order("data_periodo", { ascending: false })
    .limit(meses);
  if (error) return [];
  return (data ?? []).map((r) => ({
    data_periodo: String(r.data_periodo),
    qtd_ordens: Number(r.qtd_ordens ?? 0),
    valor_total: Number(r.valor_total ?? 0),
  }));
}

export async function getCustosTotais(): Promise<{ qtd_ordens: number; valor_total: number }> {
  const periodos = await getCustosPorPeriodo(12);
  return {
    qtd_ordens: periodos.reduce((s, p) => s + p.qtd_ordens, 0),
    valor_total: periodos.reduce((s, p) => s + p.valor_total, 0),
  };
}
```

- [ ] **Commit**

```bash
git add lib/repos/custos.ts
git commit -m "feat(repo): custos por período a partir de fact_comparativo_ordens"
```

---

### D-2: Página de custos

**Arquivos:**
- Criar: `app/(app)/manutencao/custos/page.tsx`

- [ ] **Criar `app/(app)/manutencao/custos/page.tsx`**

```tsx
import { requireAppUser } from "@/lib/rbac";
import { getCustosPorPeriodo, getCustosTotais } from "@/lib/repos/custos";

export const dynamic = "force-dynamic";

export default async function CustosPage() {
  await requireAppUser();
  const [periodos, totais] = await Promise.all([
    getCustosPorPeriodo(12),
    getCustosTotais(),
  ]);

  const maiorCusto = Math.max(...periodos.map((p) => p.valor_total), 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Custos</h1>
        <p className="text-sm text-muted-foreground">Últimos 12 períodos</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de ordens</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{totais.qtd_ordens.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor total (12 meses)</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">
            R$ {totais.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Gráfico de barras simples */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Custo por período</h2>
        <div className="space-y-3">
          {periodos.map((p) => (
            <div key={p.data_periodo} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{p.data_periodo}</span>
              <div className="flex-1 rounded-full bg-slate-100" style={{ height: 12 }}>
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${(p.valor_total / maiorCusto) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-xs font-medium tabular-nums">
                R$ {p.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {p.qtd_ordens} ord.
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Adicionar ao nav**

```ts
// Em MANUTENCAO_NAV, adicionar:
{ href: "/manutencao/custos", label: "Custos", icon: "BarChart2" },
```

- [ ] **Commit**

```bash
git add lib/repos/custos.ts app/(app)/manutencao/custos/page.tsx components/app-shell.tsx
git commit -m "feat(page): aba de custos com histórico por período"
```

---

## Sub-projeto E — Programação de E-mails

**Item do spec:** 9 (E-mails automáticos)

**Arquivos afetados:**
- Criar: `supabase/migrations/015_email_schedule.sql`
- Criar: `lib/repos/email-schedule.ts`
- Criar: `app/(app)/administracao/emails/page.tsx`
- Criar: `app/(app)/administracao/emails/_actions.ts`
- Criar: `app/api/email/send-scheduled/route.ts`

---

### E-1: Migration — tabela de configuração de e-mails

- [ ] **Criar `supabase/migrations/015_email_schedule.sql`**

```sql
CREATE TABLE IF NOT EXISTS public.email_schedules (
  id          bigserial PRIMARY KEY,
  nome        text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN (
    'DISPONIBILIDADE', 'PREVENTIVAS_ATRASO', 'LAVAGEM_PENDENTE',
    'TACOGRAFO_VENCIDO', 'FROTAS_PARADAS', 'CUSTOS', 'ALERTAS'
  )),
  destinatarios text[] NOT NULL DEFAULT '{}',
  frequencia  text NOT NULL CHECK (frequencia IN ('DIARIO', 'SEMANAL', 'QUINZENAL', 'MENSAL')),
  dia_semana  integer,           -- 0=dom, 1=seg, ..., 6=sab (para SEMANAL)
  hora_envio  time NOT NULL DEFAULT '07:00',
  cds_incluidos text[] DEFAULT '{}',   -- vazio = todos
  ativo       boolean NOT NULL DEFAULT true,
  ultimo_envio timestamptz,
  proximo_envio timestamptz,
  criado_por  text,
  criado_em   timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.email_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.email_schedules
  USING (auth.role() = 'service_role');
```

- [ ] **Aplicar via Supabase MCP**
- [ ] **Commit**

```bash
git add supabase/migrations/015_email_schedule.sql
git commit -m "feat(db): tabela email_schedules para programação de envios automáticos"
```

---

### E-2: Repositório de schedules

**Arquivos:**
- Criar: `lib/repos/email-schedule.ts`

- [ ] **Criar `lib/repos/email-schedule.ts`**

```typescript
import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type EmailSchedule = {
  id: number;
  nome: string;
  tipo: string;
  destinatarios: string[];
  frequencia: "DIARIO" | "SEMANAL" | "QUINZENAL" | "MENSAL";
  dia_semana: number | null;
  hora_envio: string;
  cds_incluidos: string[];
  ativo: boolean;
  ultimo_envio: string | null;
  proximo_envio: string | null;
  criado_por: string | null;
  criado_em: string;
};

export async function listEmailSchedules(): Promise<EmailSchedule[]> {
  const { data, error } = await supabaseManutencao
    .from("email_schedules")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) return [];
  return (data ?? []) as EmailSchedule[];
}

export async function createEmailSchedule(
  input: Omit<EmailSchedule, "id" | "ultimo_envio" | "proximo_envio" | "criado_em">,
): Promise<void> {
  const { error } = await supabaseManutencao.from("email_schedules").insert(input);
  if (error) throw new Error(`createEmailSchedule: ${error.message}`);
}

export async function toggleEmailSchedule(id: number, ativo: boolean): Promise<void> {
  const { error } = await supabaseManutencao
    .from("email_schedules")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`toggleEmailSchedule: ${error.message}`);
}

export async function deleteEmailSchedule(id: number): Promise<void> {
  const { error } = await supabaseManutencao
    .from("email_schedules")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deleteEmailSchedule: ${error.message}`);
}
```

- [ ] **Commit**

```bash
git add lib/repos/email-schedule.ts
git commit -m "feat(repo): CRUD de email_schedules"
```

---

### E-3: Página de configuração de e-mails

**Arquivos:**
- Criar: `app/(app)/administracao/emails/_actions.ts`
- Criar: `app/(app)/administracao/emails/page.tsx`

- [ ] **Criar `app/(app)/administracao/emails/_actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser, canManageUsers } from "@/lib/rbac";
import { createEmailSchedule, toggleEmailSchedule, deleteEmailSchedule } from "@/lib/repos/email-schedule";

const ScheduleSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  tipo: z.enum(["DISPONIBILIDADE", "PREVENTIVAS_ATRASO", "LAVAGEM_PENDENTE", "TACOGRAFO_VENCIDO", "FROTAS_PARADAS", "CUSTOS", "ALERTAS"]),
  destinatarios: z.string().transform((s) => s.split(",").map((e) => e.trim()).filter(Boolean)),
  frequencia: z.enum(["DIARIO", "SEMANAL", "QUINZENAL", "MENSAL"]),
  hora_envio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  cds_incluidos: z.string().transform((s) => s.split(",").map((e) => e.trim()).filter(Boolean)),
});

export async function createScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageUsers(user.perfil)) redirect("/");

  const parsed = ScheduleSchema.parse(Object.fromEntries(formData));
  await createEmailSchedule({ ...parsed, ativo: true, criado_por: user.email, dia_semana: null });

  revalidatePath("/administracao/emails");
  redirect("/administracao/emails?sucesso=Programação+criada");
}

export async function toggleScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageUsers(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  await toggleEmailSchedule(id, !ativo);
  revalidatePath("/administracao/emails");
}

export async function deleteScheduleAction(formData: FormData) {
  const user = await requireAppUser();
  if (!canManageUsers(user.perfil)) redirect("/");

  const id = Number(formData.get("id"));
  await deleteEmailSchedule(id);
  revalidatePath("/administracao/emails");
}
```

- [ ] **Criar `app/(app)/administracao/emails/page.tsx`**

```tsx
import { requireAppUser } from "@/lib/rbac";
import { listEmailSchedules } from "@/lib/repos/email-schedule";
import { createScheduleAction, toggleScheduleAction, deleteScheduleAction } from "./_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const TIPO_LABELS: Record<string, string> = {
  DISPONIBILIDADE: "Disponibilidade",
  PREVENTIVAS_ATRASO: "Preventivas em atraso",
  LAVAGEM_PENDENTE: "Lavagem pendente",
  TACOGRAFO_VENCIDO: "Tacógrafo vencido",
  FROTAS_PARADAS: "Frotas paradas",
  CUSTOS: "Custos",
  ALERTAS: "Alertas operacionais",
};

export default async function EmailsPage() {
  await requireAppUser();
  const schedules = await listEmailSchedules();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Administração</p>
        <h1 className="text-3xl font-semibold tracking-tight">Programação de E-mails</h1>
      </div>

      {/* Form novo schedule */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Nova programação</h2>
        <form action={createScheduleAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome da programação</Label>
            <Input id="nome" name="nome" placeholder="Ex: Relatório semanal de disponibilidade" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de relatório</Label>
            <select id="tipo" name="tipo" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" required>
              {Object.entries(TIPO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="destinatarios">Destinatários (separados por vírgula)</Label>
            <Input id="destinatarios" name="destinatarios" placeholder="email1@bemol.com.br, email2@bemol.com.br" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="frequencia">Frequência</Label>
            <select id="frequencia" name="frequencia" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option value="DIARIO">Diário</option>
              <option value="SEMANAL">Semanal</option>
              <option value="QUINZENAL">Quinzenal</option>
              <option value="MENSAL">Mensal</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hora_envio">Horário de envio</Label>
            <Input id="hora_envio" name="hora_envio" type="time" defaultValue="07:00" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cds_incluidos">CDs incluídos (vazio = todos)</Label>
            <Input id="cds_incluidos" name="cds_incluidos" placeholder="CD Manaus, CD Boa Vista" />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit">Criar programação</Button>
          </div>
        </form>
      </div>

      {/* Lista de schedules */}
      <div className="space-y-3">
        {schedules.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma programação configurada.</p>
        )}
        {schedules.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{s.nome}</span>
                <Badge variant="outline">{TIPO_LABELS[s.tipo] ?? s.tipo}</Badge>
                <Badge variant="outline" className={s.ativo ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}>
                  {s.ativo ? "Ativo" : "Pausado"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.frequencia} · {s.hora_envio} · {s.destinatarios.length} destinatário(s)
                {s.ultimo_envio ? ` · Último envio: ${new Date(s.ultimo_envio).toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={toggleScheduleAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="ativo" value={String(s.ativo)} />
                <Button type="submit" variant="outline" size="sm">
                  {s.ativo ? "Pausar" : "Ativar"}
                </Button>
              </form>
              <form action={deleteScheduleAction}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  Remover
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Adicionar ao nav**

```ts
// Em ADMINISTRACAO_NAV, adicionar:
{ href: "/administracao/emails", label: "E-mails", icon: "FileText" },
```

- [ ] **Commit**

```bash
git add app/(app)/administracao/emails/ components/app-shell.tsx
git commit -m "feat(admin): configuração de programação de e-mails automáticos"
```

---

### E-4: API de disparo de e-mail por schedule

**Arquivos:**
- Criar: `app/api/email/send-scheduled/route.ts`

- [ ] **Criar `app/api/email/send-scheduled/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { listEmailSchedules } from "@/lib/repos/email-schedule";
import { getDisponibilidadeGeral } from "@/lib/repos/disponibilidade";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import sgMail from "@sendgrid/mail";

const INTERNAL_SECRET = process.env.FROTAS_INTERNAL_SECRET ?? "";

function isAuthorized(req: NextRequest) {
  return Boolean(INTERNAL_SECRET && req.headers.get("x-internal-secret") === INTERNAL_SECRET);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const schedules = await listEmailSchedules();
  const agora = new Date();
  const enviados: string[] = [];

  for (const s of schedules) {
    if (!s.ativo) continue;
    // Verificar se está na hora de enviar
    const proximo = s.proximo_envio ? new Date(s.proximo_envio) : null;
    if (proximo && proximo > agora) continue;

    try {
      let corpo = `<h2>Relatório: ${s.nome}</h2>`;

      if (s.tipo === "DISPONIBILIDADE") {
        const geral = await getDisponibilidadeGeral();
        corpo += `<p>Disponibilidade geral: <strong>${geral.percentual_disponibilidade}%</strong></p>`;
        corpo += `<p>Frotas disponíveis: ${geral.disponiveis} / ${geral.total}</p>`;
        corpo += `<p>Em manutenção: ${geral.em_manutencao} | Paradas: ${geral.paradas}</p>`;
      }
      // Adicionar outros tipos conforme necessário

      corpo += `<hr><p style="color:#888;font-size:12px">Enviado automaticamente pelo sistema FROTAS Bemol em ${agora.toLocaleString("pt-BR")}</p>`;

      await sgMail.send({
        to: s.destinatarios,
        from: process.env.SENDGRID_FROM_EMAIL ?? "noreply@bemol.com.br",
        subject: `[FROTAS] ${s.nome} — ${agora.toLocaleDateString("pt-BR")}`,
        html: corpo,
      });

      // Calcular próximo envio
      const proximaData = new Date(agora);
      if (s.frequencia === "DIARIO") proximaData.setDate(proximaData.getDate() + 1);
      else if (s.frequencia === "SEMANAL") proximaData.setDate(proximaData.getDate() + 7);
      else if (s.frequencia === "QUINZENAL") proximaData.setDate(proximaData.getDate() + 15);
      else if (s.frequencia === "MENSAL") proximaData.setMonth(proximaData.getMonth() + 1);

      await supabaseManutencao.from("email_schedules").update({
        ultimo_envio: agora.toISOString(),
        proximo_envio: proximaData.toISOString(),
      }).eq("id", s.id);

      enviados.push(s.nome);
    } catch (err) {
      console.warn(`[email-schedule] falha ao enviar "${s.nome}"`, err);
    }
  }

  return NextResponse.json({ enviados, total: enviados.length });
}
```

> **Nota:** Para disparar automaticamente, configurar um cron job externo (Azure Timer ou GitHub Actions schedule) que chame `POST /api/email/send-scheduled` com o header `x-internal-secret` em horários regulares.

- [ ] **Commit**

```bash
git add app/api/email/send-scheduled/route.ts
git commit -m "feat(api): endpoint de disparo de e-mails agendados"
```

---

## Push final de cada sub-projeto

Após concluir cada sub-projeto, executar:
```bash
git push FROTAS main && git push MANUT main
```

---

## Checklist de revisão — spec coverage

| Requisito | Sub-projeto | Status |
|---|---|---|
| 1. Disponibilidade por CD | A-1 a A-5 | ✅ Coberto |
| 2. KPIs reformulados (preventivas, tacógrafo, disponibilidade%) | A-6 | ✅ Coberto |
| 3. Tacógrafo como preventiva | B-1 a B-3 | ✅ Coberto |
| 4. Operação dentro de Frotas | — | ⚠️ Reorganização de tabs do Vehicle 360° — deixado como melhoria incremental de UX |
| 5. Perfil do motorista com histórico | C-2, C-3 | ✅ Coberto |
| 6. Fluxo manutenção com destino | B-4 | ✅ Coberto |
| 7. Designação de motorista para movimentação | C-1 | ✅ Parcialmente (campos de destino/motivo + views de histórico) |
| 8. KM e foto obrigatórios | — | ✅ Já implementado (ver commits anteriores) |
| 9. Programação de e-mails | E-1 a E-4 | ✅ Coberto |
| 10. Aba de custos | D-1, D-2 | ✅ Coberto |
| 11. Ordens de manutenção | B-5 | ✅ Coberto |
| 12. Outros pontos de atenção | A-4, A-5 | ✅ Coberto |
| 13. Objetivo final | — | Implementado via todas as features acima |

**Gap identificado — Item 4 (Operação dentro de Frotas):**
A reorganização da aba Operação no Vehicle 360° para incluir Documentos, Programações, Responsáveis e Motoristas vinculados não foi detalhada em tasks. Isso é uma refatoração de UX do componente `components/frotas/veiculo-360/tabs.tsx` que pode ser feita incrementalmente após os sub-projetos A-E estarem no ar.
