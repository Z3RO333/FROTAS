import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type TerceiroSinistroInput = {
  nome: string;
  telefone: string;
  cpf: string;
};

export type CreateSinistroInput = {
  submission_id: string;
  ticket_number: string;
  tipo_sinistro: "veiculo" | "casa" | "socorro";
  frota_id?: number | null;
  numero_frota?: string | null;
  placa?: string | null;
  motorista_id: string;
  motorista_nome: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  setor?: string | null;
  descricao: string;
  houve_feridos: boolean;
  samu_bombeiros_presente?: boolean | null;
  terceiros: TerceiroSinistroInput[];
  media_paths: string[];
  telefone_solicitante?: string | null;
  precisa_guincho?: boolean | null;
};

export type SinistroRow = {
  id: number;
  ticket_number: string;
  tipo_sinistro: "veiculo" | "casa" | "socorro";
  frota_id: number | null;
  numero_frota: string | null;
  placa: string | null;
  motorista_id: string;
  motorista_nome: string | null;
  data_incidente: string;
  endereco: string;
  setor: string | null;
  descricao: string;
  houve_feridos: boolean;
  samu_bombeiros_presente: boolean | null;
  terceiros_quantidade: number;
  terceiros: TerceiroSinistroInput[];
  media_paths: string[];
  status: string;
  criado_em: string;
  telefone_solicitante: string | null;
  precisa_guincho: boolean | null;
  responsavel_atendimento: string | null;
  atendimento_concluido_em: string | null;
};

export async function createSinistro(input: CreateSinistroInput): Promise<{ id: number }> {
  const isSocorro = input.tipo_sinistro === "socorro";
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .insert({
      submission_id: input.submission_id,
      ticket_number: input.ticket_number,
      tipo_sinistro: input.tipo_sinistro,
      frota_id: input.frota_id ?? null,
      numero_frota: input.numero_frota ?? null,
      placa: input.placa ?? null,
      motorista_id: input.motorista_id,
      motorista_nome: input.motorista_nome,
      data_incidente: new Date().toISOString(),
      endereco: input.endereco,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      setor: input.setor ?? null,
      descricao: input.descricao,
      houve_feridos: input.houve_feridos,
      samu_bombeiros_presente: input.houve_feridos ? input.samu_bombeiros_presente ?? null : null,
      terceiros_quantidade: input.terceiros.length,
      terceiros: input.terceiros,
      media_paths: input.media_paths,
      status: isSocorro ? "ABERTO" : "PENDENTE",
      telefone_solicitante: input.telefone_solicitante ?? null,
      precisa_guincho: input.precisa_guincho ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number(data.id) };
}

export async function getSinistroBySubmissionId(
  submissionId: string,
  motoristaId: string
): Promise<{ ticket_number: string } | null> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .select("ticket_number")
    .eq("submission_id", submissionId)
    .eq("motorista_id", motoristaId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ticket_number: String(data.ticket_number) } : null;
}

const COLS_SINISTRO_LIST =
  "id,ticket_number,tipo_sinistro,frota_id,numero_frota,placa,motorista_id,motorista_nome,data_incidente,endereco,setor,descricao,houve_feridos,samu_bombeiros_presente,terceiros_quantidade,terceiros,media_paths,status,criado_em,telefone_solicitante,precisa_guincho,responsavel_atendimento,atendimento_concluido_em";

export async function listDriverSinistros(email: string, limit = 50): Promise<SinistroRow[]> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .select(COLS_SINISTRO_LIST)
    .eq("motorista_id", email)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listDriverSinistros: ${error.message}`);

  return (data ?? []) as SinistroRow[];
}

export async function listAdminSinistros(limit = 200): Promise<SinistroRow[]> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .select(COLS_SINISTRO_LIST)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listAdminSinistros: ${error.message}`);

  return (data ?? []) as SinistroRow[];
}

export async function listSinistrosByFrota(frotaId: number, limit = 20): Promise<SinistroRow[]> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .select(COLS_SINISTRO_LIST)
    .eq("frota_id", frotaId)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listSinistrosByFrota: ${error.message}`);

  return (data ?? []) as SinistroRow[];
}

export async function sinistrosDashboardKpis(): Promise<{
  total: number;
  pendentes: number;
  com_feridos: number;
  com_fotos: number;
  socorros_abertos: number;
}> {
  const rows = await listAdminSinistros(500);
  const SOCORRO_ABERTO_STATUSES = new Set(["ABERTO", "EM_ATENDIMENTO", "GUINCHO_ACIONADO"]);
  return {
    total: rows.length,
    pendentes: rows.filter((row) => row.status === "PENDENTE").length,
    com_feridos: rows.filter((row) => row.houve_feridos).length,
    com_fotos: rows.filter((row) => (row.media_paths?.length ?? 0) > 0).length,
    socorros_abertos: rows.filter(
      (row) => row.tipo_sinistro === "socorro" && SOCORRO_ABERTO_STATUSES.has(row.status)
    ).length,
  };
}

export type SocorroStatus = "ABERTO" | "EM_ATENDIMENTO" | "GUINCHO_ACIONADO" | "RESOLVIDO" | "CANCELADO";
export type SinistroStatus = "PENDENTE" | "RESOLVIDO" | "CANCELADO";

export async function updateSinistroStatus(
  sinistroId: number,
  novoStatus: SinistroStatus,
  adminEmail: string
): Promise<void> {
  const { data: row, error: fetchError } = await supabaseManutencao
    .from("sinistros_frota")
    .select("id,tipo_sinistro")
    .eq("id", sinistroId)
    .single();

  if (fetchError || !row) throw new Error("Sinistro nao encontrado.");
  if (row.tipo_sinistro === "socorro") throw new Error("Use atualizarStatusSocorro para sinistros de socorro.");

  const updates: Record<string, unknown> = {
    status: novoStatus,
    responsavel_atendimento: adminEmail,
  };
  if (novoStatus === "RESOLVIDO" || novoStatus === "CANCELADO") {
    updates.atendimento_concluido_em = new Date().toISOString();
  }

  const { error } = await supabaseManutencao
    .from("sinistros_frota")
    .update(updates)
    .eq("id", sinistroId);

  if (error) throw error;
}

export async function updateSocorroStatus(
  sinistroId: number,
  novoStatus: SocorroStatus,
  adminEmail: string
): Promise<void> {
  const { data: row, error: fetchError } = await supabaseManutencao
    .from("sinistros_frota")
    .select("id,tipo_sinistro,status,responsavel_atendimento")
    .eq("id", sinistroId)
    .single();

  if (fetchError || !row) throw new Error("Solicitacao de socorro nao encontrada.");
  if (row.tipo_sinistro !== "socorro") throw new Error("Essa acao so se aplica a solicitacoes de socorro.");

  const updates: Record<string, unknown> = { status: novoStatus };

  if (row.status === "ABERTO" && novoStatus !== "ABERTO" && !row.responsavel_atendimento) {
    updates.responsavel_atendimento = adminEmail;
  }

  if (novoStatus === "RESOLVIDO" || novoStatus === "CANCELADO") {
    updates.atendimento_concluido_em = new Date().toISOString();
  }

  const { error } = await supabaseManutencao
    .from("sinistros_frota")
    .update(updates)
    .eq("id", sinistroId);

  if (error) throw error;
}
