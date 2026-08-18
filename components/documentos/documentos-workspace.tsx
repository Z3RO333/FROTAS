"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  FileX2,
  Layers,
  Pencil,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  createDocumentAction,
  deleteDocumentAction,
  updateDocumentAction,
  type DocumentActionResult,
} from "@/app/(app)/documentos/_actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHero, HeroStat } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { FilterBar, FilterSearch, FilterChip } from "@/components/ui/filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DocumentRecordWithSignedUrls } from "@/lib/repos/manutencao/types";
import { cicloRenovacaoPorPlaca, diasAteRenovacaoEstimada } from "@/lib/crlv-calendario";
import { cn } from "@/lib/utils";
import { DocumentPreviewDialog } from "@/components/documentos/document-preview-dialog";

type Props = {
  documents: DocumentRecordWithSignedUrls[];
  total: number;
  canWrite: boolean;
};

type FiltroStatus = "TODOS" | "COMPLETO" | "PARCIAL" | "PENDENTE" | "SEM_DUT" | "SEM_CRLV";

function statusDoDoc(doc: DocumentRecordWithSignedUrls): "COMPLETO" | "PARCIAL" | "PENDENTE" {
  if (doc.dut_url && doc.crlv_url) return "COMPLETO";
  if (doc.dut_url || doc.crlv_url) return "PARCIAL";
  return "PENDENTE";
}

// Linhas sintéticas de frotas ativas que nunca tiveram documento cadastrado
// (ver listAllDocumentsForFrotasAtivas) — não existem na tabela `documents`,
// então editar precisa criar em vez de atualizar, e não há nada pra excluir.
function isPendingDocument(doc: DocumentRecordWithSignedUrls): boolean {
  return doc.id.startsWith("pending:");
}

