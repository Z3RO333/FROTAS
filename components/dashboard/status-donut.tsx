"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  disponivel: "hsl(158 64% 40%)",
  manutencao: "hsl(262 83% 58%)",
  indisponivel: "hsl(0 84% 60%)",
  baixado: "hsl(215 16% 47%)",
  normal: "hsl(158 64% 40%)",
  atencao: "hsl(28 92% 55%)",
  critico: "hsl(0 84% 60%)",
};

const DOT_CLASSES: Record<string, string> = {
  disponivel: "bg-emerald-600",
  manutencao: "bg-violet-500",
  indisponivel: "bg-red-500",
  baixado: "bg-slate-500",
  normal: "bg-emerald-600",
  atencao: "bg-orange-500",
  critico: "bg-red-500",
};

const BAR_CLASSES: Record<string, string> = {
  disponivel: "bg-emerald-500",
  manutencao: "bg-violet-500",
  indisponivel: "bg-red-500",
  baixado: "bg-slate-500",
  normal: "bg-emerald-500",
  atencao: "bg-orange-500",
  critico: "bg-red-500",
};

const LABELS: Record<string, string> = {
  disponivel: "Disponível",
  manutencao: "Em manutenção",
  indisponivel: "Indisponível",
  baixado: "Baixado",
  normal: "Normal",
  atencao: "Atenção",
  critico: "Crítico",
};

type Props = {
  data: { status: string; total: number }[];
  title: string;
  description?: string;
};

export function StatusDonut({ data, title, description }: Props) {
  const total = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/70 px-5 py-4">
        <CardTitle className="text-base text-slate-950">{title}</CardTitle>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </CardHeader>
      <CardContent className="grid gap-5 p-5 sm:grid-cols-[minmax(190px,0.8fr)_minmax(220px,1.2fr)] sm:items-center">
        <div className="relative mx-auto h-52 w-full max-w-64">
          {total > 0 ? (
            <>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={63}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="white"
                    strokeWidth={2}
                  >
                    {data.map((item) => (
                      <Cell key={item.status} fill={COLORS[item.status] || "hsl(215 16% 47%)"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [Number(value).toLocaleString("pt-BR"), LABELS[String(name)] ?? name]}
                    contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums text-slate-950">{total.toLocaleString("pt-BR")}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">frotas</span>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem dados</div>
          )}
        </div>

        <div className="space-y-4">
          {data.map((item) => {
            const percentage = total > 0 ? (item.total / total) * 100 : 0;
            return (
              <div key={item.status}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT_CLASSES[item.status] ?? "bg-slate-500")} />
                    <span className="truncate font-medium text-slate-700">{LABELS[item.status] ?? item.status}</span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs tabular-nums text-slate-500">{percentage.toFixed(1)}%</span>
                    <span className="min-w-8 text-right font-semibold tabular-nums text-slate-950">{item.total.toLocaleString("pt-BR")}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full", BAR_CLASSES[item.status] ?? "bg-slate-500")}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
