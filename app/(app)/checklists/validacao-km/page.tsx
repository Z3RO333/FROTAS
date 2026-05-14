import { CheckCircle2, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPendingKmValidations } from "@/lib/repos/historico-km";
import { requireAdminUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";
import { aprovarKmAction, corrigirKmAction } from "./_actions";

export const dynamic = "force-dynamic";

const ORIGEM_LABEL: Record<string, { label: string; tone: string }> = {
  CHECKLIST_INICIAL: { label: "Primeiro KM", tone: "bg-amber-100 text-amber-900" },
  CHECKLIST_MOTORISTA: { label: "Checklist", tone: "bg-blue-100 text-blue-900" },
  AJUSTE_ADMIN: { label: "Ajuste admin", tone: "bg-slate-100 text-slate-900" },
  IMPORTACAO: { label: "Importacao", tone: "bg-slate-100 text-slate-900" },
  OCR_HODOMETRO: { label: "OCR", tone: "bg-violet-100 text-violet-900" },
};

function motivoDaPendencia(entry: {
  km_anterior: number | null;
  km_novo: number;
  diferenca_km: number | null;
  origem: string;
}): string {
  if (entry.origem === "CHECKLIST_INICIAL") return "Primeiro KM cadastrado via checklist.";
  if (entry.diferenca_km != null && entry.diferenca_km < 0) {
    return `KM informado (${formatNumber(entry.km_novo)}) e menor que o ultimo registrado (${formatNumber(entry.km_anterior)}).`;
  }
  if (entry.diferenca_km != null && entry.diferenca_km > 1500) {
    return `Variacao incomum: +${formatNumber(entry.diferenca_km)} km em relacao ao ultimo (${formatNumber(entry.km_anterior)}).`;
  }
  return "Aguardando validacao do administrador.";
}

export default async function ValidacaoKmPage() {
  await requireAdminUser();
  const pendentes = await listPendingKmValidations(200);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Administracao</p>
        <h1 className="text-3xl font-semibold tracking-tight">Validacao de KM</h1>
        <p className="text-sm text-muted-foreground">
          Aprove o primeiro KM cadastrado pelo motorista, KM regressivo ou variacoes incomuns antes que entrem no
          historico oficial da frota.
        </p>
      </div>

      {pendentes.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border bg-white p-6 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Nenhuma validacao pendente.</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendentes.map((entry) => {
            const origem = ORIGEM_LABEL[entry.origem] ?? { label: entry.origem, tone: "bg-slate-100" };
            const motivo = motivoDaPendencia(entry);
            return (
              <article key={entry.id} className="rounded-md border bg-white p-4 shadow-sm">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-700" aria-hidden="true" />
                      <h2 className="text-lg font-semibold">
                        {entry.frota_geral ?? `Frota #${entry.frota_id}`}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {entry.placa ?? "Sem placa"} - {entry.modelo ?? "Sem modelo"}
                        </span>
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.motorista_nome ?? entry.motorista_id ?? "-"} - {formatDate(entry.criado_em)}
                    </p>
                  </div>
                  <Badge className={origem.tone}>{origem.label}</Badge>
                </header>

                <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                  <Stat label="KM anterior" value={formatNumber(entry.km_anterior)} />
                  <Stat label="KM informado" value={formatNumber(entry.km_novo)} highlight />
                  <Stat
                    label="Diferenca"
                    value={entry.diferenca_km != null ? `${entry.diferenca_km > 0 ? "+" : ""}${formatNumber(entry.diferenca_km)}` : "-"}
                  />
                  <Stat
                    label="Foto do hodometro"
                    value={entry.foto_km_url ? "Anexada" : "Sem foto"}
                    tone={entry.foto_km_url ? "text-emerald-700" : "text-red-700"}
                  />
                </div>

                <div className="mt-2 rounded-md border-l-4 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {motivo}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <form action={aprovarKmAction} className="space-y-2 rounded-md border bg-emerald-50/40 p-3">
                    <input type="hidden" name="id" value={entry.id} />
                    <Label htmlFor={`obs-aprovar-${entry.id}`}>Observacao (opcional)</Label>
                    <Input id={`obs-aprovar-${entry.id}`} name="observacao" placeholder="Ex.: foto OK" />
                    <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-700/90">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Aprovar como valido
                    </Button>
                  </form>

                  <form action={corrigirKmAction} className="space-y-2 rounded-md border bg-slate-50 p-3">
                    <input type="hidden" name="id" value={entry.id} />
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                      <div className="space-y-1">
                        <Label htmlFor={`km-corrigir-${entry.id}`}>KM corrigido</Label>
                        <Input
                          id={`km-corrigir-${entry.id}`}
                          name="km_corrigido"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          defaultValue={entry.km_novo}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`obs-corrigir-${entry.id}`}>Justificativa (obrigatoria)</Label>
                        <Input
                          id={`obs-corrigir-${entry.id}`}
                          name="observacao"
                          placeholder="Motivo da correcao"
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="outline" className="w-full">
                      Corrigir KM
                    </Button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: string;
}) {
  return (
    <div className="rounded-md border bg-slate-50 px-3 py-2">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${highlight ? "text-blue-700" : tone ?? "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}
