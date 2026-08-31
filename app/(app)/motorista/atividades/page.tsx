import { CheckCircle2, ClipboardList, Info } from "lucide-react";
import { ConcluirAtividadeForm } from "@/components/motorista/concluir-atividade-form";
import { PegarAtividadeForm } from "@/components/motorista/pegar-atividade-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMotoristaUser } from "@/lib/rbac";
import {
  listAtividadesAbertas,
  listAtividadesPendentesPorMotorista,
  listAtividadesRecentesPorMotorista,
} from "@/lib/repos/atividades-manutencao";
import {
  formatDuracao,
  requiresFotoNaConclusao,
  requiresChecklistDoDia,
  TIPO_ATIVIDADE_LABELS,
  type AtividadeTipo,
} from "@/lib/atividades/rules";
import { formatDate } from "@/lib/utils";
import { concluirAtividadeAction, pegarAtividadeAction } from "./_actions";

export const dynamic = "force-dynamic";

const TIPO_BADGE_STYLE: Record<AtividadeTipo, string> = {
  LEVAR_PARA: "border-amber-200 bg-amber-50 text-amber-800",
  TESTE_PERCURSO: "border-blue-200 bg-blue-50 text-blue-800",
  LIBERADA: "border-emerald-200 bg-emerald-50 text-emerald-800",
  OUTRO: "border-slate-200 bg-slate-100 text-slate-600",
};

export default async function AtividadesMotoristaPage() {
  const user = await requireMotoristaUser();
  const [pendentes, abertas, recentes] = await Promise.all([
    listAtividadesPendentesPorMotorista(user.email),
    listAtividadesAbertas(),
    listAtividadesRecentesPorMotorista(user.email, 5),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Motorista"
        title="Minhas atividades"
        icon={ClipboardList}
      />

      {abertas.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Disponíveis para pegar</h2>
            <p className="text-sm text-muted-foreground">
              Atividades sem motorista definido. Ao pegar, ela passa a ser sua e sai da lista dos outros.
            </p>
          </div>
          {abertas.map((atividade) => (
            <article
              key={atividade.id}
              className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-4 shadow-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">Frota {atividade.frota_codigo}</h3>
                  <Badge variant="outline" className={TIPO_BADGE_STYLE[atividade.tipo]}>
                    {TIPO_ATIVIDADE_LABELS[atividade.tipo]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{atividade.local}</p>
                {atividade.observacao ? (
                  <p className="mt-1.5 text-sm text-slate-600">{atividade.observacao}</p>
                ) : null}
              </div>
              <PegarAtividadeForm atividadeId={atividade.id} action={pegarAtividadeAction} />
            </article>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pendentes</h2>
        {pendentes.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nenhuma atividade pendente — tudo certo!"
            description="Quando novas atividades forem atribuídas a você, elas aparecerão aqui."
          />
        ) : (
          pendentes.map((atividade) => (
            <article key={atividade.id} className="rounded-md border bg-white p-4 shadow-sm space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">Frota {atividade.frota_codigo}</h3>
                  <Badge
                    variant="outline"
                    className={TIPO_BADGE_STYLE[atividade.tipo]}
                  >
                    {TIPO_ATIVIDADE_LABELS[atividade.tipo]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {atividade.local}
                </p>
                {requiresChecklistDoDia(atividade.tipo) && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Exige checklist do dia + foto de chegada. Faça o checklist antes de sair.
                  </div>
                )}
                {atividade.observacao ? (
                  <p className="mt-1.5 text-sm text-slate-600">{atividade.observacao}</p>
                ) : null}
              </div>
              <ConcluirAtividadeForm
                atividadeId={atividade.id}
                exigeFoto={requiresFotoNaConclusao(atividade.tipo)}
                action={concluirAtividadeAction}
              />
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
