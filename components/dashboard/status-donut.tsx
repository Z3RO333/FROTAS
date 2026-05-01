"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = {
  disponivel: "hsl(158 64% 40%)",
  manutencao: "hsl(38 92% 50%)",
  atencao: "hsl(28 92% 55%)",
  critico: "hsl(0 84% 60%)",
};

export function StatusDonut({ data }: { data: { status: string; total: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status da frota</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
            >
              {data.map((d) => (
                <Cell
                  key={d.status}
                  fill={COLORS[d.status as keyof typeof COLORS] || "hsl(215 16% 47%)"}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
