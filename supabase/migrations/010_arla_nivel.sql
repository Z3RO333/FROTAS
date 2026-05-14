-- Migration 010 — Suporte a nível de arla no veículo (mesmo padrão de combustível)

alter table public.veiculos
  add column if not exists arla_atual_nivel integer
    check (arla_atual_nivel is null or (arla_atual_nivel >= 0 and arla_atual_nivel <= 4)),
  add column if not exists arla_atualizado_em timestamptz,
  add column if not exists arla_origem text;

-- Histórico de arla (espelha veiculo_combustivel_historico)
create table if not exists public.veiculo_arla_historico (
  id bigserial primary key,
  veiculo_id bigint not null references public.veiculos(id) on delete cascade,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  nivel_relativo integer check (nivel_relativo is null or (nivel_relativo >= 0 and nivel_relativo <= 4)),
  origem text not null,
  usuario_id text,
  criado_em timestamptz not null default now()
);

create index if not exists veiculo_arla_hist_vid_idx
  on public.veiculo_arla_historico (veiculo_id, criado_em desc);

alter table public.veiculo_arla_historico enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'veiculo_arla_historico' and policyname = 'service_role_only'
  ) then
    create policy "service_role_only" on public.veiculo_arla_historico
      using (public.is_service_role()) with check (public.is_service_role());
  end if;
end $$;
