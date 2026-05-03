"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KmEvolutionChart({ data }: { data: { date: string; km: number }[] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução da quilometragem</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="km" stroke="var(--primary)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
