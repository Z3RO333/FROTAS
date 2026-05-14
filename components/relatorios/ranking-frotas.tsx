import type { FrotaProblema } from "@/lib/repos/relatorios";
import Link from "next/link";

const COR: Record<string, string> = {
  CRITICO: "text-red-600",
  BLOQUEIO_SUGERIDO: "text-red-700 font-bold",
  MANUTENCAO: "text-orange-600",
  ATENCAO: "text-amber-600",
};

export function RankingFrotas({ frotas }: { frotas: FrotaProblema[] }) {
  if (frotas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma frota com problemas detectados hoje.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Frotas com mais problemas (hoje)</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="p-3 text-left">#</th>
            <th className="p-3 text-left">Frota</th>
            <th className="p-3 text-left">Placa</th>
            <th className="p-3 text-right">Problemas</th>
            <th className="p-3 text-left">Criticidade</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {frotas.map((frota, i) => (
            <tr key={frota.frota_id} className="hover:bg-slate-50">
              <td className="p-3 text-muted-foreground">{i + 1}</td>
              <td className="p-3 font-medium">
                <Link href={`/frotas/${frota.frota_id}`} className="hover:text-blue-600">
                  {frota.frota_geral ?? `#${frota.frota_id}`}
                </Link>
              </td>
              <td className="p-3">{frota.placa ?? "—"}</td>
              <td className="p-3 text-right font-semibold">{frota.total_problemas}</td>
              <td className={`p-3 text-xs font-semibold ${COR[frota.ultima_criticidade] ?? "text-slate-600"}`}>
                {frota.ultima_criticidade.replace("_", " ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
