import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

type Props = {
  data: { ano: number | null; total: number }[];
};

export function FrotasPorAnoChart({ data }: Props) {
  const items = data.map((d) => ({
    ano: d.ano,
    label: d.ano != null ? String(d.ano) : "Sem ano",
    total: d.total,
  }));

  const totalFrotas = items.reduce((acc, d) => acc + d.total, 0);
  const currentYear = new Date().getFullYear();

  function toneFor(ano: number | null): {
    border: string;
    bg: string;
    text: string;
    badge: string;
  } {
    if (ano == null) {
      return {
        border: "border-slate-200",
        bg: "bg-slate-50",
        text: "text-slate-700",
        badge: "Sem ano",
      };
    }
    const idade = currentYear - ano;
    if (idade >= 10) {
      return {
        border: "border-red-200 hover:border-red-300",
        bg: "bg-red-50/50 hover:bg-red-50",
        text: "text-red-700",
        badge: `${idade} anos`,
      };
    }
    if (idade >= 7) {
      return {
        border: "border-orange-200 hover:border-orange-300",
        bg: "bg-orange-50/50 hover:bg-orange-50",
        text: "text-orange-700",
        badge: `${idade} anos`,
      };
    }
    return {
      border: "border-blue-200 hover:border-blue-300",
      bg: "bg-blue-50/40 hover:bg-blue-50",
      text: "text-blue-700",
      badge: `${idade} ${idade === 1 ? "ano" : "anos"}`,
    };
  }

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
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma frota cadastrada.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {items.map((item) => {
              const tone = toneFor(item.ano);
              const href =
                item.ano != null ? `/frotas?ano=${item.ano}` : "/frotas?cadastro=incompleto";
              return (
                <Link
                  key={item.label}
                  href={href}
                  className={`group rounded-lg border ${tone.border} ${tone.bg} p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-ring`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${tone.text}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{tone.badge}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tabular-nums text-slate-950">
                      {formatNumber(item.total)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.total === 1 ? "frota" : "frotas"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
