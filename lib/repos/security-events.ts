import { supabaseManutencao } from "@/lib/supabase-manutencao";

export type SecurityEventTipo = "LOGIN_SUCESSO" | "LOGIN_FALHA" | "LOGIN_BLOQUEADO_DOMINIO";

export type SecurityEventInput = {
  tipo_evento: SecurityEventTipo;
  email?: string | null;
  provider?: string | null;
  motivo?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

// Nunca lança — logging de segurança não pode derrubar o fluxo de login.
export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const { error } = await supabaseManutencao.from("security_events").insert({
      tipo_evento: input.tipo_evento,
      email: input.email?.toLowerCase() ?? null,
      provider: input.provider ?? null,
      motivo: input.motivo ?? null,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
    });
    if (error) console.warn("[security-events] falha ao registrar evento", error.message);
  } catch (error) {
    console.warn("[security-events] falha ao registrar evento", error);
  }
}

export type SecurityEventRow = {
  id: number;
  tipo_evento: SecurityEventTipo;
  email: string | null;
  provider: string | null;
  motivo: string | null;
  ip_address: string | null;
  user_agent: string | null;
  criado_em: string;
};

export type SecurityEventFilters = {
  tipo_evento?: SecurityEventTipo;
  email?: string;
  ip_address?: string;
};

export async function listSecurityEvents(
  filters: SecurityEventFilters = {},
  limit = 200
): Promise<SecurityEventRow[]> {
  let query = supabaseManutencao
    .from("security_events")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (filters.tipo_evento) query = query.eq("tipo_evento", filters.tipo_evento);
  if (filters.email) query = query.ilike("email", `%${filters.email}%`);
  if (filters.ip_address) query = query.ilike("ip_address", `%${filters.ip_address}%`);

  const { data, error } = await query;
  if (error) throw new Error(`listSecurityEvents: ${error.message}`);
  return (data ?? []) as SecurityEventRow[];
}

export type SecurityAlert = {
  chave: string;
  tipo: "EMAIL" | "IP";
  falhas: number;
  ultimaTentativa: string;
};

const JANELA_ALERTA_HORAS = 1;
const LIMIAR_FALHAS = 5;

// Agrega falhas de login recentes por e-mail e por IP — sem bloqueio automático,
// só sinaliza pra quem for analisar a página. Roda em memória sobre os eventos
// já carregados (volume baixo: só eventos de login, não todo o tráfego).
export async function listSecurityAlerts(): Promise<SecurityAlert[]> {
  const desde = new Date(Date.now() - JANELA_ALERTA_HORAS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseManutencao
    .from("security_events")
    .select("email,ip_address,criado_em")
    .eq("tipo_evento", "LOGIN_FALHA")
    .gte("criado_em", desde);
  if (error) throw new Error(`listSecurityAlerts: ${error.message}`);

  const rows = (data ?? []) as Array<{ email: string | null; ip_address: string | null; criado_em: string }>;

  function agrupar(tipo: "EMAIL" | "IP", campo: "email" | "ip_address"): SecurityAlert[] {
    const grupos = new Map<string, { falhas: number; ultimaTentativa: string }>();
    for (const row of rows) {
      const chave = row[campo];
      if (!chave) continue;
      const atual = grupos.get(chave);
      if (!atual) {
        grupos.set(chave, { falhas: 1, ultimaTentativa: row.criado_em });
      } else {
        atual.falhas += 1;
        if (row.criado_em > atual.ultimaTentativa) atual.ultimaTentativa = row.criado_em;
      }
    }
    return Array.from(grupos.entries())
      .filter(([, valor]) => valor.falhas >= LIMIAR_FALHAS)
      .map(([chave, valor]) => ({ chave, tipo, falhas: valor.falhas, ultimaTentativa: valor.ultimaTentativa }));
  }

  return [...agrupar("EMAIL", "email"), ...agrupar("IP", "ip_address")].sort((a, b) => b.falhas - a.falhas);
}

export type SecurityEventKpis = {
  logins_hoje: number;
  falhas_hoje: number;
  bloqueios_dominio_hoje: number;
};

export async function securityEventKpisHoje(): Promise<SecurityEventKpis> {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const desde = inicioHoje.toISOString();

  const [logins, falhas, bloqueios] = await Promise.all([
    supabaseManutencao
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("tipo_evento", "LOGIN_SUCESSO")
      .gte("criado_em", desde),
    supabaseManutencao
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("tipo_evento", "LOGIN_FALHA")
      .gte("criado_em", desde),
    supabaseManutencao
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("tipo_evento", "LOGIN_BLOQUEADO_DOMINIO")
      .gte("criado_em", desde),
  ]);

  if (logins.error) throw new Error(`securityEventKpisHoje: ${logins.error.message}`);
  if (falhas.error) throw new Error(`securityEventKpisHoje: ${falhas.error.message}`);
  if (bloqueios.error) throw new Error(`securityEventKpisHoje: ${bloqueios.error.message}`);

  return {
    logins_hoje: logins.count ?? 0,
    falhas_hoje: falhas.count ?? 0,
    bloqueios_dominio_hoje: bloqueios.count ?? 0,
  };
}
