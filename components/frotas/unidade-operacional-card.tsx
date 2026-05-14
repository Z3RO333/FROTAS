import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UnidadeOperacional } from "@/lib/repos/unidades";

export function UnidadeOperacionalCard({ unidade }: { unidade: UnidadeOperacional | null }) {
  return (
    <Card className="border-blue-100 bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
          Unidade operacional
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unidade ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Loja / unidade" value={unidade.loja} />
            <Field label="Negócio" value={unidade.negocio} />
            <Field label="UF" value={unidade.uf} />
            <Field label="Centro" value={unidade.centro} />
            <Field label="Centro de custo" value={unidade.centro_custo} />
            <Field label="Local Neg" value={unidade.local_negocio} />
            <Field label="CNPJ" value={unidade.cnpj} />
            <Field label="Inscrição estadual" value={unidade.inscricao_estadual} />
            <Field label="CEP" value={unidade.cep} />
            <div className="md:col-span-3">
              <Field
                label="Endereço"
                value={
                  <span className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                    {unidade.endereco ?? "-"}
                  </span>
                }
              />
            </div>
            {unidade.ie_subst_tributario ? (
              <div className="md:col-span-3">
                <Field label="IE subst. tributário" value={unidade.ie_subst_tributario} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border bg-slate-50 p-4 text-sm text-muted-foreground">
            <span>Nenhuma unidade da planilha foi vinculada automaticamente a esta frota.</span>
            <span>
              O vínculo usa localização, centro/local de negócio ou nome da unidade quando houver correspondência.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
        {label === "Negócio" && value ? <Badge variant="outline">{value}</Badge> : null}
      </div>
      {label === "Negócio" ? null : <div className="break-words text-sm font-medium">{value ?? "-"}</div>}
    </div>
  );
}
