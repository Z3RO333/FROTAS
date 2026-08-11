import { CheckCircle2, Flame, Layers, Tag, Truck } from "lucide-react";
import { listVeiculosComPneus, getPneus } from "@/lib/repos/planejamento";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PneusVeiculosGrid } from "@/components/planejamento/pneus-veiculos-grid";

export const dynamic = "force-dynamic";

export default async function PneusPage() {
  const [veiculos, todosPneus] = await Promise.all([
    listVeiculosComPneus(),
    getPneus(),
  ]);

  const semFogo = todosPneus.filter((r) => !r.numero_fogo || r.numero_fogo === "SEM FOGO").length;
  const marcados = todosPneus.filter((r) => r.marcado).length;

  const byMarca = todosPneus.reduce<Record<string, number>>((acc, r) => {
    const m = r.marca ?? "Sem marca";
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});
  const topMarcas = Object.entries(byMarca).sort((a, b) => b[1] - a[1]).slice(0, 2);

  if (veiculos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Pneus"
          title="Painel de Pneus"
          description="Nenhum pneu mapeado ainda."
          icon={Truck}
          severity="NEUTRO"
        />
        <EmptyState icon={Truck} title="Sem pneus mapeados" />
      </div>
    );
  }

  // Ordenar: menos marcados primeiro (mais atenção)
  const ordered = [...veiculos].sort((a, b) => {
    const pa = a.total_pneus > 0 ? a.marcado / a.total_pneus : 0;
    const pb = b.total_pneus > 0 ? b.marcado / b.total_pneus : 0;
    return pa - pb;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pneus"
        title="Painel de Pneus"
        description={`${todosPneus.length} pneus em ${veiculos.length} veículos · ${marcados} com número de fogo.`}
        icon={Truck}
        severity={semFogo > 0 ? "ATENCAO" : "OK"}
      />

      <MetricGrid cols={5}>
        <MetricCard label="Total pneus" value={todosPneus.length} icon={Layers} severity="INFO" />
        <MetricCard label="Veículos" value={veiculos.length} icon={Truck} severity="INFO" />
        <MetricCard
          label="Marcados"
          value={marcados}
          icon={CheckCircle2}
          severity="OK"
          hint={`${todosPneus.length > 0 ? Math.round((marcados / todosPneus.length) * 100) : 0}% do total`}
        />
        <MetricCard
          label="Sem nº de fogo"
          value={semFogo}
          icon={Flame}
          severity={semFogo > 0 ? "ATENCAO" : "OK"}
        />
        {topMarcas[0] && (
          <MetricCard
            label={topMarcas[0][0]}
            value={topMarcas[0][1]}
            icon={Tag}
            severity="NEUTRO"
            hint="Marca mais usada"
          />
        )}
      </MetricGrid>

      <PneusVeiculosGrid veiculos={ordered} />
    </div>
  );
}
