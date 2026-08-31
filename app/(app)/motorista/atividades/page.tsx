import { ClipboardList } from "lucide-react";
import { ConcluirAtividadeForm } from "@/components/motorista/concluir-atividade-form";
import { Badge } from "@/components/ui/badge";
import { requireMotoristaUser } from "@/lib/rbac";
import { listAtividadesPendentesPorMotorista, listAtividadesRecentesPorMotorista } from "@/lib/repos/atividades-manutencao";
import { formatDuracao, requiresFotoNaConclusao, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";
import { formatDate } from "@/lib/utils";
import { concluirAtividadeAction } from "./_actions";

export const dynamic = "force-dynamic";

export default async function AtividadesMotoristaPage() {
  const user = await requireMotoristaUser();
  const [pendentes, recentes] = await Promise.all([
    listAtividadesPendentesPorMotorista(user.email),
    listAtividadesRecentesPorMotorista(user.email, 10),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Motorista</p>
        <h1 className="text-3xl font-semibold tracking-tight">Minhas atividades</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pendentes</h2>
        {pendentes.length === 0 ? (
          <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
            Nenhuma atividade pendente no momento.
          </div>
        ) : (
          pendentes.map((atividade) => (
            <article key={atividade.id} className="rounded-md border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Frota {atividade.frota_codigo}</h3>
                  <p className="text-sm text-muted-foreground">
                    {TIPO_ATIVIDADE_LABELS[atividade.tipo]} {atividade.local}
                  </p>
                  {atividade.observacao ? (
                    <p className="mt-1 text-xs text-slate-500">{atividade.observacao}</p>
                  ) : null}
                </div>
                <ConcluirAtividadeForm
                  atividadeId={atividade.id}
                  exigeFoto={requiresFotoNaConclusao(atividade.tipo)}
                  action={concluirAtividadeAction}
                />
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Concluídas recentemente</h2>
        {recentes.length === 0 ? (
          <div className="rounded-md border bg-white p-4 text-sm text-muted-foreground">
            Nenhuma atividade concluída ainda.
          </div>
        ) : (
          recentes.map((atividade) => (
            <div key={atividade.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white p-3 shadow-sm">
              <div>
                <span className="font-medium">Frota {atividade.frota_codigo}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {TIPO_ATIVIDADE_LABELS[atividade.tipo]} {atividade.local} · {formatDate(atividade.concluido_em)}
                  {atividade.concluido_por_id && atividade.concluido_por_id !== user.email
                    ? ` · concluída por ${atividade.concluido_por_nome}`
                    : ""}
                </span>
              </div>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                {atividade.tipo === "LEVAR_PARA" && atividade.concluido_em
                  ? formatDuracao(atividade.criado_em, atividade.concluido_em)
                  : "Concluída"}
              </Badge>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
