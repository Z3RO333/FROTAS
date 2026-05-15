-- Migration 015: Configuração de envio automático de e-mails

CREATE TABLE IF NOT EXISTS public.email_schedules (
  id            bigserial PRIMARY KEY,
  nome          text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN (
    'DISPONIBILIDADE','PREVENTIVAS_ATRASO','LAVAGEM_PENDENTE',
    'TACOGRAFO_VENCIDO','FROTAS_PARADAS','CUSTOS','ALERTAS'
  )),
  destinatarios text[] NOT NULL DEFAULT '{}',
  frequencia    text NOT NULL CHECK (frequencia IN ('DIARIO','SEMANAL','QUINZENAL','MENSAL')),
  dia_semana    integer,
  hora_envio    time NOT NULL DEFAULT '07:00',
  cds_incluidos text[] DEFAULT '{}',
  ativo         boolean NOT NULL DEFAULT true,
  ultimo_envio  timestamptz,
  proximo_envio timestamptz,
  criado_por    text,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.email_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.email_schedules
  USING (auth.role() = 'service_role');
