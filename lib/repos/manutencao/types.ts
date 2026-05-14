export type TipoServico =
  | "troca_pneu" | "lavagem" | "alinhamento" | "balanceamento"
  | "tacografo" | "portas_rool_up" | "embreagem" | "motor"
  | "km_diario" | "ar-condicionado" | "suspensao" | "bateria";

export type SegmentoEquipamento = "EMPILHADEIRA" | "SELECIONADORA" | "PALETEIRA";
export type TipoComponente = "CARREGADOR" | "BATERIA";
export type TipoPreventiva = "300h" | "1500h";
export type StatusDemanda = "disponivel" | "em_andamento" | "concluido" | "cancelado";
export type PrioridadeDemanda = "baixa" | "normal" | "alta" | "urgente";

export interface Veiculo {
  id: number;
  codigo_frota: string;
  placa: string | null;
  modelo: string | null;
  qtd_pneus: number;
  local: string | null;
  classificacao_tipo: string | null;
  equipamento: string | null;
  intervalo_lavagem_dias: number;
  intervalo_alinhamento_km: number;
  intervalo_suspensao_km: number;
  intervalo_arcondicionado_dias: number;
  intervalo_tacografo_dias: number;
  intervalo_portas_rool_up_dias: number;
  intervalo_embreagem_dias: number;
  intervalo_motor_km: number;
  created_at: string;
  updated_at: string;
}

export interface ServicoApp {
  id_servico: string;
  id_veiculo: string;
  tipo_servico: TipoServico;
  data_servico: string;
  quilometragem: number | null;
  observacoes: string | null;
  registrado_por_email: string | null;
  registrado_por_nome: string | null;
  created_at: string;
}

export interface TrocaPneuApp {
  id: number;
  id_servico: string;
  posicao: string;
  numero_fogo: string | null;
  quilometragem: number | null;
  observacoes: string | null;
}

export interface NumeroFogo {
  id: number;
  numero_fogo: string;
  contagem: number;
  data: string;
  placa: string | null;
  frota: string | null;
  qtd_pneus: number | null;
}

export interface EquipamentoApp {
  id: string;
  equipamento: string;
  modelo_marca: string | null;
  segmento: SegmentoEquipamento;
  numero_equip: string;
  local: string | null;
  setor: string | null;
  horimetro_atual: number | null;
  ativo: boolean;
}

export interface DocumentRecord {
  id: string;
  frota: string;
  placa: string;
  modelo: string;
  dut_url: string;
  crlv_url: string;
  created_at: string;
  created_by: string | null;
}

export interface DemandaApp {
  id: string;
  status: StatusDemanda;
  descricao: string;
  tipo_movimentacao: string;
  prioridade: PrioridadeDemanda;
  motorista_nome: string | null;
  motorista_email: string | null;
  id_veiculo: string | null;
  destino: string | null;
  concluido_em: string | null;
  created_at: string;
}

export interface OficinasApp {
  id: number;
  nome: string;
  categoria: string;
  localizacao: string;
  localizacao_lat: number | null;
  localizacao_lng: number | null;
  tipos_servico: string[];
  ativo: boolean;
}
