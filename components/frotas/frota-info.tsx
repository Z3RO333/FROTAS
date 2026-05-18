import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BemolTruck } from "@/components/frotas/bemol-truck";
import { MissingInfoBadge } from "@/components/frotas/missing-info-badge";
import type { Frota } from "@/lib/repos/frotas";
import { normalizeCdNome } from "@/lib/cd-utils";
import { calcularIdade } from "@/lib/rules";
import {
  CONDICAO_LABELS,
  STATUS_OPERACIONAL_LABELS,
  cadastroIncompleto,
  condicaoFrota,
  motivosAtencao,
  statusOperacional,
  type CondicaoFrota,
  type StatusOperacional,
} from "@/lib/frota-derived";
import { formatDate, formatNumber } from "@/lib/utils";

const STATUS_CLASS: Record<StatusOperacional, string> = {
  disponivel: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90",
  manutencao: "border-transparent bg-amber-500 text-white hover:bg-amber-500/90",
  indisponivel: "border-transparent bg-red-600 text-white hover:bg-red-600/90",
  baixado: "border-transparent bg-slate-600 text-white hover:bg-slate-600/90",
};

const CONDITION_CLASS: Record<CondicaoFrota, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
  atencao: "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-50",
  critico: "border-red-200 bg-red-50 text-red-800 hover:bg-red-50",
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value ?? "-"}</div>
    </div>
  );
}

export function FrotaInfo({ frota }: { frota: Frota }) {
  const idade = calcularIdade(frota.ano_fabricacao);
  const atualizado = [frota.atualizado_por, formatDate(frota.atualizado_em)]
    .filter((v) => v && v !== "-")
    .join(" em ");
  const status = statusOperacional(frota);
  const condicao = condicaoFrota(frota);
  const motivos = motivosAtencao(frota);

  return (
    <Card className="overflow-hidden border-blue-100 bg-white">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <BemolTruck frota={frota.frota_geral ?? frota.id} />
          <div className="flex flex-wrap gap-2">
            <Badge className={STATUS_CLASS[status]}>{STATUS_OPERACIONAL_LABELS[status]}</Badge>
            <Badge variant="outline" className={CONDITION_CLASS[condicao]}>
              {CONDICAO_LABELS[condicao]}
            </Badge>
            {cadastroIncompleto(frota) ? <MissingInfoBadge /> : null}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Field label="Frota geral" value={frota.frota_geral} />
          <Field label="Placa" value={frota.placa} />
          <Field label="Modelo / Marca" value={frota.modelo} />
          <Field label="Chassi" value={frota.chassi ?? <MissingInfoBadge />} />
          <Field label="Renavam" value={frota.renavam} />
          <Field label="Ano de fabricação" value={frota.ano_fabricacao} />
          <Field label="Idade" value={idade != null ? `${idade} ano(s)` : null} />
          <Field label="CD" value={normalizeCdNome(frota.localizacao)} />
          <Field label="Setor" value={frota.localizacao} />
          <Field label="Km atual" value={formatNumber(frota.km_atual)} />
          <Field label="Última atualização" value={atualizado || null} />
          <div className="md:col-span-3">
            <Field label="Motivo da atenção" value={motivos.length > 0 ? motivos.join("; ") : "Sem alertas automáticos"} />
          </div>
          <div className="md:col-span-3">
            <Field label="Observações" value={<p className="whitespace-pre-wrap">{frota.observacoes ?? "-"}</p>} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
