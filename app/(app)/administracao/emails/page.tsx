import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { canManageEmailSchedules, requireAppUser } from "@/lib/rbac";
import { listEmailSchedules } from "@/lib/repos/email-schedule";
import {
  createScheduleAction,
  toggleScheduleAction,
  deleteScheduleAction,
} from "./_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

const TIPO_LABELS: Record<string, string> = {
  DISPONIBILIDADE: "Disponibilidade",
  PREVENTIVAS_ATRASO: "Preventivas em atraso",
  LAVAGEM_PENDENTE: "Lavagem pendente",
  TACOGRAFO_VENCIDO: "Tacógrafo vencido",
  FROTAS_PARADAS: "Frotas paradas",
  CUSTOS: "Custos",
  ALERTAS: "Alertas operacionais",
  RELATORIO_DIARIO_IA: "Relatório diário IA",
};

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");
  const sp = await searchParams;
  const schedules = await listEmailSchedules();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Programação de E-mails"
        description={`${schedules.length} programação(ões) configurada(s).`}
        icon={FileText}
        severity="INFO"
      />

      {sp.sucesso && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {sp.sucesso}
        </div>
      )}
      {sp.erro && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {sp.erro}
        </div>
      )}

      {/* Form nova programação */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Nova programação</h2>
        <form action={createScheduleAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" placeholder="Ex: Relatório semanal de disponibilidade" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de relatório</Label>
            <select
              id="tipo"
              name="tipo"
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {Object.entries(TIPO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destinatarios">Destinatários (separados por vírgula)</Label>
            <Input
              id="destinatarios"
              name="destinatarios"
              placeholder="email1@bemol.com.br, email2@bemol.com.br"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="frequencia">Frequência</Label>
            <select
              id="frequencia"
              name="frequencia"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="DIARIO">Diário</option>
              <option value="SEMANAL">Semanal</option>
              <option value="QUINZENAL">Quinzenal</option>
              <option value="MENSAL">Mensal</option>
              <option value="PERSONALIZADO">Personalizado</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hora_envio">Horário</Label>
            <Input id="hora_envio" name="hora_envio" type="time" defaultValue="07:00" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cds_incluidos">CDs incluídos (vazio = todos)</Label>
            <Input id="cds_incluidos" name="cds_incluidos" placeholder="CD Manaus, CD Boa Vista" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Criar programação</Button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {schedules.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma programação configurada ainda.</p>
        )}
        {schedules.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.nome}</span>
                <Badge variant="outline">{TIPO_LABELS[s.tipo] ?? s.tipo}</Badge>
                <Badge
                  variant="outline"
                  className={
                    s.ativo
                      ? "border-emerald-200 text-emerald-700"
                      : "border-slate-200 text-slate-500"
                  }
                >
                  {s.ativo ? "Ativo" : "Pausado"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.frequencia} · {s.hora_envio} · {s.destinatarios.length} destinatário(s)
                {s.ultimo_envio
                  ? ` · Último envio: ${new Date(s.ultimo_envio).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={toggleScheduleAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="ativo" value={String(s.ativo)} />
                <Button type="submit" variant="outline" size="sm">
                  {s.ativo ? "Pausar" : "Ativar"}
                </Button>
              </form>
              <form action={deleteScheduleAction}>
                <input type="hidden" name="id" value={s.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Remover
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
