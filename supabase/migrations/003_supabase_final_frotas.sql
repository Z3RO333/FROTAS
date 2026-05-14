-- Supabase como destino final da plataforma de frotas.
-- Esta migration é incremental: não apaga dados existentes e estende o schema legado.

alter table public.veiculos
  add column if not exists chassi text,
  add column if not exists renavam text,
  add column if not exists ano_fabricacao integer,
  add column if not exists km_atual bigint,
  add column if not exists status text default 'disponivel',
  add column if not exists observacoes text,
  add column if not exists vendido boolean not null default false,
  add column if not exists ano_venda integer,
  add column if not exists ativo boolean not null default true,
  add column if not exists atualizado_por text,
  add column if not exists km_origem text,
  add column if not exists km_atualizado_em timestamptz,
  add column if not exists km_validado boolean,
  add column if not exists ultimo_checklist_id bigint,
  add column if not exists ultimo_checklist_em timestamptz,
  add column if not exists ultimo_motorista_id text,
  add column if not exists ultimo_motorista_nome text,
  add column if not exists ultimo_abastecimento_em timestamptz,
  add column if not exists ultimo_abastecimento_litros double precision,
  add column if not exists status_operacional text;

create index if not exists veiculos_codigo_frota_idx on public.veiculos (lower(codigo_frota));
create index if not exists veiculos_placa_idx on public.veiculos (lower(placa));
create index if not exists veiculos_chassi_idx on public.veiculos (lower(chassi));
create index if not exists veiculos_status_idx on public.veiculos (status);
create index if not exists veiculos_ativo_vendido_idx on public.veiculos (ativo, vendido);

create table if not exists public.usuarios (
  id text primary key,
  nome text,
  email text unique,
  matricula text,
  perfil text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.frotas_historico (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  campo text not null,
  valor_antigo text,
  valor_novo text,
  alterado_em timestamptz not null default now(),
  alterado_por text
);

create table if not exists public.checklists_frota (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  motorista_id text not null,
  motorista_nome text,
  data_checklist timestamptz not null default now(),
  km_informado bigint,
  km_lido_ocr bigint,
  ocr_confianca double precision,
  km_confirmado boolean,
  foto_km_url text,
  status_geral text not null,
  observacao_original text,
  observacao_corrigida_ia text,
  criado_em timestamptz not null default now()
);

create table if not exists public.checklist_itens (
  id bigserial primary key,
  checklist_id bigint not null references public.checklists_frota(id) on delete cascade,
  item_codigo text not null,
  item_nome text not null,
  grupo text not null,
  status text not null,
  obrigatorio boolean not null default false,
  critico boolean not null default false,
  observacao text,
  foto_url text
);

create table if not exists public.pendencias_frota (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  item_nome text,
  gravidade text not null,
  status text not null default 'ABERTA',
  responsavel_id text,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create table if not exists public.anexos_checklist (
  id bigserial primary key,
  checklist_id bigint references public.checklists_frota(id) on delete cascade,
  checklist_item_id bigint references public.checklist_itens(id) on delete cascade,
  tipo text,
  nome_arquivo text,
  mime_type text,
  tamanho_bytes bigint,
  storage_url text,
  criado_em timestamptz not null default now()
);

create table if not exists public.historico_status_frota (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  status_antigo text,
  status_novo text,
  motivo text,
  alterado_em timestamptz not null default now(),
  alterado_por text
);

create table if not exists public.movimentacoes_frota (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  motorista_id text,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  tipo_movimentacao text not null,
  data_hora timestamptz not null default now(),
  usuario_portaria_id text,
  observacao text,
  criado_em timestamptz not null default now()
);

create table if not exists public.historico_km_frota (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  motorista_id text,
  motorista_nome text,
  km_anterior bigint,
  km_novo bigint not null,
  diferenca_km bigint,
  origem text not null,
  foto_km_url text,
  validado boolean not null default false,
  validado_por text,
  validado_em timestamptz,
  observacao_validacao text,
  criado_em timestamptz not null default now()
);

create table if not exists public.abastecimentos_frota (
  id bigserial primary key,
  frota_id bigint not null references public.veiculos(id) on delete cascade,
  motorista_id text,
  motorista_nome text,
  checklist_id bigint references public.checklists_frota(id) on delete set null,
  data_hora timestamptz not null default now(),
  tipo_combustivel text,
  litros_combustivel double precision,
  litros_arla double precision,
  km_no_abastecimento bigint,
  foto_comprovante_url text,
  origem text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.email_logs (
  id bigserial primary key,
  tipo text not null,
  frota_id bigint references public.veiculos(id) on delete set null,
  destinatarios text,
  assunto text,
  enviado_em timestamptz not null default now(),
  enviado_por text,
  status text,
  erro_msg text
);

create table if not exists public.unidades_operacionais (
  id bigserial primary key,
  uf text,
  negocio text,
  loja text,
  centro text,
  centro_custo text,
  local_negocio text,
  cnpj text,
  inscricao_estadual text,
  inscricao_suframa text,
  inscricao_municipal text,
  cep text,
  endereco text,
  ie_subst_tributario text,
  origem_arquivo text,
  importado_em timestamptz not null default now()
);

create table if not exists public.migration_frota_id_map (
  databricks_frota_id bigint primary key,
  supabase_veiculo_id bigint references public.veiculos(id) on delete cascade,
  codigo_frota text,
  criado_em timestamptz not null default now()
);

alter table public.documents
  alter column dut_url drop not null,
  alter column crlv_url drop not null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_frotas_historico_frota on public.frotas_historico (frota_id, alterado_em desc);
create index if not exists idx_checklists_frota_data on public.checklists_frota (frota_id, data_checklist desc);
create index if not exists idx_checklists_motorista_data on public.checklists_frota (motorista_id, data_checklist desc);
create index if not exists idx_checklist_itens_checklist on public.checklist_itens (checklist_id);
create index if not exists idx_pendencias_frota_status on public.pendencias_frota (frota_id, status);
create index if not exists idx_movimentacoes_frota_data on public.movimentacoes_frota (frota_id, data_hora desc);
create index if not exists idx_historico_km_frota_data on public.historico_km_frota (frota_id, criado_em desc);
create index if not exists idx_historico_km_validacao on public.historico_km_frota (validado, criado_em);
create index if not exists idx_abastecimentos_frota_data on public.abastecimentos_frota (frota_id, data_hora desc);
create index if not exists idx_unidades_busca on public.unidades_operacionais (lower(loja), lower(centro), lower(cnpj));

drop trigger if exists trg_documents_updated_at on public.documents;

create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

do $$ declare
  t text;
begin
  foreach t in array array[
    'usuarios','frotas_historico','checklists_frota','checklist_itens',
    'pendencias_frota','anexos_checklist','historico_status_frota',
    'movimentacoes_frota','historico_km_frota','abastecimentos_frota',
    'email_logs','unidades_operacionais','migration_frota_id_map'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = 'service_role_only'
    ) then
      execute format(
        'create policy "service_role_only" on public.%I using (public.is_service_role())',
        t
      );
    end if;
  end loop;
end $$;
