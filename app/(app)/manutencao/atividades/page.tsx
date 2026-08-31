import { Camera, ClipboardCheck } from "lucide-react";
import { AtividadeForm } from "@/components/manutencao/atividade-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { createSignedAtividadeImageUrl } from "@/lib/repos/atividades-media";
import { listAtividades, type AtividadeFilters } from "@/lib/repos/atividades-manutencao";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { listUsuarios } from "@/lib/repos/usuarios";
import { requireManutencaoUser } from "@/lib/rbac";
import { formatDuracao, TIPO_ATIVIDADE_LABELS } from "@/lib/atividades/rules";
import { criarAtividadeAction } from "./_actions";

export const dynamic = "force-dynamic";

const LIMIT = 200;

function parseStatus(value: string | undefined): "PENDENTE" | "CONCLUIDA" | undefined {
  return value === "PENDENTE" || value === "CONCLUIDA" ? value : undefined;
}

export default async function AtividadesManutencaoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; motoristaId?: string }>;
}) {
  await requireManutencaoUser();
  const query = await searchParams;
  const status = parseStatus(query.status);
  const motoristaId = query.motoristaId && query.motoristaId.length > 0 ? query.motoristaId : undefined;

  const filters: AtividadeFilters = { status, motoristaId, limit: LIMIT };

  const [frotas, motoristas, atividades] = await Promise.all([
    listFrotasForOperationalForms(),
    listUsuarios({ perfil: "MOTORISTA_INTERNO", ativo: "ativos" }),
    listAtividades(filters),
  ]);

  const fotoUrls = new Map<number, string>();
  await Promise.all(
    atividades
      .filter((atividade) => atividade.status === "CONCLUIDA" && atividade.foto_conclusao_path)
      .map(async (atividade) => {
        try {
          const url = await createSignedAtividadeImageUrl(atividade.foto_conclusao_path as string);
          fotoUrls.set(atividade.id, url);
        } catch {
          // Se a URL assinada falhar, simplesmente não mostramos o link de foto.
        }
      })
  );

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

        <form method="GET" className="flex flex-wrap items-end gap-3 rounded-md border bg-white p-3 shadow-sm">
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CONCLUIDA">Concluída</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="motoristaId" className="text-xs font-medium text-slate-600">
              Motorista
            </label>
            <select
              id="motoristaId"
              name="motoristaId"
              defaultValue={motoristaId ?? ""}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              <option value="">Todos</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome ?? m.email}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Filtrar
          </button>
        </form>

        {atividades.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma atividade registrada"
            description="Crie a primeira atividade acima."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border bg-white shadow-sm">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Frota</th>
                  <th className="px-3 py-3">Atividade</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Motorista</th>
                  <th className="px-3 py-3">Tempo</th>
                  <th className="px-3 py-3">Foto</th>
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
                    <td className="px-3 py-3 text-slate-600">
                      {atividade.motorista_nomes.join(", ")}
                      {atividade.status === "CONCLUIDA" && atividade.concluido_por_nome ? (
                        <div className="text-xs text-emerald-700">concluída por {atividade.concluido_por_nome}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {atividade.tipo === "LEVAR_PARA" && atividade.concluido_em
                        ? formatDuracao(atividade.criado_em, atividade.concluido_em)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {fotoUrls.has(atividade.id) ? (
                        <a
                          href={fotoUrls.get(atividade.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                        >
                          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                          Ver foto
                        </a>
                      ) : (
                        "—"
                      )}
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
