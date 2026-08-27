create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_fornecedores_pecas_updated_at on public.fornecedores_pecas;
create trigger trg_fornecedores_pecas_updated_at
before update on public.fornecedores_pecas
for each row execute function public.set_atualizado_em();

drop trigger if exists trg_pedidos_pecas_updated_at on public.pedidos_pecas;
create trigger trg_pedidos_pecas_updated_at
before update on public.pedidos_pecas
for each row execute function public.set_atualizado_em();

update public.fornecedores_pecas
set nome = case email
  when 'vendas@adsautopecas.com.br' then 'ADS Auto Peças'
  when 'vendas5@barretopecas.com.br' then 'Barreto Peças'
  when 'faturamento@norteautopecas.com.br' then 'Norte Auto Peças'
  else nome
end
where email in (
  'vendas@adsautopecas.com.br',
  'vendas5@barretopecas.com.br',
  'faturamento@norteautopecas.com.br'
);
