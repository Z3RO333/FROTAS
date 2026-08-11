"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CalendarClock, Edit, Eye, FileText, Gauge, History, MapPin, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BemolTruck } from "@/components/frotas/bemol-truck";
import { MissingInfoBadge } from "@/components/frotas/missing-info-badge";
import { EnviarManutencaoDialog } from "@/components/frotas/manutencao/enviar-manutencao-dialog";
import { RetornarOperacaoDialog } from "@/components/frotas/manutencao/retornar-operacao-dialog";
import { CDS_OPERACIONAIS } from "@/lib/cds";
import { normalizeCdNome } from "@/lib/cd-utils";
import type { Frota } from "@/lib/repos/frotas";
import { calcularIdade } from "@/lib/rules";
import {
  CONDICAO_LABELS,
  STATUS_OPERACIONAL_LABELS,
  cadastroIncompleto,
  condicaoFrota,
  frotaTitle,
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

const TABS = [
  "Resumo",
  "Cadastro",
  "KM",
  "Histórico",
  "Alertas",
  "Documentos",
] as const;

type Tab = (typeof TABS)[number];

function EmptyValue() {
  return <span className="text-muted-foreground">&mdash;</span>;
}

type UpdateLocalizacaoAction = (formData: FormData) => void | Promise<void>;

function localizacaoOptions(): string[] {
  return [...CDS_OPERACIONAIS];
}

export function FrotasTable({
  rows,
  updateLocalizacaoAction,
}: {
  rows: Frota[];
  updateLocalizacaoAction?: UpdateLocalizacaoAction;
}) {
  const [selected, setSelected] = useState<Frota | null>(null);
  const [tab, setTab] = useState<Tab>("Resumo");

  function openDrawer(frota: Frota) {
    setSelected(frota);
    setTab("Resumo");
  }

  if (rows.length === 0) {
    return (
      <div className="grid gap-4 rounded-lg border bg-white p-8 text-center shadow-sm md:grid-cols-[220px_1fr] md:text-left">
        <BemolTruck className="mx-auto max-w-[220px]" />
        <div className="flex flex-col justify-center">
          <h2 className="text-lg font-semibold">Nenhuma frota encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste os filtros ou limpe a busca para voltar a visualizar a operação completa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((f) => (
          <MobileFrotaCard key={f.id} frota={f} onOpen={() => openDrawer(f)} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border bg-white shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Frota</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Chassi</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Ano / Idade</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead className="text-right">KM</TableHead>
              <TableHead>Status operacional</TableHead>
              <TableHead>Condição</TableHead>
              <TableHead>Atualização</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((f) => (
              <FrotaRow
                key={f.id}
                frota={f}
                updateLocalizacaoAction={updateLocalizacaoAction}
                onOpen={() => openDrawer(f)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected ? (
          <FrotaDrawer
            frota={selected}
            tab={tab}
            updateLocalizacaoAction={updateLocalizacaoAction}
            onTabChange={setTab}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function FrotaRow({
  frota,
  updateLocalizacaoAction,
  onOpen,
}: {
  frota: Frota;
  updateLocalizacaoAction?: UpdateLocalizacaoAction;
  onOpen: () => void;
}) {
  const idade = calcularIdade(frota.ano_fabricacao);
  const status = statusOperacional(frota);
  const condicao = condicaoFrota(frota);

  return (
    <TableRow
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className="cursor-pointer odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/70 focus:bg-blue-50 focus:outline-none transition-colors"
    >
      <TableCell className="font-medium">
        <button type="button" className="text-left hover:underline" onClick={onOpen}>
          {frota.frota_geral ?? <EmptyValue />}
        </button>
      </TableCell>
      <TableCell>{frota.placa ?? <EmptyValue />}</TableCell>
      <TableCell>{frota.chassi ? frota.chassi : <MissingInfoBadge />}</TableCell>
      <TableCell className="max-w-[220px] truncate">{frota.modelo ?? <EmptyValue />}</TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <div>{frota.ano_fabricacao ?? <EmptyValue />}</div>
          <div className="text-xs text-muted-foreground">{idade != null ? `${idade} ano(s)` : "Sem ano"}</div>
        </div>
      </TableCell>
      <TableCell className="min-w-[240px]" onClick={(event) => event.stopPropagation()}>
        {updateLocalizacaoAction ? (
          <LocalizacaoSelectForm frota={frota} action={updateLocalizacaoAction} compact />
        ) : (
          <span className="block max-w-[220px] truncate">{frota.localizacao ?? <EmptyValue />}</span>
        )}
      </TableCell>
      <TableCell className="max-w-[180px] truncate">{frota.setor ?? <EmptyValue />}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(frota.km_atual)}</TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <Badge className={STATUS_CLASS[status]}>{STATUS_OPERACIONAL_LABELS[status]}</Badge>
          {frota.status === "manutencao" && frota.manutencao_motivo && (
            <span
              className="max-w-[180px] truncate text-[10px] text-violet-700"
              title={frota.manutencao_motivo}
            >
              {frota.manutencao_motivo}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={CONDITION_CLASS[condicao]}>
          {CONDICAO_LABELS[condicao]}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(frota.atualizado_em)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Ver detalhes"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Editar frota"
            onClick={(event) => event.stopPropagation()}
          >
            <Link href={`/frotas/${frota.id}/editar`}>
              <Edit className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

const STATUS_LEFT_BORDER: Record<StatusOperacional, string> = {
  disponivel: "border-l-emerald-500",
  manutencao: "border-l-amber-500",
  indisponivel: "border-l-red-500",
  baixado: "border-l-slate-400",
};

function MobileFrotaCard({ frota, onOpen }: { frota: Frota; onOpen: () => void }) {
  const status = statusOperacional(frota);
  const condicao = condicaoFrota(frota);
  const idade = calcularIdade(frota.ano_fabricacao);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative w-full overflow-hidden rounded-xl border border-l-4 border-slate-200/70 bg-white p-4 text-left transition-all duration-150 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] hover:-translate-y-[1px] hover:border-blue-300 hover:shadow-[0_2px_0_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.22)] ${STATUS_LEFT_BORDER[status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold tracking-tight text-slate-950">
            {frotaTitle(frota)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-500">
            {frota.placa && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                {frota.placa}
              </span>
            )}
            <span className="truncate">{frota.modelo ?? "Sem modelo"}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge className={STATUS_CLASS[status]}>{STATUS_OPERACIONAL_LABELS[status]}</Badge>
          <Badge variant="outline" className={CONDITION_CLASS[condicao]}>
            {CONDICAO_LABELS[condicao]}
          </Badge>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <MiniMetric icon={<MapPin className="h-4 w-4" />} label="Local" value={frota.localizacao ?? "-"} />
        <MiniMetric icon={<MapPin className="h-4 w-4" />} label="Setor" value={frota.setor ?? "-"} />
        <MiniMetric icon={<Gauge className="h-4 w-4" />} label="KM" value={formatNumber(frota.km_atual)} />
        <MiniMetric icon={<CalendarClock className="h-4 w-4" />} label="Idade" value={idade != null ? `${idade} ano(s)` : "-"} />
        <MiniMetric icon={<FileText className="h-4 w-4" />} label="Atualização" value={formatDate(frota.atualizado_em) ?? "-"} />
      </div>
    </button>
  );
}

function LocalizacaoSelectForm({
  frota,
  action,
  compact = false,
}: {
  frota: Frota;
  action: UpdateLocalizacaoAction;
  compact?: boolean;
}) {
  const options = localizacaoOptions();
  const normalizado = normalizeCdNome(frota.localizacao);

  return (
    <form
      key={`${frota.id}-${normalizado}`}
      action={action}
      className={compact ? "flex min-w-[220px] items-center gap-1" : "flex flex-col gap-2 sm:flex-row"}
      onClick={(event) => event.stopPropagation()}
    >
      <input type="hidden" name="id" value={frota.id} />
      <select
        name="localizacao"
        defaultValue={normalizado === "Sem CD" ? "" : normalizado}
        aria-label="CD ou localização da frota"
        className={
          compact
            ? "h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
            : "h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        }
      >
        <option value="">Sem CD</option>
        {options
          .filter((local) => local !== "Sem CD")
          .map((local) => (
            <option key={local} value={local}>
              {local}
            </option>
          ))}
      </select>
      <Button type="submit" variant="outline" size={compact ? "sm" : "default"} className="shrink-0">
        <Save className="h-4 w-4" aria-hidden="true" />
        {!compact ? "Salvar" : null}
      </Button>
    </form>
  );
}

function FrotaDrawer({
  frota,
  tab,
  updateLocalizacaoAction,
  onTabChange,
}: {
  frota: Frota;
  tab: Tab;
  updateLocalizacaoAction?: UpdateLocalizacaoAction;
  onTabChange: (tab: Tab) => void;
}) {
  const status = statusOperacional(frota);
  const condicao = condicaoFrota(frota);
  const idade = calcularIdade(frota.ano_fabricacao);

  return (
    <SheetContent>
      <div className="border-b p-5 pr-12">
        <SheetHeader>
          <SheetTitle>{frotaTitle(frota)}</SheetTitle>
          <SheetDescription>
            {frota.placa ?? "Sem placa"} · {frota.modelo ?? "Modelo não informado"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
          <BemolTruck frota={frota.frota_geral ?? frota.id} className="max-w-[200px]" />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_CLASS[status]}>{STATUS_OPERACIONAL_LABELS[status]}</Badge>
              <Badge variant="outline" className={CONDITION_CLASS[condicao]}>
                {CONDICAO_LABELS[condicao]}
              </Badge>
              {cadastroIncompleto(frota) ? <MissingInfoBadge /> : null}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MiniMetric icon={<CalendarClock className="h-4 w-4" />} label="Idade" value={idade != null ? `${idade} ano(s)` : "-"} />
              <MiniMetric icon={<Gauge className="h-4 w-4" />} label="KM" value={formatNumber(frota.km_atual)} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-b bg-white px-5 py-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onTabChange(item)}
              className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                tab === item ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "Resumo" ? (
          <ResumoTab frota={frota} updateLocalizacaoAction={updateLocalizacaoAction} />
        ) : null}
        {tab === "Cadastro" ? <CadastroTab frota={frota} /> : null}
        {tab === "KM" ? <KmTab frota={frota} /> : null}
        {tab === "Histórico" ? <HistoricoTab frota={frota} /> : null}
        {tab === "Alertas" ? <AlertasTab frota={frota} /> : null}
        {tab === "Documentos" ? <DocumentosTab /> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/frotas/${frota.id}/editar`}>
              <Edit className="h-4 w-4" aria-hidden="true" />
              Editar cadastro
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/frotas/${frota.id}`}>
              <History className="h-4 w-4" aria-hidden="true" />
              Visão 360º
            </Link>
          </Button>
          {frota.status === "manutencao" ? (
            <RetornarOperacaoDialog
              frotaId={frota.id}
              frotaLabel={frota.frota_geral ?? frota.placa ?? `#${frota.id}`}
              size="default"
            />
          ) : !frota.vendido && frota.ativo ? (
            <EnviarManutencaoDialog
              frotaId={frota.id}
              frotaLabel={frota.frota_geral ?? frota.placa ?? `#${frota.id}`}
              size="default"
            />
          ) : null}
        </div>
      </div>
    </SheetContent>
  );
}

function ResumoTab({
  frota,
  updateLocalizacaoAction,
}: {
  frota: Frota;
  updateLocalizacaoAction?: UpdateLocalizacaoAction;
}) {
  const motivos = motivosAtencao(frota);

  return (
    <div className="space-y-5">
      {updateLocalizacaoAction ? (
        <div className="rounded-md border bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Trocar CD / localização
          </div>
          <LocalizacaoSelectForm frota={frota} action={updateLocalizacaoAction} />
        </div>
      ) : null}
      <InfoGrid>
        <Field label="Localização" value={frota.localizacao} />
        <Field label="Setor" value={frota.setor} />
        <Field label="Status operacional" value={STATUS_OPERACIONAL_LABELS[statusOperacional(frota)]} />
        <Field label="Condição" value={CONDICAO_LABELS[condicaoFrota(frota)]} />
        <Field label="Última atualização" value={formatDate(frota.atualizado_em)} />
      </InfoGrid>
      <div>
        <h3 className="text-sm font-semibold">Motivo da atenção</h3>
        {motivos.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {motivos.map((motivo) => (
              <li key={motivo} className="rounded-md border bg-slate-50 px-3 py-2">
                {motivo}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-md border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Sem motivos automáticos de atenção.
          </p>
        )}
      </div>
    </div>
  );
}

function CadastroTab({ frota }: { frota: Frota }) {
  return (
    <InfoGrid>
      <Field label="Frota geral" value={frota.frota_geral} />
      <Field label="Placa" value={frota.placa} />
      <Field label="Chassi" value={frota.chassi} />
      <Field label="Renavam" value={frota.renavam} />
      <Field label="Modelo / Marca" value={frota.modelo} />
      <Field label="Ano de fabricação" value={frota.ano_fabricacao} />
      <Field label="Localização / CD" value={frota.localizacao} />
      <Field label="Setor" value={frota.setor} />
      <Field label="Cadastro" value={cadastroIncompleto(frota) ? "Incompleto" : "Completo"} />
      <Field label="Atualizado por" value={frota.atualizado_por} />
    </InfoGrid>
  );
}

function KmTab({ frota }: { frota: Frota }) {
  return (
    <div className="space-y-4">
      <InfoGrid>
        <Field label="KM atual" value={formatNumber(frota.km_atual)} />
        <Field label="Última atualização" value={formatDate(frota.atualizado_em)} />
      </InfoGrid>
      <p className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
        Para registrar KM agora, use a edição da frota. A próxima etapa natural é separar um fluxo rápido só para KM.
      </p>
    </div>
  );
}

function HistoricoTab({ frota }: { frota: Frota }) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
        O histórico completo continua na página da frota, com alterações rastreadas de KM, status, localização,
        chassi e observações.
      </p>
      <Button variant="outline" asChild>
        <Link href={`/frotas/${frota.id}`}>Abrir histórico completo</Link>
      </Button>
    </div>
  );
}

function AlertasTab({ frota }: { frota: Frota }) {
  const motivos = motivosAtencao(frota);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Alertas automáticos</h3>
      {motivos.length > 0 ? (
        <ul className="space-y-2 text-sm text-muted-foreground">
          {motivos.map((motivo) => (
            <li key={motivo} className="rounded-md border bg-orange-50 px-3 py-2 text-orange-900">
              {motivo}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Nenhum alerta automático para esta frota.
        </p>
      )}
    </div>
  );
}

function DocumentosTab() {
  return (
    <p className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
      Documentos ainda não existem no schema atual. O drawer já reserva o espaço para anexos e vencimentos quando
      essa tabela entrar.
    </p>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-white px-3 py-2">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value ?? <EmptyValue />}</div>
    </div>
  );
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-2 py-2">
      <span className="text-blue-700">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-medium">{value}</span>
      </span>
    </div>
  );
}
