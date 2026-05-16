"use client";

import { type ElementType, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Flame, Gauge, RotateCcw, Save, Search, Truck } from "lucide-react";
import { registrarTrocaAction } from "@/app/(app)/pneus/_actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleTireMap } from "@/components/pneus/vehicle-tire-map";
import { gerarNumeroFogoSequencial } from "@/lib/numero-fogo";
import {
  DESCRICAO_POSICAO_PNEU,
  getTipoLayoutPneus,
  NOME_LAYOUT_PNEUS,
} from "@/lib/pneus-layout";
import type { Veiculo } from "@/lib/repos/manutencao/types";

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

  const selected = useMemo(
    () => veiculos.find((veiculo) => String(veiculo.id) === selectedId) ?? veiculos[0] ?? null,
    [selectedId, veiculos]
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

  return (
    <div className="space-y-5 pb-24">
      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
          <div className="border-b bg-slate-950 p-5 text-white lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/20">
                <Truck className="h-5 w-5 text-blue-200" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Serviço</p>
                <h1 className="text-2xl font-semibold">Troca de pneus</h1>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300">
              Selecione a frota, marque as posições substituídas no desenho e registre a troca com número de fogo previsto.
            </p>

            <form className="mt-5 grid gap-2" action="/pneus">
              <label className="relative">
                <span className="sr-only">Buscar frota</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  name="q"
                  defaultValue={query ?? ""}
                  placeholder="Buscar frota, placa ou modelo"
                  className="border-white/10 bg-white/10 pl-9 text-white placeholder:text-slate-400"
                />
              </label>
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            <Metric icon={Truck} label="Veículos filtrados" value={String(veiculos.length)} />
            <Metric
              icon={Gauge}
              label="Pneus mapeados"
              value={String(veiculos.reduce((total, item) => total + Number(item.qtd_pneus ?? 0), 0))}
            />
            <Metric
              icon={AlertTriangle}
              label="Sem layout visual"
              value={String(veiculos.filter((item) => !getTipoLayoutPneus(item.qtd_pneus)).length)}
              tone="warning"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-5 rounded-md border bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700" htmlFor="veiculo">
                Frota
              </label>
              <select
                id="veiculo"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setSelectedPositions([]);
                }}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {veiculos.map((veiculo) => (
                  <option key={veiculo.id} value={veiculo.id}>
                    {veiculo.codigo_frota} - {veiculo.placa ?? "Sem placa"} - {veiculo.modelo ?? "Sem modelo"}
                  </option>
                ))}
              </select>

              {selected ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Tipo / layout" value={layoutType ? NOME_LAYOUT_PNEUS[layoutType] : "Sem layout mapeado"} />
                  <Info label="Placa" value={selected.placa ?? "-"} />
                  <Info label="Modelo" value={selected.modelo ?? "-"} />
                  <Info label="Local" value={selected.local ?? "-"} />
                </div>
              ) : null}
            </div>

            <div className="rounded-md border bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</div>
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
              <div className="mt-3 text-sm text-muted-foreground">
                {selectedPositions.length} posição(ões) selecionada(s)
                {selected ? ` de ${selected.qtd_pneus ?? 0}` : ""}
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-slate-50 p-4">
            {selected && layoutType ? (
              <VehicleTireMap tipo={layoutType} selected={selectedPositions} onToggle={togglePosition} />
            ) : (
              <div className="flex min-h-72 items-center justify-center text-center text-sm text-muted-foreground">
                Selecione uma frota com quantidade de pneus mapeada para visualizar as posições.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-md border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Resumo da troca</h2>
            <p className="text-sm text-muted-foreground">Revise os dados antes de confirmar o registro.</p>
            <div className="mt-4 space-y-4">
              <Info label="Frota selecionada" value={selected?.codigo_frota ?? "-"} />
              <Info label="Layout" value={layoutType ? NOME_LAYOUT_PNEUS[layoutType] : "-"} />
              <Info
                label="Estepe"
                value={incluiEstepe ? "Incluído na troca" : "Não incluído"}
                tone={incluiEstepe ? "warning" : undefined}
              />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Posições selecionadas
                </div>
                {selectedDetails.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedDetails.map((item) => (
                      <Badge key={item.position} variant="outline" title={item.description} className="bg-blue-50 text-blue-800">
                        {item.label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Nenhuma posição selecionada.</p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Flame className="h-3.5 w-3.5" />
                  Número de fogo previsto
                </div>
                {selectedDetails.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {selectedDetails.map((item) => (
                      <div key={item.position} className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2 text-sm">
                        <span>{item.label}</span>
                        <strong className="tracking-wide text-blue-700">{item.numeroFogo}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">--</p>
                )}
              </div>
            </div>
          </section>

          <form
            action={(formData) => {
              startTransition(async () => {
                await registrarTrocaAction(formData);
                clearSelection();
              });
            }}
            className="rounded-md border bg-white p-5 shadow-sm"
          >
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

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-md border bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <Icon className={tone === "warning" ? "h-4 w-4 text-amber-600" : "h-4 w-4 text-blue-700"} />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={tone === "warning" ? "mt-1 font-semibold text-amber-700" : "mt-1 font-semibold text-slate-900"}>
        {value}
      </div>
    </div>
  );
}
