import Link from "next/link";
import { AlertTriangle, KeyRound, LogIn, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSecurityLogsUser } from "@/lib/rbac";
import {
  listSecurityAlerts,
  listSecurityEvents,
  securityEventKpisHoje,
  type SecurityEventTipo,
} from "@/lib/repos/security-events";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIPO_LABELS: Record<SecurityEventTipo, string> = {
  LOGIN_SUCESSO: "Login",
  LOGIN_FALHA: "Falha de senha",
  LOGIN_BLOQUEADO_DOMINIO: "Bloqueado (domínio)",
};

const TIPO_COLORS: Record<SecurityEventTipo, string> = {
  LOGIN_SUCESSO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  LOGIN_FALHA: "border-amber-200 bg-amber-50 text-amber-800",
  LOGIN_BLOQUEADO_DOMINIO: "border-red-200 bg-red-50 text-red-800",
};

function isTipoEvento(value: string | undefined): value is SecurityEventTipo {
  return value === "LOGIN_SUCESSO" || value === "LOGIN_FALHA" || value === "LOGIN_BLOQUEADO_DOMINIO";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Manaus" });
}

export default async function SegurancaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; email?: string; ip?: string }>;
}) {
  await requireSecurityLogsUser();
  const { tipo, email, ip } = await searchParams;
  const filtroTipo = isTipoEvento(tipo) ? tipo : undefined;

  const [kpis, alertas, eventos] = await Promise.all([
    securityEventKpisHoje(),
    listSecurityAlerts(),
    listSecurityEvents({ tipo_evento: filtroTipo, email, ip_address: ip }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Segurança e acessos"
        description="Login, falhas de senha e tentativas bloqueadas. Página não listada em nenhum menu — o acesso é controlado por perfil, não por obscuridade."
        icon={ShieldAlert}
        severity="CRITICO"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi title="Logins hoje" value={kpis.logins_hoje} icon={<LogIn className="h-4 w-4" />} />
        <Kpi title="Falhas de senha hoje" value={kpis.falhas_hoje} icon={<KeyRound className="h-4 w-4" />} accent="amber" />
        <Kpi title="Bloqueados por domínio hoje" value={kpis.bloqueios_dominio_hoje} icon={<ShieldAlert className="h-4 w-4" />} accent="red" />
      </div>

      {alertas.length > 0 ? (
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-red-800">
              <AlertTriangle className="h-4 w-4" />
              Possível abuso — {alertas.length} conta(s)/IP(s) com 5+ falhas de senha na última hora
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alertas.map((alerta) => (
              <Badge
                key={`${alerta.tipo}-${alerta.chave}`}
                variant="outline"
                className="border-red-300 bg-white px-3 py-1.5 text-red-800"
              >
                {alerta.tipo === "EMAIL" ? "E-mail" : "IP"}: <strong className="ml-1">{alerta.chave}</strong>
                <span className="ml-2 text-red-600">{alerta.falhas} falhas</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <ShieldCheck className="h-4 w-4" />
          Nenhum padrão suspeito de falhas de login na última hora.
        </div>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <SectionHeader title="Eventos de login" description={`${eventos.length} registro(s) mostrado(s), mais recentes primeiro.`} />
          <div className="flex flex-wrap gap-2">
            {[
              { value: undefined, label: "Todos" },
              { value: "LOGIN_SUCESSO", label: "Login" },
              { value: "LOGIN_FALHA", label: "Falha de senha" },
              { value: "LOGIN_BLOQUEADO_DOMINIO", label: "Bloqueado (domínio)" },
            ].map((opt) => {
              const active = (filtroTipo ?? undefined) === opt.value;
              const params = new URLSearchParams();
              if (opt.value) params.set("tipo", opt.value);
              if (email) params.set("email", email);
              if (ip) params.set("ip", ip);
              const qs = params.toString();
              return (
                <Link
                  key={opt.label}
                  href={qs ? `/administracao/seguranca?${qs}` : "/administracao/seguranca"}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
          <form action="/administracao/seguranca" className="flex flex-wrap gap-2">
            {filtroTipo ? <input type="hidden" name="tipo" value={filtroTipo} /> : null}
            <Input name="email" defaultValue={email ?? ""} placeholder="Filtrar por e-mail..." className="w-56" />
            <Input name="ip" defaultValue={ip ?? ""} placeholder="Filtrar por IP..." className="w-40" />
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.length > 0 ? (
                eventos.map((evento) => (
                  <TableRow key={evento.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                      {formatDateTime(evento.criado_em)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TIPO_COLORS[evento.tipo_evento]}>
                        {TIPO_LABELS[evento.tipo_evento]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{evento.email ?? "-"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{evento.provider ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{evento.ip_address ?? "-"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{evento.motivo ?? "-"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-500">
                    Nenhum evento encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent?: "amber" | "red";
}) {
  const color = accent === "red" ? "text-red-700" : accent === "amber" ? "text-amber-600" : "text-blue-700";
  return (
    <Card className="rounded-md">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={color}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
}
