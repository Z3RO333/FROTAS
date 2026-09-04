import Link from "next/link";
import { CalendarRange, Clock3, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

type Props = {
  data: { ano: number | null; total: number }[];
};

export function FrotasPorAnoChart({ data }: Props) {
  const currentYear = new Date().getFullYear();
  const items = data.map((item) => ({
    ano: item.ano,
    label: item.ano != null ? String(item.ano) : "Sem ano",
    total: item.total,
    idade: item.ano != null ? Math.max(0, currentYear - item.ano) : null,
  }));
  const totalFrotas = items.reduce((sum, item) => sum + item.total, 0);
  const totalAntigas = items
    .filter((item) => item.idade != null && item.idade >= 7)
    .reduce((sum, item) => sum + item.total, 0);
  const semAno = items.find((item) => item.ano == null)?.total ?? 0;
  const maxValue = Math.max(...items.map((item) => item.total), 1);
  const idadeMedia = totalFrotas > 0
    ? items.reduce((sum, item) => sum + (item.idade ?? 0) * item.total, 0) /
      Math.max(1, items.filter((item) => item.idade != null).reduce((sum, item) => sum + item.total, 0))
    : 0;

  return (
    <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base text-slate-950">Idade da frota</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Distribuição por ano de fabricação; clique em uma barra para abrir as frotas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Summary label="Total" value={formatNumber(totalFrotas)} icon={Truck} />
            <Summary label="Idade média" value={`${idadeMedia.toFixed(1)} anos`} icon={Clock3} />
            <Summary label="7 anos ou mais" value={formatNumber(totalAntigas)} icon={CalendarRange} tone="amber" />
            {semAno > 0 ? <Summary label="Sem ano" value={formatNumber(semAno)} icon={CalendarRange} tone="slate" /> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Nenhuma frota cadastrada.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex h-60 min-w-[760px] items-end gap-2 border-b border-slate-200 px-1 pt-5">
              {items.map((item) => {
                const height = Math.max(7, (item.total / maxValue) * 100);
                const tone = toneFor(item.idade);
                const href = item.ano != null ? `/frotas?ano=${item.ano}` : "/frotas?cadastro=incompleto";
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className="group flex h-full min-w-12 flex-1 flex-col justify-end rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    title={`${item.label}: ${item.total} ${item.total === 1 ? "frota" : "frotas"}`}
                  >
                    <div className="mb-2 text-center">
                      <p className="text-xs font-semibold tabular-nums text-slate-800">{formatNumber(item.total)}</p>
                      <p className="text-[9px] text-slate-400">{item.total === 1 ? "frota" : "frotas"}</p>
                    </div>
                    <div className="flex h-36 items-end px-1.5">
                      <div
                        className={cn("w-full rounded-t-md opacity-90 transition-all group-hover:opacity-100 group-hover:shadow-lg", tone.bar)}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className="border-t border-slate-200 py-2 text-center">
                      <p className={cn("text-[11px] font-semibold", tone.text)}>{item.label}</p>
                      <p className="mt-0.5 text-[9px] text-slate-400">
                        {item.idade == null ? "não informado" : `${item.idade} ${item.idade === 1 ? "ano" : "anos"}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function toneFor(idade: number | null): { bar: string; text: string } {
  if (idade == null) return { bar: "bg-slate-400", text: "text-slate-600" };
  if (idade >= 10) return { bar: "bg-red-400 group-hover:bg-red-500", text: "text-red-700" };
  if (idade >= 7) return { bar: "bg-orange-400 group-hover:bg-orange-500", text: "text-orange-700" };
  return { bar: "bg-blue-400 group-hover:bg-blue-500", text: "text-blue-700" };
}

function Summary({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  icon: typeof Truck;
  tone?: "blue" | "amber" | "slate";
}) {
  const colors = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-white text-slate-600",
  };
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5", colors[tone])}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        <span className="block text-[9px] font-medium uppercase tracking-wide opacity-70">{label}</span>
        <span className="block text-xs font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  );
}
