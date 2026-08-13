-- unique(evento, chave) nao bloqueia duplicatas quando chave e NULL (regra
-- padrao do Postgres: NULL nunca e igual a NULL numa unique constraint) —
-- o indice parcial criado pra cobrir os eventos "gerais" nao e o mesmo alvo
-- que ON CONFLICT (evento, chave) usa, entao o upsert falharia ao reeditar
-- um evento geral. Troca NULL por '' como sentinela de "sem area", pra que
-- a unique constraint sozinha resolva tudo.
drop index if exists public.notificacao_destinatarios_geral_unique;

alter table public.notificacao_destinatarios
  alter column chave set default '';

update public.notificacao_destinatarios
set chave = ''
where chave is null;

alter table public.notificacao_destinatarios
  alter column chave set not null;
