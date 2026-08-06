import { FileText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageEmailSchedules, requireAppUser } from "@/lib/rbac";
import { getEmailSchedule, listEmailSchedules } from "@/lib/repos/email-schedule";
import {
  createScheduleAction,
  updateScheduleAction,
  toggleScheduleAction,
  deleteScheduleAction,
  triggerScheduleNowAction,
} from "./_actions";
import { ScheduleForm } from "./ScheduleForm";
import { Button, buttonVariants } from "@/components/ui/button";
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
  RELATORIO_OPERACIONAL_DIARIO: "Relatório operacional diário",
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

  const editingId = sp.editar ? Number(sp.editar) : null;
  const editingSchedule = editingId ? await getEmailSchedule(editingId) : null;

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

      <ScheduleForm
        key={editingSchedule?.id ?? "novo"}
        schedule={editingSchedule ?? undefined}
        action={editingSchedule ? updateScheduleAction : createScheduleAction}
      />

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
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/administracao/emails?editar=${s.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Editar
              </Link>
              <form action={triggerScheduleNowAction}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="outline" size="sm">
                  Disparar agora
                </Button>
              </form>
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
