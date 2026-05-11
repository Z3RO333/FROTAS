"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

type Props = {
  data: { ano: number | null; total: number }[];
};

export function FrotasPorAnoChart({ data }: Props) {
  const chartData = data.map((d) => ({
    label: d.ano != null ? String(d.ano) : "Sem ano",
    total: d.total,
    isUnknown: d.ano == null,
  }));

  const totalFrotas = chartData.reduce((acc, d) => acc + d.total, 0);
  const currentYear = new Date().getFullYear();

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-base">Frotas por ano de fabricação</CardTitle>
          <span className="text-xs text-muted-foreground">
            {formatNumber(totalFrotas)} frota(s)
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma frota cadastrada.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(215 16% 90%)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "hsl(215 16% 47%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(215 16% 95%)" }}
                  formatter={(value: number) => [`${formatNumber(value)} frota(s)`, "Total"]}
                  labelFormatter={(label) => `Ano: ${label}`}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartData.map((d) => {
                    const fill = d.isUnknown
                      ? "hsl(215 16% 65%)"
                      : Number(d.label) >= currentYear - 6
                        ? "hsl(214 88% 52%)"
                        : Number(d.label) >= currentYear - 9
                          ? "hsl(28 92% 55%)"
                          : "hsl(0 84% 60%)";
                    return <Cell key={d.label} fill={fill} />;
                  })}
                  <LabelList
                    dataKey="total"
                    position="top"
                    style={{ fontSize: 11, fill: "hsl(215 28% 27%)", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
