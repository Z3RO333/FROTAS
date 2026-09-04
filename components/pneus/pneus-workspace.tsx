"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Flame, Gauge, RotateCcw, Save, Truck } from "lucide-react";
import { registrarTrocaAction } from "@/app/(app)/pneus/_actions";
import { Button } from "@/components/ui/button";
import { DebouncedUrlSearch } from "@/components/ui/debounced-url-search";
import { Input } from "@/components/ui/input";
import { PageHero, HeroStat } from "@/components/ui/page-header";
import { VehicleTireMap } from "@/components/pneus/vehicle-tire-map";
import { VehicleSearchSelect, type VehicleOption } from "@/components/vehicles/vehicle-search-select";
import { gerarNumeroFogoSequencial } from "@/lib/numero-fogo";
import {
  DESCRICAO_POSICAO_PNEU,
  getTipoLayoutPneus,
  NOME_LAYOUT_PNEUS,
} from "@/lib/pneus-layout";
import type { Veiculo } from "@/lib/repos/manutencao/types";
import { cn } from "@/lib/utils";

export function PneusWorkspace({
  veiculos,
  query,
  ultimaContagemPorFrota = {},
}: {
  veiculos: Veiculo[];
  query?: string;
  ultimaContagemPorFrota?: Record<string, number>;
}) {
  const [selectedId, setSelectedId] = useState(() => String(veiculos[0]?.id ?? ""));
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [km, setKm] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isPending, startTransition] = useTransition();
  const submissionIdRef = useRef<string | null>(null);

  const selected = useMemo(
    () => veiculos.find((veiculo) => String(veiculo.id) === selectedId) ?? veiculos[0] ?? null,
    [selectedId, veiculos]
  );
  const vehicleOptions = useMemo<VehicleOption[]>(
    () =>
      veiculos.map((veiculo) => ({
        id: veiculo.id,
        codigo: veiculo.codigo_frota,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
      })),
    [veiculos]
  );
  const layoutType = selected ? getTipoLayoutPneus(selected.qtd_pneus) : null;
  const ultimaContagem = selected ? ultimaContagemPorFrota[selected.codigo_frota] ?? 0 : 0;
  const selectedDetails = selectedPositions.map((position, index) => {
    const numeroFogo = gerarNumeroFogoSequencial({
      frota: selected?.codigo_frota,
      placa: selected?.placa,
      ano: new Date().getFullYear(),
      contagem: ultimaContagem + index + 1,
    }).numeroFogo;
    return {
      position,
      label: position.toUpperCase(),
      description: DESCRICAO_POSICAO_PNEU[position] ?? position,
      numeroFogo,
    };
  });
  const posicoesPayload = JSON.stringify(
    selectedDetails.map((item) => ({ posicao: item.position, numero_fogo: item.numeroFogo }))
  );
  const incluiEstepe = selectedPositions.includes("estepe");
  const canSave = Boolean(selected && selectedPositions.length > 0 && km && !isPending);

  function togglePosition(position: string) {
    setSelectedPositions((current) =>
      current.includes(position) ? current.filter((item) => item !== position) : [...current, position]
    );
  }

  function clearSelection() {
    setSelectedPositions([]);
    setObservacoes("");
  }

  const totalPneusMapeados = veiculos.reduce((total, item) => total + Number(item.qtd_pneus ?? 0), 0);
  const semLayout = veiculos.filter((item) => !getTipoLayoutPneus(item.qtd_pneus)).length;

  return (
    <div className="space-y-5 pb-24">
      <PageHero
        eyebrow="Serviço · Pneus"
        title="Troca de pneus"
        description="Selecione a frota, marque as posições substituídas no desenho e registre a troca com número de fogo previsto."
        icon={Truck}
        actions={
          <DebouncedUrlSearch
            defaultValue={query ?? ""}
            placeholder="Buscar frota, placa ou modelo"
            ariaLabel="Buscar frota"
            className="w-full max-w-md"
            inputClassName="border-white/15 bg-white/10 text-white placeholder:text-slate-400 focus-visible:ring-blue-400/30"
          />
        }
      >
        <HeroStat
          label="Veículos filtrados"
          value={veiculos.length}
          icon={Truck}
          severity="INFO"
        />
        <HeroStat
          label="Pneus mapeados"
          value={totalPneusMapeados}
          icon={Gauge}
          severity="OK"
        />
        <HeroStat
          label="Sem layout visual"
          value={semLayout}
          icon={AlertTriangle}
          severity={semLayout > 0 ? "ATENCAO" : "OK"}
          hint={semLayout > 0 ? "Configurar qtd. de pneus" : "Todos prontos"}
        />
      </PageHero>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-5 rounded-xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700" htmlFor="veiculo">
                Frota
              </label>
              <VehicleSearchSelect
                id="veiculo"
                vehicles={vehicleOptions}
                value={selected?.id ?? null}
                onChange={(vehicle) => {
                  setSelectedId(vehicle ? String(vehicle.id) : "");
                  setSelectedPositions([]);
                }}
              />

              {selected ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Tipo / layout" value={layoutType ? NOME_LAYOUT_PNEUS[layoutType] : "Sem layout mapeado"} />
                  <Info label="Placa" value={selected.placa ?? "-"} />
                  <Info label="Modelo" value={selected.modelo ?? "-"} />
                  <Info label="Local" value={selected.local ?? "-"} />
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "rounded-xl border p-4 ring-1 ring-inset",
                layoutType
                  ? "border-emerald-200 bg-emerald-50/70 ring-emerald-100"
                  : "border-amber-200 bg-amber-50/70 ring-amber-100"
              )}
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Status
              </div>
              <div className="mt-2 flex items-center gap-2">
                {layoutType ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-700">Layout pronto</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span className="font-semibold text-amber-700">Configurar pneus</span>
                  </>
                )}
              </div>
              <div className="mt-3 text-sm text-slate-600">
                <span className="text-base font-semibold tabular-nums text-slate-900">
                  {selectedPositions.length}
                </span>{" "}
                posição(ões) selecionada(s)
                {selected ? ` de ${selected.qtd_pneus ?? 0}` : ""}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-gradient-to-b from-slate-50 to-white p-4">
            {selected && layoutType ? (
              <VehicleTireMap tipo={layoutType} selected={selectedPositions} onToggle={togglePosition} />
            ) : (
              <div className="flex min-h-72 items-center justify-center text-center text-sm text-slate-500">
                Selecione uma frota com quantidade de pneus mapeada para visualizar as posições.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Resumo da troca</h2>
              {selectedDetails.length > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-[11px] font-semibold tabular-nums text-blue-700">
                  {selectedDetails.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">Revise os dados antes de confirmar o registro.</p>
            <div className="mt-4 space-y-4">
              <Info label="Frota selecionada" value={selected?.codigo_frota ?? "-"} />
              <Info label="Layout" value={layoutType ? NOME_LAYOUT_PNEUS[layoutType] : "-"} />
              <Info
                label="Estepe"
                value={incluiEstepe ? "Incluído na troca" : "Não incluído"}
                tone={incluiEstepe ? "warning" : undefined}
              />
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Posições selecionadas
                </div>
                {selectedDetails.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedDetails.map((item) => (
                      <span
                        key={item.position}
                        title={item.description}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 ring-1 ring-inset ring-blue-200"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                        {item.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">Nenhuma posição selecionada.</p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  Número de fogo previsto
                </div>
                {selectedDetails.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {selectedDetails.map((item) => (
                      <div
                        key={item.position}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <strong className="font-mono tabular-nums tracking-wide text-blue-700">
                          {item.numeroFogo}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">--</p>
                )}
              </div>
            </div>
          </section>

          <form
            action={(formData) => {
              startTransition(async () => {
                if (!submissionIdRef.current) submissionIdRef.current = crypto.randomUUID();
                formData.set("submission_id", submissionIdRef.current);
                await registrarTrocaAction(formData);
                submissionIdRef.current = null;
                clearSelection();
              });
            }}
            className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]"
          >
            <input type="hidden" name="submission_id" value="" />
            <input type="hidden" name="id_veiculo" value={selected?.codigo_frota ?? ""} />
            <input type="hidden" name="posicoes" value={posicoesPayload} />
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="quilometragem">
                  Quilometragem do serviço
                </label>
                <Input
                  id="quilometragem"
                  name="quilometragem"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={km}
                  onChange={(event) => setKm(event.target.value)}
                  
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="observacoes">
                  Observações
                </label>
                <textarea
                  id="observacoes"
                  name="observacoes"
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  rows={4}
                  placeholder="Descreva informações relevantes sobre a troca."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={clearSelection}>
                  <RotateCcw className="h-4 w-4" />
                  Limpar
                </Button>
                <Button type="submit" className="flex-1" disabled={!canSave}>
                  <Save className="h-4 w-4" />
                  {isPending ? "Salvando..." : "Salvar troca"}
                </Button>
              </div>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 font-semibold",
          tone === "warning" ? "text-amber-700" : "text-slate-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}
