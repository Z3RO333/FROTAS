-- Substitui o controle manual (WhatsApp + planilha) de deslocamento de
-- frotas entre unidades por um quadro de atividades dentro do app.
begin;

create table if not exists public.atividades_manutencao (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  frota_codigo text not null,
  tipo text not null check (tipo in ('LEVAR_PARA', 'LIBERADA', 'TESTE_PERCURSO', 'OUTRO')),
  local text not null,
  observacao text,
  motorista_id text not null references public.usuarios(id),
  motorista_nome text not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'CONCLUIDA')),
  foto_conclusao_path text,
  criado_por_email text not null,
  criado_por_nome text not null,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists atividades_manutencao_motorista_status_idx
  on public.atividades_manutencao (motorista_id, status);
create index if not exists atividades_manutencao_frota_idx
  on public.atividades_manutencao (frota_id);

alter table public.atividades_manutencao enable row level security;

drop policy if exists atividades_manutencao_service_role on public.atividades_manutencao;
create policy atividades_manutencao_service_role on public.atividades_manutencao
  for all using (public.is_service_role()) with check (public.is_service_role());

insert into storage.buckets (id, name, public)
values ('atividades-media', 'atividades-media', false)
on conflict (id) do update set public = false;

commit;
