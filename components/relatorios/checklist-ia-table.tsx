import type { AnaliseIaRow } from "@/lib/repos/analises-ia";
import Link from "next/link";

const BADGE: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-800",
  ATENCAO: "bg-amber-100 text-amber-800",
  CRITICO: "bg-red-100 text-red-800",
  MANUTENCAO: "bg-orange-100 text-orange-800",
  BLOQUEIO_SUGERIDO: "bg-red-200 text-red-900 font-bold",
};

export function ChecklistIaTable({ analises }: { analises: AnaliseIaRow[] }) {
  if (analises.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma análise encontrada.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <table className="w-full text-sm">
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
              <td className="p-3">
                <Link href={`/checklists/${analise.checklist_id}`} className="text-blue-600 hover:underline">
                  #{analise.checklist_id}
                </Link>
              </td>
              <td className="p-3">{analise.frota_id}</td>
              <td className="p-3 text-xs">{analise.motorista_id.split("@")[0]}</td>
              <td className="p-3">
                <span className={`rounded px-2 py-0.5 text-xs ${BADGE[analise.criticidade_revisada ?? analise.criticidade] ?? "bg-slate-100 text-slate-700"}`}>
                  {(analise.criticidade_revisada ?? analise.criticidade).replace("_", " ")}
                </span>
              </td>
              <td className="max-w-xs p-3 text-xs text-muted-foreground truncate">{analise.resumo_ia}</td>
              <td className="p-3 text-xs">{analise.acao_recomendada ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
