-- Modulo: Visao IA para imagens de checklist

insert into storage.buckets (id, name, public)
values ('checklist-images', 'checklist-images', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'service_role_checklist_images_all'
  ) then
    create policy "service_role_checklist_images_all"
      on storage.objects
      for all
      using (bucket_id = 'checklist-images' and public.is_service_role())
      with check (bucket_id = 'checklist-images' and public.is_service_role());
  end if;
end $$;

create table if not exists public.checklist_image_inspections (
  id uuid primary key default gen_random_uuid(),
  checklist_id bigint not null references public.checklists_frota(id) on delete cascade,
  checklist_item_codigo text,
  source_type text not null check (source_type in ('hodometro', 'item', 'abastecimento')),
  storage_path text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'processed', 'failed')),
  model_name text,
  confidence double precision,
  detections jsonb not null default '[]'::jsonb,
  summary text,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_checklist_image_inspections_checklist
  on public.checklist_image_inspections (checklist_id, created_at desc);

create index if not exists idx_checklist_image_inspections_status
  on public.checklist_image_inspections (status, created_at asc);

alter table public.checklist_image_inspections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'checklist_image_inspections'
      and policyname = 'service_role_only'
  ) then
    create policy "service_role_only"
      on public.checklist_image_inspections
      using (public.is_service_role())
      with check (public.is_service_role());
  end if;
end $$;
