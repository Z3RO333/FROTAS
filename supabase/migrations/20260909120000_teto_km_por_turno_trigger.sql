-- Teto absoluto de KM por turno, no banco, sem escape por justificativa.
--
-- Contexto: em 09/09/2026 a frota 108 gravou 18.921.414 km (hodômetro real:
-- 189.214). A leitura do painel duplicou os dígitos finais e nada barrou: a
-- validação em lib/checklists/rules.ts libera qualquer variação desde que
-- exista justificativa em texto, e o valor sobrescreveu o km_atual do veículo.
-- Foi o mesmo mecanismo dos 36 registros corrigidos em 08/09.
--
-- A migration 20260902100000 tentou fechar isso dentro da RPC, mas nunca foi
-- aplicada neste banco (a coluna justificativa_km não existe e a função em
-- produção não tem o teto). Em vez de recriar a função inteira — que
-- reverteria qualquer ajuste feito depois — a barreira vira um trigger sobre
-- historico_km_frota: vale para a RPC e para qualquer outro caminho de
-- inserção, e a RPC é atômica, então a exceção aborta o checklist inteiro.
--
-- 50.000 km por turno é o limite acordado: acima disso não é viagem longa de
-- redistribuição de frota, é dígito a mais. Entre 1.500 e 50.000 a
-- justificativa continua valendo (regra em lib/checklists/rules.ts).
--
-- Correções manuais de histórico seguem possíveis: o trigger é BEFORE INSERT,
-- não afeta UPDATE.

alter table public.historico_km_frota
  add column if not exists justificativa_km text;

create or replace function public.valida_teto_km_por_turno()
returns trigger
language plpgsql
as $$
declare
  v_limite constant bigint := 50000;
  v_delta  bigint;
begin
  if new.km_anterior is null or new.km_novo is null then
    return new;
  end if;

  v_delta := new.km_novo - new.km_anterior;
  if v_delta > v_limite then
    raise exception
      'Variação de KM impossível: % km em um turno (de % para %). Confira os dígitos do hodômetro.',
      v_delta, new.km_anterior, new.km_novo
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_valida_teto_km_por_turno on public.historico_km_frota;

create trigger trg_valida_teto_km_por_turno
  before insert on public.historico_km_frota
  for each row
  execute function public.valida_teto_km_por_turno();
