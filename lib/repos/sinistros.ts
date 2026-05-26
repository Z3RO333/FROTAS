import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type TerceiroSinistroInput = {
  nome: string;
  telefone: string;
  cpf: string;
};

export type CreateSinistroInput = {
  ticket_number: string;
  tipo_sinistro: "veiculo" | "casa";
  frota_id: number;
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
};

export type SinistroRow = {
  id: number;
  ticket_number: string;
  tipo_sinistro: "veiculo" | "casa";
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
};

export async function createSinistro(input: CreateSinistroInput): Promise<{ id: number }> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .insert({
      ticket_number: input.ticket_number,
      tipo_sinistro: input.tipo_sinistro,
      frota_id: input.frota_id,
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
      status: "PENDENTE",
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number(data.id) };
}

export async function listDriverSinistros(email: string, limit = 50): Promise<SinistroRow[]> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .select("id,ticket_number,tipo_sinistro,frota_id,numero_frota,placa,motorista_id,motorista_nome,data_incidente,endereco,setor,descricao,houve_feridos,samu_bombeiros_presente,terceiros_quantidade,terceiros,media_paths,status,criado_em")
    .eq("motorista_id", email)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[sinistros] listagem do motorista indisponivel", error);
    return [];
  }

  return (data ?? []) as SinistroRow[];
}

export async function listAdminSinistros(limit = 200): Promise<SinistroRow[]> {
  const { data, error } = await supabaseManutencao
    .from("sinistros_frota")
    .select("id,ticket_number,tipo_sinistro,frota_id,numero_frota,placa,motorista_id,motorista_nome,data_incidente,endereco,setor,descricao,houve_feridos,samu_bombeiros_presente,terceiros_quantidade,terceiros,media_paths,status,criado_em")
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[sinistros] listagem admin indisponivel", error);
    return [];
  }

  return (data ?? []) as SinistroRow[];
}

export async function sinistrosDashboardKpis(): Promise<{
  total: number;
  pendentes: number;
  com_feridos: number;
  com_fotos: number;
}> {
  const rows = await listAdminSinistros(500);
  return {
    total: rows.length,
    pendentes: rows.filter((row) => row.status === "PENDENTE").length,
    com_feridos: rows.filter((row) => row.houve_feridos).length,
    com_fotos: rows.filter((row) => (row.media_paths?.length ?? 0) > 0).length,
  };
}
