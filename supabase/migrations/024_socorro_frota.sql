-- Extend tipo_sinistro check to accept 'socorro'
alter table public.sinistros_frota drop constraint if exists sinistros_frota_tipo_sinistro_check;

alter table public.sinistros_frota
add constraint sinistros_frota_tipo_sinistro_check
check (tipo_sinistro in ('veiculo', 'casa', 'socorro'));

-- New columns for socorro flow
alter table public.sinistros_frota
add column if not exists telefone_solicitante text,
add column if not exists precisa_guincho boolean,
add column if not exists responsavel_atendimento text,
add column if not exists atendimento_concluido_em timestamptz;
