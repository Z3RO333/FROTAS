import { ClipboardCheck } from "lucide-react";
import { AtividadeForm } from "@/components/manutencao/atividade-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { listAtividades } from "@/lib/repos/atividades-manutencao";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { listUsuarios } from "@/lib/repos/usuarios";
import { requireManutencaoUser } from "@/lib/rbac";
import { formatDuracao, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";
import { criarAtividadeAction } from "./_actions";

export const dynamic = "force-dynamic";

export default async function AtividadesManutencaoPage() {
  await requireManutencaoUser();
  const [frotas, motoristas, atividades] = await Promise.all([
    listFrotasForOperationalForms(),
    listUsuarios({ perfil: "MOTORISTA_INTERNO", ativo: "ativos" }),
    listAtividades(),
  ]);

  const vehicles = frotas.map((frota) => ({
    id: frota.id,
    codigo: frota.frota_geral,
    placa: frota.placa,
    modelo: frota.modelo,
    localizacao: frota.localizacao,
    ativo: frota.ativo,
    vendido: frota.vendido,
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Manutenção"
        title="Atividades"
        description={`${atividades.filter((a) => a.status === "PENDENTE").length} pendente(s) de ${atividades.length} atividade(s).`}
        icon={ClipboardCheck}
        severity="INFO"
      />

      <section className="rounded-md border bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader title="Nova atividade" />
        <div className="mt-4">
          <AtividadeForm
            vehicles={vehicles}
            motoristas={motoristas.map((m) => ({ id: m.id, nome: m.nome ?? m.email }))}
            action={criarAtividadeAction}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Todas as atividades" />
        {atividades.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma atividade registrada"
            description="Crie a primeira atividade acima."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white shadow-sm">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Frota</th>
                  <th className="px-3 py-3">Atividade</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Motorista</th>
                  <th className="px-3 py-3">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {atividades.map((atividade) => (
                  <tr key={atividade.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{atividade.frota_codigo}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {TIPO_ATIVIDADE_LABELS[atividade.tipo]} {atividade.local}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={atividade.status === "CONCLUIDA" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
                        {atividade.status === "CONCLUIDA" ? "Concluída" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{atividade.motorista_nome}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {atividade.tipo === "LEVAR_PARA" && atividade.concluido_em
                        ? formatDuracao(atividade.criado_em, atividade.concluido_em)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
