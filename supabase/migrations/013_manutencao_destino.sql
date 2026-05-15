-- Migration 013: Campo destino no fluxo de manutenção + histórico de tacógrafo

-- Adiciona campos de destino quando frota é enviada para manutenção/parada
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS manutencao_destino text
    CHECK (manutencao_destino IN ('OFICINA','LAVAGEM','PREVENTIVA','CORRETIVA','ALINHAMENTO','AR_CONDICIONADO','TACOGRAFO','OUTRO')),
  ADD COLUMN IF NOT EXISTS manutencao_destino_detalhe text;

-- Tabela de histórico de tacógrafo por veículo
CREATE TABLE IF NOT EXISTS public.veiculo_tacografo_historico (
  id            bigserial PRIMARY KEY,
  veiculo_id    integer NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  data_servico  date NOT NULL,
  data_proxima  date,
  observacao    text,
  registrado_por text,
  criado_em     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tacografo_veiculo
  ON public.veiculo_tacografo_historico (veiculo_id, data_servico DESC);

ALTER TABLE public.veiculo_tacografo_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.veiculo_tacografo_historico
  USING (auth.role() = 'service_role');
