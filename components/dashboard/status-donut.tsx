"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS: Record<string, string> = {
  disponivel: "hsl(158 64% 40%)",
  manutencao: "hsl(38 92% 50%)",
  indisponivel: "hsl(0 84% 60%)",
  baixado: "hsl(215 16% 47%)",
  normal: "hsl(158 64% 40%)",
  atencao: "hsl(28 92% 55%)",
  critico: "hsl(0 84% 60%)",
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
};

export function StatusDonut({ data, title }: Props) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="h-44">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
              >
                {data.map((d) => (
                  <Cell key={d.status} fill={COLORS[d.status] || "hsl(215 16% 47%)"} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, LABELS[String(name)] ?? name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.status} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[item.status] || "hsl(215 16% 47%)" }}
                />
                <span className="truncate text-muted-foreground">{LABELS[item.status] ?? item.status}</span>
              </span>
              <span className="font-semibold tabular-nums">{item.total.toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
