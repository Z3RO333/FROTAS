import bcrypt from "bcryptjs";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { isPerfilUsuario, type PerfilUsuario } from "@/lib/perfis";

export type TipoContaUsuario = "INTERNO" | "TERCEIRO";

export type UsuarioApp = {
  id: string;
  nome: string | null;
  email: string;
  matricula: string | null;
  perfil: PerfilUsuario;
  ativo: boolean;
  tipo_conta: TipoContaUsuario;
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
  tipo_conta: string | null;
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
  tipo_conta?: TipoContaUsuario;
};

const USUARIO_COLUMNS = "id,nome,email,matricula,perfil,ativo,tipo_conta,criado_em,atualizado_em";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeTipoConta(value: string | null): TipoContaUsuario {
  return value === "TERCEIRO" ? "TERCEIRO" : "INTERNO";
}

function mapUsuario(row: UsuarioRow): UsuarioApp {
  return {
    id: row.id,
    nome: row.nome,
    email: normalizeEmail(row.email ?? row.id),
    matricula: row.matricula,
    perfil: isPerfilUsuario(row.perfil) ? row.perfil : "MOTORISTA",
    ativo: row.ativo !== false,
    tipo_conta: normalizeTipoConta(row.tipo_conta),
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

export async function listUsuarios(filters: UsuarioFilters = {}): Promise<UsuarioApp[]> {
  let query = supabaseManutencao
    .from("usuarios")
    .select(USUARIO_COLUMNS)
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
    .select(USUARIO_COLUMNS)
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
      tipo_conta: input.tipo_conta ?? "INTERNO",
    })
    .select(USUARIO_COLUMNS)
    .single();

  if (error) {
    // Corrida entre requisições concorrentes no primeiro acesso: outra já inseriu o mesmo email.
    if (error.code === "23505") {
      const existing = await getUsuarioByEmail(email);
      if (existing) return existing;
    }
    throw new Error(`ensureUsuarioForAccess: ${error.message}`);
  }
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
      tipo_conta: input.tipo_conta ?? "INTERNO",
    })
    .select(USUARIO_COLUMNS)
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
  if (input.tipo_conta !== undefined) patch.tipo_conta = input.tipo_conta;

  const { data, error } = await supabaseManutencao
    .from("usuarios")
    .update(patch)
    .eq("id", id)
    .select(USUARIO_COLUMNS)
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
    .select(USUARIO_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getUsuarioById: ${error.message}`);
  return data ? mapUsuario(data as UsuarioRow) : null;
}

/**
 * Define/redefine a senha de uma conta TERCEIRO. O hash bcrypt fica em uma coluna
 * separada (senha_hash) que nunca é retornada por mapUsuario/UsuarioApp — só é lido
 * dentro de verificarCredenciaisTerceiro, pra validar o login.
 */
export async function setSenhaUsuario(id: string, senha: string): Promise<void> {
  const senha_hash = await bcrypt.hash(senha, 12);
  const { error } = await supabaseManutencao
    .from("usuarios")
    .update({ senha_hash, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`setSenhaUsuario: ${error.message}`);
}

export async function verificarCredenciaisTerceiro(email: string, senha: string): Promise<UsuarioApp | null> {
  const normalized = normalizeEmail(email);
  const { data, error } = await supabaseManutencao
    .from("usuarios")
    .select(`${USUARIO_COLUMNS},senha_hash`)
    .eq("email", normalized)
    .eq("tipo_conta", "TERCEIRO")
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw new Error(`verificarCredenciaisTerceiro: ${error.message}`);
  if (!data) return null;

  const row = data as UsuarioRow & { senha_hash: string | null };
  if (!row.senha_hash) return null;

  const confere = await bcrypt.compare(senha, row.senha_hash);
  if (!confere) return null;

  return mapUsuario(row);
}

export type UsuarioAuditoriaEntry = {
  id: number;
  usuario_id: string;
  acao: string;
  valor_antigo: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  alterado_por: string | null;
  alterado_em: string;
};

function safeParse(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function listUsuarioAuditoria(usuarioId: string, limit = 50): Promise<UsuarioAuditoriaEntry[]> {
  const { data, error } = await supabaseManutencao
    .from("usuarios_auditoria")
    .select("id,usuario_id,acao,valor_antigo,valor_novo,alterado_por,alterado_em")
    .eq("usuario_id", usuarioId)
    .order("alterado_em", { ascending: false })
    .limit(limit);

  // Se a tabela não existe (deploy parcial), retorna vazio em vez de quebrar a UI
  if (error) {
    if (error.message.toLowerCase().includes("usuarios_auditoria")) return [];
    throw new Error(`listUsuarioAuditoria: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    usuario_id: row.usuario_id as string,
    acao: row.acao as string,
    valor_antigo: safeParse((row.valor_antigo as string | null) ?? null),
    valor_novo: safeParse((row.valor_novo as string | null) ?? null),
    alterado_por: (row.alterado_por as string | null) ?? null,
    alterado_em: row.alterado_em as string,
  }));
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