export function DocumentosWorkspace({ documents, total, canWrite }: Props) {
  const [queryFrota, setQueryFrota] = useState("");
  const [queryPlaca, setQueryPlaca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("TODOS");

  const complete = documents.filter((doc) => doc.dut_url && doc.crlv_url).length;
  const partial = documents.filter((doc) => (doc.dut_url || doc.crlv_url) && !(doc.dut_url && doc.crlv_url)).length;
  const pending = documents.filter((doc) => !doc.dut_url && !doc.crlv_url).length;
  const semDut = documents.filter((doc) => !doc.dut_url).length;
  const semCrlv = documents.filter((doc) => !doc.crlv_url).length;

  const comCrlvVencimento = documents.filter((doc) => doc.crlv_vencimento).length;
  // Quando não há data lida, cai na estimativa por calendário (final de placa)
  // — mesma fonte usada no aviso "Renovar esse mês" de cada linha — pros
  // cards não ficarem zerados só porque o documento não tem data explícita.
  const diasCrlv = documents.map((doc) =>
    doc.crlv_vencimento ? diasAteVencimento(doc.crlv_vencimento) : diasAteRenovacaoEstimada(doc.placa)
  );
  const crlvVencido = diasCrlv.filter((dias) => dias != null && dias < 0).length;
  const crlvVence1Mes = diasCrlv.filter((dias) => dias != null && dias >= 0 && dias < 30).length;
  const crlvVence2Meses = diasCrlv.filter((dias) => dias != null && dias >= 30 && dias < 60).length;

  const filtered = useMemo(() => {
    const termFrota = normalizeSearch(queryFrota);
    const termPlaca = normalizeSearch(queryPlaca);
    return documents.filter((doc) => {
      // Filtro de status
      if (filtro !== "TODOS") {
        const s = statusDoDoc(doc);
        if (filtro === "COMPLETO" && s !== "COMPLETO") return false;
        if (filtro === "PARCIAL" && s !== "PARCIAL") return false;
        if (filtro === "PENDENTE" && s !== "PENDENTE") return false;
        if (filtro === "SEM_DUT" && doc.dut_url) return false;
        if (filtro === "SEM_CRLV" && doc.crlv_url) return false;
      }
      // Busca separada — frota (número) e placa/modelo não se misturam, senão
      // digitar "2" trazia tanto frotas quanto placas com "2" no meio.
      if (termFrota && !normalizeSearch(doc.frota).includes(termFrota)) return false;
      if (termPlaca && !normalizeSearch(`${doc.placa} ${doc.modelo}`).includes(termPlaca)) return false;
      return true;
    });
  }, [documents, queryFrota, queryPlaca, filtro]);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Documentos"
        title="Central de Documentos"
        description={`${total} frotas cadastradas · ${complete} completas, ${partial} parciais, ${pending} sem PDFs.`}
        icon={ShieldCheck}
        actions={canWrite ? <DocumentUploadDialog /> : undefined}
      >
        <HeroStat
          label="Data confirmada"
          value={comCrlvVencimento}
          hint={`de ${documents.length} · resto é estimado por calendário`}
          icon={ShieldCheck}
          severity="INFO"
        />
        <HeroStat
          label="Vence em 1 mês"
          value={crlvVence1Mes}
          icon={AlertTriangle}
          severity={crlvVence1Mes > 0 ? "ATENCAO" : "OK"}
        />
        <HeroStat
          label="Vence em 2 meses"
          value={crlvVence2Meses}
          icon={AlertTriangle}
          severity={crlvVence2Meses > 0 ? "ATENCAO" : "OK"}
        />
        <HeroStat
          label="CRLV vencido"
          value={crlvVencido}
          icon={FileX2}
          severity={crlvVencido > 0 ? "CRITICO" : "OK"}
        />
      </PageHero>

      <FilterBar sticky>
        <FilterSearch value={queryFrota} onChange={setQueryFrota} placeholder="Buscar por frota…" className="sm:max-w-[160px]" />
        <FilterSearch value={queryPlaca} onChange={setQueryPlaca} placeholder="Buscar por placa ou modelo…" />
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="Todos"
            icon={Layers}
            count={documents.length}
            active={filtro === "TODOS"}
            onClick={() => setFiltro("TODOS")}
          />
          <FilterChip
            label="Completos"
            icon={ShieldCheck}
            count={complete}
            active={filtro === "COMPLETO"}
            severity={filtro === "COMPLETO" ? "OK" : undefined}
            onClick={() => setFiltro("COMPLETO")}
          />
          <FilterChip
            label="Parciais"
            icon={AlertTriangle}
            count={partial}
            active={filtro === "PARCIAL"}
            severity={filtro === "PARCIAL" ? "ATENCAO" : undefined}
            onClick={() => setFiltro("PARCIAL")}
          />
          <FilterChip
            label="Pendentes"
            icon={FileX2}
            count={pending}
            active={filtro === "PENDENTE"}
            severity={filtro === "PENDENTE" ? "CRITICO" : undefined}
            onClick={() => setFiltro("PENDENTE")}
          />
          <FilterChip
            label="Sem DUT"
            count={semDut}
            active={filtro === "SEM_DUT"}
            onClick={() => setFiltro("SEM_DUT")}
          />
          <FilterChip
            label="Sem CRLV"
            count={semCrlv}
            active={filtro === "SEM_CRLV"}
            onClick={() => setFiltro("SEM_CRLV")}
          />
        </div>
      </FilterBar>

      <section className="hidden overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] md:block">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Resultado da consulta</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {filtered.length} registro{filtered.length !== 1 ? "s" : ""} visível
              {filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Frota</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Placa</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Modelo</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Completude</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">DUT</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">CRLV</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Atualização</TableHead>
              {canWrite ? <TableHead className="w-[120px] text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.id} className="transition-colors hover:bg-blue-50/40">
                <TableCell className="font-semibold text-slate-950">{doc.frota}</TableCell>
                <TableCell>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-slate-700">
                    {doc.placa}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-slate-700">{doc.modelo}</TableCell>
                <TableCell>
                  <CompletudeBar doc={doc} />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <DocumentActions signedUrl={doc.dut_signed_url} downloadUrl={doc.dut_download_url} label="DUT" />
                    <VencimentoLabel value={doc.dut_vencimento} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <DocumentActions signedUrl={doc.crlv_signed_url} downloadUrl={doc.crlv_download_url} label="CRLV" />
                    <VencimentoLabel value={doc.crlv_vencimento} placaParaCiclo={doc.placa} />
                    {doc.crlv_revisar_manualmente ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                        Revisar CRLV
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs tabular-nums text-slate-500">
                  {formatDate(doc.updated_at ?? doc.created_at)}
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <DocumentEditDialog document={doc} />
                      {isPendingDocument(doc) ? null : <DocumentDeleteDialog document={doc} />}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 8 : 7}
                  className="h-32 text-center text-sm text-slate-500"
                >
                  Nenhum documento encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>

      <section className="grid gap-3 md:hidden">
        {filtered.map((doc) => (
          <DocumentMobileCard key={doc.id} document={doc} canWrite={canWrite} />
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
            Nenhum documento encontrado com os filtros atuais.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CompletudeBar({ doc }: { doc: DocumentRecordWithSignedUrls }) {
  const has = (doc.dut_url ? 1 : 0) + (doc.crlv_url ? 1 : 0);
  const pct = (has / 2) * 100;
  const status = statusDoDoc(doc);
  const barTone = status === "COMPLETO" ? "emerald" : status === "PARCIAL" ? "amber" : "red";
  const label =
    status === "COMPLETO" ? "Completo" : status === "PARCIAL" ? "Parcial" : "Pendente";
  const labelColor =
    status === "COMPLETO" ? "text-emerald-700" : status === "PARCIAL" ? "text-amber-700" : "text-red-700";
  return (
    <div className="min-w-[120px] space-y-1">
      <div className="flex items-center justify-between text-[10.5px] font-semibold">
        <span className={labelColor}>{label}</span>
        <span className="tabular-nums text-slate-500">{has}/2</span>
      </div>
      <ProgressBar value={pct} tone={barTone} label={`Completude dos documentos: ${pct}%`} />
    </div>
  );
}

function DocumentUploadDialog() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createDocumentAction(formData);
      handleActionResult(result, {
        success: "Documento enviado",
        onSuccess: () => {
          formRef.current?.reset();
          setOpen(false);
          router.refresh();
        },
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" className="mt-5">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Enviar PDFs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo documento</DialogTitle>
          <DialogDescription>Envie os PDFs vinculados à frota.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={submit} className="grid gap-4 sm:grid-cols-2">
          <Field name="frota" label="Frota" placeholder="Ex: 1234" required />
          <Field name="placa" label="Placa" placeholder="ABC1D23" required />
          <div className="sm:col-span-2">
            <Field name="modelo" label="Modelo" placeholder="Modelo do veículo" required />
          </div>
          <FileField name="dut_file" label="DUT em PDF" />
          <Field name="dut_vencimento" label="Vencimento do DUT" type="date" />
          <FileField name="crlv_file" label="CRLV em PDF" />
          <Field name="crlv_vencimento" label="Vencimento do CRLV" type="date" />
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando..." : "Salvar documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentEditDialog({ document }: { document: DocumentRecordWithSignedUrls }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isPending = isPendingDocument(document);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = isPending
        ? await createDocumentAction(formData)
        : await updateDocumentAction(document.id, formData);
      handleActionResult(result, {
        success: isPending ? "Documento enviado" : "Documento atualizado",
        onSuccess: () => {
          formRef.current?.reset();
          setOpen(false);
          router.refresh();
        },
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={isPending ? "secondary" : "outline"}
          size={isPending ? "sm" : "icon"}
          aria-label={`${isPending ? "Enviar" : "Editar"} documentos da frota ${document.frota}`}
        >
          {isPending ? (
            <>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Enviar PDFs
            </>
          ) : (
            <Pencil className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isPending ? "Novo documento" : "Editar documento"}</DialogTitle>
          <DialogDescription>
            {isPending
              ? "Essa frota ainda não tem PDFs cadastrados."
              : "Envie um novo PDF apenas se quiser substituir o arquivo atual."}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={submit} className="grid gap-4 sm:grid-cols-2">
          <Field name="frota" label="Frota" defaultValue={document.frota} required />
          <Field name="placa" label="Placa" defaultValue={document.placa} required />
          <div className="sm:col-span-2">
            <Field name="modelo" label="Modelo" defaultValue={document.modelo} required />
          </div>
          <div className="space-y-1.5">
            <Label>DUT atual</Label>
            <DocumentActions signedUrl={document.dut_signed_url} downloadUrl={document.dut_download_url} label="DUT" />
          </div>
          <div className="space-y-1.5">
            <Label>CRLV atual</Label>
            <DocumentActions signedUrl={document.crlv_signed_url} downloadUrl={document.crlv_download_url} label="CRLV" />
          </div>
          <FileField name="dut_file" label="Substituir DUT" />
          <Field name="dut_vencimento" label="Vencimento do DUT" type="date" defaultValue={document.dut_vencimento ?? ""} />
          <FileField name="crlv_file" label="Substituir CRLV" />
          <Field name="crlv_vencimento" label="Vencimento do CRLV" type="date" defaultValue={document.crlv_vencimento ?? ""} />
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDeleteDialog({ document }: { document: DocumentRecordWithSignedUrls }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await deleteDocumentAction(document.id);
      handleActionResult(result, {
        success: "Documento excluído",
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="icon" aria-label={`Excluir documentos da frota ${document.frota}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir documento?</DialogTitle>
          <DialogDescription>
            A frota {document.frota} terá o registro e os PDFs vinculados removidos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={submit}>
            {pending ? "Excluindo..." : "Confirmar exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentMobileCard({
  document,
  canWrite,
}: {
  document: DocumentRecordWithSignedUrls;
  canWrite: boolean;
}) {
  const status = statusDoDoc(document);
  const borderColor =
    status === "COMPLETO"
      ? "border-l-emerald-500"
      : status === "PARCIAL"
        ? "border-l-amber-500"
        : "border-l-red-500";
  return (
    <article
      className={cn(
        "rounded-xl border border-l-4 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]",
        borderColor
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-950">Frota {document.frota}</h3>
          <p className="mt-0.5 flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-700">
              {document.placa}
            </span>
            <span className="truncate text-xs text-slate-500">{document.modelo}</span>
          </p>
        </div>
        <DocumentStatus doc={document} />
      </div>

      <div className="mt-3">
        <CompletudeBar doc={document} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <DocumentActions signedUrl={document.dut_signed_url} downloadUrl={document.dut_download_url} label="DUT" />
          <VencimentoLabel value={document.dut_vencimento} />
        </div>
        <div className="space-y-1">
          <DocumentActions signedUrl={document.crlv_signed_url} downloadUrl={document.crlv_download_url} label="CRLV" />
          <VencimentoLabel value={document.crlv_vencimento} placaParaCiclo={document.placa} />
          {document.crlv_revisar_manualmente ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
              Revisar CRLV
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Atualizado em {formatDate(document.updated_at ?? document.created_at)}
      </div>
      {canWrite ? (
        <div className="mt-3 flex justify-end gap-1">
          <DocumentEditDialog document={document} />
          {isPendingDocument(document) ? null : <DocumentDeleteDialog document={document} />}
        </div>
      ) : null}
    </article>
  );
}

function DocumentActions({
  signedUrl,
  downloadUrl,
  label,
}: {
  signedUrl: string | null;
  downloadUrl: string | null;
  label: string;
}) {
  if (!signedUrl || !downloadUrl) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
        <FileX2 className="h-3 w-3" aria-hidden="true" />
        Sem {label}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-blue-50/60 p-0.5 ring-1 ring-inset ring-blue-100">
      <DocumentPreviewDialog signedUrl={signedUrl} downloadUrl={downloadUrl} label={label} />
      <a
        href={downloadUrl}
        download
        aria-label={`Baixar ${label}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-700 transition-colors hover:bg-white"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}

function diasAteVencimento(value: string): number {
  return (new Date(`${value}T00:00:00`).getTime() - Date.now()) / 86400000;
}

function VencimentoLabel({
  value,
  placaParaCiclo,
}: {
  value: string | null | undefined;
  /** Placa usada pra estimar o mês de renovação (CONTRAN) quando ainda não há data lida — só faz sentido pro CRLV. */
  placaParaCiclo?: string | null;
}) {
  if (!value) {
    const ciclo = placaParaCiclo ? cicloRenovacaoPorPlaca(placaParaCiclo) : null;
    if (ciclo) {
      const toneClass =
        ciclo.tone === "critico" ? "text-red-600" : ciclo.tone === "atencao" ? "text-amber-600" : "text-slate-400";
      return <span className={cn("block text-[10px] font-medium", toneClass)}>{ciclo.texto}</span>;
    }
    return <span className="block text-[10px] text-slate-400">Sem vencimento</span>;
  }
  const dias = diasAteVencimento(value);
  const tone = dias < 0 ? "text-red-600" : dias < 30 ? "text-amber-600" : "text-slate-500";
  const label = dias < 0 ? "Vencido" : dias < 30 ? "Vence em breve" : "Em dia";
  return (
    <span className={cn("block text-[10px] font-medium tabular-nums", tone)}>
      {formatDateOnly(value)} · {label}
    </span>
  );
}

function DocumentStatus({ doc }: { doc: DocumentRecordWithSignedUrls }) {
  const s = statusDoDoc(doc);
  if (s === "COMPLETO") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Completo
      </span>
    );
  }
  if (s === "PARCIAL") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-200">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Pendente
    </span>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  required,
  type,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required} />
    </div>
  );
}

function FileField({ name, label }: { name: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="file" accept="application/pdf,.pdf" />
    </div>
  );
}

function handleActionResult(
  result: DocumentActionResult,
  options: { success: string; onSuccess: () => void }
) {
  if (result.ok) {
    toast.success(options.success);
    options.onSuccess();
  } else {
    toast.error(result.error);
  }
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "--";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}
