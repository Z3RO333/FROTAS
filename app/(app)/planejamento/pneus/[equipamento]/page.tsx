import Link from "next/link";
import { ChevronLeft, Truck } from "lucide-react";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import type { PneuRow } from "@/lib/repos/planejamento";
import { TireMap, TireDetailGrid } from "@/components/pneus/tire-map";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PneusVeiculoPage({
  params,
}: {
  params: Promise<{ equipamento: string }>;
}) {
  const { equipamento } = await params;
  const key = decodeURIComponent(equipamento);

  const { data } = await supabaseManutencao
    .from("fact_pneus")
    .select("equipamento,frota_numero,km_frota,posicao,numero_fogo,marca,dt_montagem,dt_atualizado,numero_fogo_anterior,marca_anterior,status,marcado,observacoes")
    .or(`equipamento.eq.${key},frota_numero.eq.${key}`)
    .order("posicao");

  const pneus = (data ?? []) as PneuRow[];
  const first = pneus[0];

  if (pneus.length === 0) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/planejamento/pneus">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <EmptyState icon={Truck} title="Veículo não encontrado" description={`Sem pneus mapeados para ${key}`} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/planejamento/pneus">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <div className="text-right">
          <div className="text-sm font-semibold">
            Frota {first?.frota_numero ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Equip {first?.equipamento ?? key}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
        <TireMap pneus={pneus} />
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Detalhe por posição ({pneus.length})</h3>
          <TireDetailGrid pneus={pneus} />
        </div>
      </div>
    </div>
  );
}
