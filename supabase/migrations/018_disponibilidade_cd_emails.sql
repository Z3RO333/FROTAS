-- Migration 018: disponibilidade por CD e historico de envios programados

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS cd_nome text,
  ADD COLUMN IF NOT EXISTS resumo text,
  ADD COLUMN IF NOT EXISTS conteudo_html text,
  ADD COLUMN IF NOT EXISTS schedule_id bigint REFERENCES public.email_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_tipo_enviado
  ON public.email_logs (tipo, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_cd_enviado
  ON public.email_logs (cd_nome, enviado_em DESC);

ALTER TABLE public.email_schedules
  DROP CONSTRAINT IF EXISTS email_schedules_tipo_check,
  ADD CONSTRAINT email_schedules_tipo_check CHECK (tipo IN (
    'DISPONIBILIDADE','PREVENTIVAS_ATRASO','LAVAGEM_PENDENTE',
    'TACOGRAFO_VENCIDO','FROTAS_PARADAS','CUSTOS','ALERTAS',
    'RELATORIO_DIARIO_IA'
  ));

ALTER TABLE public.email_schedules
  DROP CONSTRAINT IF EXISTS email_schedules_frequencia_check,
  ADD CONSTRAINT email_schedules_frequencia_check CHECK (
    frequencia IN ('DIARIO','SEMANAL','QUINZENAL','MENSAL','PERSONALIZADO')
  );

CREATE INDEX IF NOT EXISTS idx_email_schedules_tipo_ativo
  ON public.email_schedules (tipo, ativo, proximo_envio);
