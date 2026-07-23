-- Os KPIs também devem retirar de "disponíveis" as frotas cuja saída foi registrada.
begin;

create or replace function public.get_frotas_kpis()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_ativos',
      count(*) filter (where ativo = true and vendido = false),

    'total_disponiveis',
      count(*) filter (where ativo = true and vendido = false
        and status not in ('manutencao', 'critico', 'vendido')
        and status_operacional is distinct from 'SAIDA_REGISTRADA'),

    'total_indisponiveis',
      count(*) filter (where ativo = true and vendido = false
        and (status in ('manutencao', 'critico') or status_operacional = 'SAIDA_REGISTRADA')),

    'total_manutencao',
      count(*) filter (where ativo = true and vendido = false
        and status = 'manutencao'),

    'total_manutencao_atrasada',
      count(*) filter (where ativo = true and vendido = false
        and status = 'manutencao'
        and manutencao_prev_retorno is not null
        and manutencao_prev_retorno::date < current_date),

    'total_manutencao_longa',
      count(*) filter (where ativo = true and vendido = false
        and status = 'manutencao'
        and manutencao_iniciado_em is not null
        and manutencao_iniciado_em < now() - interval '7 days'),

    'total_sem_km',
      count(*) filter (where ativo = true and vendido = false
        and km_atual is null),

    'total_acima_7',
      count(*) filter (where ativo = true and vendido = false
        and ano_fabricacao is not null
        and (extract(year from now())::int - ano_fabricacao) >= 7),

    'total_critico',
      count(*) filter (where ativo = true and vendido = false and (
        (ano_fabricacao is not null and (extract(year from now())::int - ano_fabricacao) >= 10)
        or status = 'critico'
      )),

    'total_atencao',
      count(*) filter (where ativo = true and vendido = false
        and not (
          (ano_fabricacao is not null and (extract(year from now())::int - ano_fabricacao) >= 10)
          or status = 'critico'
        )
        and (
          (ano_fabricacao is not null and (extract(year from now())::int - ano_fabricacao) >= 7)
          or status = 'manutencao'
          or (placa is null or chassi is null or renavam is null
              or modelo is null or ano_fabricacao is null or local is null)
        )
      ),

    'total_cadastro_incompleto',
      count(*) filter (where ativo = true and vendido = false and (
        placa is null or chassi is null or renavam is null
        or modelo is null or ano_fabricacao is null or local is null
      )),

    'idade_media',
      round(avg(extract(year from now())::int - ano_fabricacao)
        filter (where ativo = true and vendido = false and ano_fabricacao is not null), 1),

    'km_medio',
      round(avg(km_atual)
        filter (where ativo = true and vendido = false and km_atual is not null))
  )
  from public.veiculos;
$$;

grant execute on function public.get_frotas_kpis() to service_role;

commit;
