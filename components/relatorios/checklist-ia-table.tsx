import type { AnaliseIaRow } from "@/lib/repos/analises-ia";
import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const BADGE: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-800",
  ATENCAO: "bg-amber-100 text-amber-800",
  CRITICO: "bg-red-100 text-red-800",
  MANUTENCAO: "bg-orange-100 text-orange-800",
  BLOQUEIO_SUGERIDO: "bg-red-200 text-red-900 font-bold",
};

export function ChecklistIaTable({ analises }: { analises: AnaliseIaRow[] }) {
  if (analises.length === 0) {
    return <EmptyState icon={Bot} title="Nenhuma análise encontrada" description="As análises concluídas hoje aparecerão aqui." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Checklist</th>
            <th className="p-3 text-left">Frota</th>
            <th className="p-3 text-left">Motorista</th>
            <th className="p-3 text-left">Criticidade</th>
            <th className="p-3 text-left">Resumo IA</th>
            <th className="p-3 text-left">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {analises.map((analise) => (
            <tr key={analise.id} className="hover:bg-slate-50">
              <td className="p-3 font-medium text-slate-700">#{analise.checklist_id}</td>
              <td className="p-3">{analise.frota_id}</td>
              <td className="p-3 text-xs">{analise.motorista_id.split("@")[0]}</td>
              <td className="p-3">
                <span className={`rounded px-2 py-0.5 text-xs ${BADGE[analise.criticidade_revisada ?? analise.criticidade] ?? "bg-slate-100 text-slate-700"}`}>
                  {(analise.criticidade_revisada ?? analise.criticidade).replace("_", " ")}
                </span>
              </td>
              <td className="max-w-xs p-3 text-xs text-muted-foreground"><p className="line-clamp-2">{analise.resumo_ia}</p></td>
              <td className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="line-clamp-2 text-xs">{analise.acao_recomendada ?? "—"}</span>
                  <Button asChild variant="ghost" size="sm" className="shrink-0 text-blue-700 hover:text-blue-800">
                    <Link href={`/checklists/${analise.checklist_id}`} aria-label={`Abrir checklist ${analise.checklist_id}`}>
                      Abrir
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
