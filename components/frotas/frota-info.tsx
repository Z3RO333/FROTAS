import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MissingInfoBadge } from "@/components/frotas/missing-info-badge";
import type { Frota } from "@/lib/repos/frotas";
import { calcularIdade } from "@/lib/rules";
import { formatDate, formatNumber } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  disponivel: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90",
  manutencao: "border-transparent bg-amber-500 text-white hover:bg-amber-500/90",
  atencao: "border-transparent bg-orange-500 text-white hover:bg-orange-500/90",
  critico: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
  vendido: "border-transparent bg-slate-600 text-white hover:bg-slate-600/90",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export function FrotaInfo({ frota }: { frota: Frota }) {
  const idade = calcularIdade(frota.ano_fabricacao);
  const atualizado = [frota.atualizado_por, formatDate(frota.atualizado_em)]
    .filter((v) => v && v !== "—")
    .join(" em ");

  return (
    <Card>
      <CardContent className="grid gap-6 p-6 md:grid-cols-3">
        <Field label="Frota geral" value={frota.frota_geral} />
        <Field label="Placa" value={frota.placa} />
        <Field
          label="Status"
          value={
            frota.status ? <Badge className={STATUS_CLASS[frota.status] ?? ""}>{frota.status}</Badge> : null
          }
        />
        <Field label="Modelo / Marca" value={frota.modelo} />
        <Field label="Chassi" value={frota.chassi ?? <MissingInfoBadge />} />
        <Field label="Renavam" value={frota.renavam} />
        <Field label="Ano de fabricacao" value={frota.ano_fabricacao} />
        <Field label="Idade" value={idade != null ? `${idade} ano(s)` : null} />
        <Field label="Localizacao" value={frota.localizacao} />
        <Field label="Km atual" value={formatNumber(frota.km_atual)} />
        <Field label="Ultima atualizacao" value={atualizado || null} />
        <div className="md:col-span-3">
          <Field
            label="Observacoes"
            value={<p className="whitespace-pre-wrap">{frota.observacoes ?? "—"}</p>}
          />
        </div>
      </CardContent>
    </Card>
  );
}
