-- Fix 1: replace fragile is_service_role() with safe auth.role() version
create or replace function public.is_service_role()
returns boolean language sql stable as $$
  select auth.role() = 'service_role';
$$;
-- Fix 2: drop duplicate index (already covered by UNIQUE constraint on (id_veiculo, tipo_servico))
drop index if exists public.idx_km_base_veiculo_tipo;
-- Fix 3: add missing created_at audit column to servicos_km_base_app
alter table public.servicos_km_base_app
  add column if not exists created_at timestamptz not null default now();
