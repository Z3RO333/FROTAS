import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listServicosRecentes, SERVICO_CONFIG } from "@/lib/repos/manutencao/servicos";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SERVICO_HREF: Record<string, string> = {
  alinhamento: "/planejamento/manutencao/alinhamento",
  balanceamento: "/planejamento/manutencao/balanceamento",
  lavagem: "/planejamento/lavagem",
  "ar-condicionado": "/planejamento/manutencao/ar-condicionado",
  tacografo: "/planejamento/manutencao/tacografo",
  portas_rool_up: "/planejamento/manutencao/porta-roll-up",
  embreagem: "/planejamento/manutencao/embreagem",
  motor: "/planejamento/manutencao/preventiva-motor",
  suspensao: "/planejamento/manutencao/suspensao",
};

export default async function ManutencaoPage() {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const servicos = await listServicosRecentes(100);
  const porTipo = SERVICO_CONFIG.map((cfg) => ({
    ...cfg,
    recentes: servicos.filter((s) => s.tipo_servico === cfg.id).slice(0, 5),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Manutenção"
        title="Radar de Serviços"
        description="Escolha um serviço para enviar a frota à manutenção, registrar a execução e consultar o histórico."
        icon={Wrench}
        severity="MANUTENCAO"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {porTipo.map((cfg) => (
          <Link
            key={cfg.id}
            href={SERVICO_HREF[cfg.id] ?? "/manutencao"}
            className="group rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-950">{cfg.label}</h2>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
            </div>
            {cfg.recentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registros recentes.</p>
            ) : (
              <ul className="space-y-2">
                {cfg.recentes.map((s) => (
                  <li key={s.id_servico} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.veiculo?.codigo_frota ?? s.id_veiculo}</span>
                    <span className="text-muted-foreground">{formatDate(s.data_servico)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs font-medium text-blue-700">Abrir página e enviar frota</p>
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3 font-semibold">Últimos 100 serviços</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Frota</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3 text-right">KM</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((s) => (
                <tr key={s.id_servico} className="border-t">
                  <td className="px-4 py-3">{formatDate(s.data_servico)}</td>
                  <td className="px-4 py-3 font-medium">{s.veiculo?.codigo_frota ?? s.id_veiculo}</td>
                  <td className="px-4 py-3">{s.veiculo?.placa ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{s.tipo_servico}</Badge></td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.quilometragem?.toLocaleString("pt-BR") ?? "—"}</td>
                </tr>
              ))}
              {servicos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum serviço encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
