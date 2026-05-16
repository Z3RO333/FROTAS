import { Settings } from "lucide-react";
import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listEquipamentos } from "@/lib/repos/manutencao/equipamentos";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import type { EquipamentoApp, SegmentoEquipamento } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

const SEGMENTO_LABELS: Record<SegmentoEquipamento, string> = {
  EMPILHADEIRA: "Empilhadeira",
  SELECIONADORA: "Selecionadora",
  PALETEIRA: "Paleteira",
};

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const sp = await searchParams;
  const segmento = sp.segmento as SegmentoEquipamento | undefined;
  const equipamentos = await listEquipamentos(segmento);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administração"
        title="Equipamentos"
        description="Empilhadeiras, selecionadoras e paleteiras cadastradas."
        icon={Settings}
        severity="INFO"
      />

      <div className="flex gap-2">
        {(["EMPILHADEIRA", "SELECIONADORA", "PALETEIRA"] as SegmentoEquipamento[]).map((s) => (
          <a key={s} href={`/equipamentos?segmento=${s}`}>
            <Badge variant={segmento === s ? "default" : "outline"} className="cursor-pointer">
              {SEGMENTO_LABELS[s]}
            </Badge>
          </a>
        ))}
        {segmento && (
          <a href="/equipamentos">
            <Badge variant="outline" className="cursor-pointer">Todos</Badge>
          </a>
        )}
      </div>

      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Equipamento</th>
                <th className="px-4 py-3">Segmento</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3 text-right">Horímetro</th>
              </tr>
            </thead>
            <tbody>
              {equipamentos.map((eq: EquipamentoApp) => (
                <tr key={eq.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{eq.numero_equip}</td>
                  <td className="px-4 py-3">{eq.equipamento}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{SEGMENTO_LABELS[eq.segmento]}</Badge>
                  </td>
                  <td className="px-4 py-3">{eq.local ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {eq.horimetro_atual?.toLocaleString("pt-BR") ?? "—"}h
                  </td>
                </tr>
              ))}
              {equipamentos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum equipamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
