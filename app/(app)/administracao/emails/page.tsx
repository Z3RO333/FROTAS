import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { canManageEmailSchedules, requireAppUser } from "@/lib/rbac";
import { listEmailSchedules } from "@/lib/repos/email-schedule";
import { setoresDistintos } from "@/lib/repos/frotas";
import { getFrotasPorCd } from "@/lib/repos/disponibilidade";
import { listNotificacaoDestinatarios } from "@/lib/repos/notificacao-destinatarios";
import { createScheduleAction } from "./_actions";
import { ScheduleForm } from "./ScheduleForm";
import { ScheduleRow } from "./ScheduleRow";
import { NotificacaoDestinatariosSection } from "./NotificacaoDestinatariosSection";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canManageEmailSchedules(user.perfil)) redirect("/");
  const sp = await searchParams;
  const [schedules, setoresDisponiveis, notificacaoDestinatarios, frotasPorCd] = await Promise.all([
    listEmailSchedules(),
    setoresDistintos(),
    listNotificacaoDestinatarios(),
    getFrotasPorCd(),
  ]);

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

      <NotificacaoDestinatariosSection destinatarios={notificacaoDestinatarios} />

      <ScheduleForm action={createScheduleAction} setoresDisponiveis={setoresDisponiveis} frotasPorCd={frotasPorCd} />

      {/* Lista */}
      <div className="space-y-3">
        {schedules.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma programação configurada ainda.</p>
        )}
        {schedules.map((s) => (
          <ScheduleRow key={s.id} schedule={s} setoresDisponiveis={setoresDisponiveis} frotasPorCd={frotasPorCd} />
        ))}
      </div>
    </div>
  );
}
