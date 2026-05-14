import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { isPerfilUsuario, type PerfilUsuario } from "@/lib/perfis";

export type UsuarioApp = {
  id: string;
  nome: string | null;
  email: string;
  matricula: string | null;
  perfil: PerfilUsuario;
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
};

type UsuarioRow = {
  id: string;
  nome: string | null;
  email: string | null;
  matricula: string | null;
  perfil: string | null;
  ativo: boolean | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

export type UsuarioFilters = {
  search?: string;
  perfil?: PerfilUsuario;
  ativo?: "ativos" | "inativos" | "todos";
};

export type UsuarioInput = {
  nome?: string | null;
  email: string;
  matricula?: string | null;
  perfil: PerfilUsuario;
  ativo?: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapUsuario(row: UsuarioRow): UsuarioApp {
  return {
    id: row.id,
    nome: row.nome,
    email: normalizeEmail(row.email ?? row.id),
    matricula: row.matricula,
    perfil: isPerfilUsuario(row.perfil) ? row.perfil : "MOTORISTA",
    ativo: row.ativo !== false,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

export async function listUsuarios(filters: UsuarioFilters = {}): Promise<UsuarioApp[]> {
  let query = supabaseManutencao
    .from("usuarios")
    .select("id,nome,email,matricula,perfil,ativo,criado_em,atualizado_em")
    .order("nome", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true });

  if (filters.perfil) query = query.eq("perfil", filters.perfil);
  if (filters.ativo === "ativos") query = query.eq("ativo", true);
  if (filters.ativo === "inativos") query = query.eq("ativo", false);

  const { data, error } = await query;
  if (error) throw new Error(`listUsuarios: ${error.message}`);

  const search = filters.search?.trim().toLowerCase();
  const rows = ((data ?? []) as UsuarioRow[]).map(mapUsuario);
  if (!search) return rows;

  return rows.filter((usuario) =>
    [usuario.nome, usuario.email, usuario.matricula, usuario.perfil]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search)
  );
}

export async function getUsuarioByEmail(email: string): Promise<UsuarioApp | null> {
  const normalized = normalizeEmail(email);
  const { data, error } = await supabaseManutencao
    .from("usuarios")
    .select("id,nome,email,matricula,perfil,ativo,criado_em,atualizado_em")
    .eq("email", normalized)
    .maybeSingle();

  if (error) throw new Error(`getUsuarioByEmail: ${error.message}`);
  return data ? mapUsuario(data as UsuarioRow) : null;
}

export async function ensureUsuarioForAccess(input: UsuarioInput): Promise<UsuarioApp> {
  const email = normalizeEmail(input.email);
  const current = await getUsuarioByEmail(email);

  if (current) {
    if (!current.nome && input.nome) {
      await updateUsuario(current.id, { nome: input.nome });
      return { ...current, nome: input.nome };
    }
    return current;
  }

  const { data, error } = await supabaseManutencao
    .from("usuarios")
    .insert({
      id: email,
      email,
      nome: input.nome?.trim() || null,
      matricula: input.matricula?.trim() || null,
      perfil: input.perfil,
      ativo: input.ativo ?? true,
    })
    .select("id,nome,email,matricula,perfil,ativo,criado_em,atualizado_em")
    .single();

  if (error) throw new Error(`ensureUsuarioForAccess: ${error.message}`);
  return mapUsuario(data as UsuarioRow);
}

export async function createUsuario(input: UsuarioInput, actorEmail: string): Promise<UsuarioApp> {
  const email = normalizeEmail(input.email);
  const { data, error } = await supabaseManutencao
    .from("usuarios")
    .insert({
      id: email,
      email,
      nome: input.nome?.trim() || null,
      matricula: input.matricula?.trim() || null,
      perfil: input.perfil,
      ativo: input.ativo ?? true,
    })
    .select("id,nome,email,matricula,perfil,ativo,criado_em,atualizado_em")
    .single();

  if (error) throw new Error(`createUsuario: ${error.message}`);
  const usuario = mapUsuario(data as UsuarioRow);
  await logUsuarioAudit(usuario.id, "criado", null, JSON.stringify(usuario), actorEmail);
  return usuario;
}

export async function updateUsuario(
  id: string,
  input: Partial<Omit<UsuarioInput, "email"> & { email: string }>,
  actorEmail?: string
): Promise<UsuarioApp> {
  const current = actorEmail ? await getUsuarioById(id) : null;
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (input.nome !== undefined) patch.nome = input.nome?.trim() || null;
  if (input.email !== undefined) patch.email = normalizeEmail(input.email);
  if (input.matricula !== undefined) patch.matricula = input.matricula?.trim() || null;
  if (input.perfil !== undefined) patch.perfil = input.perfil;
  if (input.ativo !== undefined) patch.ativo = input.ativo;

  const { data, error } = await supabaseManutencao
    .from("usuarios")
    .update(patch)
    .eq("id", id)
    .select("id,nome,email,matricula,perfil,ativo,criado_em,atualizado_em")
    .single();

  if (error) throw new Error(`updateUsuario: ${error.message}`);
  const usuario = mapUsuario(data as UsuarioRow);
  if (actorEmail) {
    await logUsuarioAudit(id, "atualizado", current ? JSON.stringify(current) : null, JSON.stringify(usuario), actorEmail);
  }
  return usuario;
}

export async function getUsuarioById(id: string): Promise<UsuarioApp | null> {
  const { data, error } = await supabaseManutencao
    .from("usuarios")
    .select("id,nome,email,matricula,perfil,ativo,criado_em,atualizado_em")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getUsuarioById: ${error.message}`);
  return data ? mapUsuario(data as UsuarioRow) : null;
}

async function logUsuarioAudit(
  usuarioId: string,
  acao: string,
  valorAntigo: string | null,
  valorNovo: string | null,
  actorEmail: string
): Promise<void> {
  const { error } = await supabaseManutencao.from("usuarios_auditoria").insert({
    usuario_id: usuarioId,
    acao,
    valor_antigo: valorAntigo,
    valor_novo: valorNovo,
    alterado_por: normalizeEmail(actorEmail),
  });

  if (error && !error.message.toLowerCase().includes("usuarios_auditoria")) {
    throw new Error(`logUsuarioAudit: ${error.message}`);
  }
}
