"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Pencil,
  Search,
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
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DocumentRecordWithSignedUrls } from "@/lib/repos/manutencao/types";

type Props = {
  documents: DocumentRecordWithSignedUrls[];
  total: number;
  canWrite: boolean;
};

export function DocumentosWorkspace({ documents, total, canWrite }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = normalizeSearch(query);
    if (!term) return documents;
    return documents.filter((doc) => {
      const haystack = normalizeSearch(`${doc.frota} ${doc.placa} ${doc.modelo}`);
      return haystack.includes(term);
    });
  }, [documents, query]);

  const complete = documents.filter((doc) => doc.dut_url && doc.crlv_url).length;
  const partial = documents.filter((doc) => (doc.dut_url || doc.crlv_url) && !(doc.dut_url && doc.crlv_url)).length;
  const pending = documents.filter((doc) => !doc.dut_url && !doc.crlv_url).length;
  const files = documents.reduce((sum, doc) => sum + (doc.dut_url ? 1 : 0) + (doc.crlv_url ? 1 : 0), 0);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[420px_1fr]">
          <div className="bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">Documentos</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Central documental</h1>
            <p className="mt-3 text-sm text-slate-300">
              Consulte DUT e CRLV, envie PDFs para Storage privado e abra arquivos sensiveis por URL assinada.
            </p>
            {canWrite ? <DocumentUploadDialog /> : null}
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={FileText} label="Registros" value={String(total)} />
            <Metric icon={FileCheck2} label="Arquivos" value={String(files)} />
            <Metric icon={ShieldCheck} label="Completos" value={String(complete)} />
            <Metric icon={FileText} label="Pendentes" value={String(pending + partial)} tone="amber" />
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar em tempo real por frota, placa ou modelo"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <StatusPill label="Completos" value={complete} tone="green" />
            <StatusPill label="Parciais" value={partial} tone="amber" />
            <StatusPill label="Pendentes" value={pending} tone="slate" />
          </div>
        </div>
      </section>

      <section className="hidden overflow-hidden rounded-md border bg-white shadow-sm md:block">
        <div className="border-b bg-slate-50 px-4 py-3">
          <h2 className="font-semibold text-slate-950">Resultado da consulta</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""} visivel{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Frota</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>DUT</TableHead>
              <TableHead>CRLV</TableHead>
              <TableHead>Atualizacao</TableHead>
              {canWrite ? <TableHead className="w-[150px] text-right">Acoes</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-semibold text-slate-950">{doc.frota}</TableCell>
                <TableCell className="font-mono uppercase">{doc.placa}</TableCell>
                <TableCell>{doc.modelo}</TableCell>
                <TableCell>
                  <DocumentStatus doc={doc} />
                </TableCell>
                <TableCell>
                  <DocumentActions signedUrl={doc.dut_signed_url} label="DUT" />
                </TableCell>
                <TableCell>
                  <DocumentActions signedUrl={doc.crlv_signed_url} label="CRLV" />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(doc.updated_at ?? doc.created_at)}</TableCell>
                {canWrite ? (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <DocumentEditDialog document={doc} />
                      <DocumentDeleteDialog document={doc} />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 8 : 7} className="h-32 text-center text-muted-foreground">
                  Nenhum documento encontrado.
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
          <div className="rounded-md border bg-white p-5 text-sm text-muted-foreground">
            Nenhum documento encontrado.
          </div>
        ) : null}
      </section>
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
          <DialogDescription>DUT e CRLV ficam no bucket privado e sao gravados como caminhos de Storage.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={submit} className="grid gap-4 sm:grid-cols-2">
          <Field name="frota" label="Frota" placeholder="Ex: 1234" required />
          <Field name="placa" label="Placa" placeholder="ABC1D23" required />
          <div className="sm:col-span-2">
            <Field name="modelo" label="Modelo" placeholder="Modelo do veiculo" required />
          </div>
          <FileField name="dut_file" label="DUT em PDF" />
          <FileField name="crlv_file" label="CRLV em PDF" />
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

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateDocumentAction(document.id, formData);
      handleActionResult(result, {
        success: "Documento atualizado",
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
        <Button type="button" variant="outline" size="icon" aria-label={`Editar documentos da frota ${document.frota}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
          <DialogDescription>Envie um novo PDF apenas se quiser substituir o arquivo atual.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={submit} className="grid gap-4 sm:grid-cols-2">
          <Field name="frota" label="Frota" defaultValue={document.frota} required />
          <Field name="placa" label="Placa" defaultValue={document.placa} required />
          <div className="sm:col-span-2">
            <Field name="modelo" label="Modelo" defaultValue={document.modelo} required />
          </div>
          <FileField name="dut_file" label="Substituir DUT" />
          <FileField name="crlv_file" label="Substituir CRLV" />
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alteracoes"}
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
        success: "Documento excluido",
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
            A frota {document.frota} tera o registro removido e os PDFs vinculados serao apagados do Storage privado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={submit}>
            {pending ? "Excluindo..." : "Confirmar exclusao"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentMobileCard({ document, canWrite }: { document: DocumentRecordWithSignedUrls; canWrite: boolean }) {
  return (
    <article className="rounded-md border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">Frota {document.frota}</h3>
          <p className="font-mono text-sm uppercase text-muted-foreground">{document.placa}</p>
        </div>
        <DocumentStatus doc={document} />
      </div>
      <p className="mt-2 text-sm text-slate-700">{document.modelo}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DocumentActions signedUrl={document.dut_signed_url} label="DUT" />
        <DocumentActions signedUrl={document.crlv_signed_url} label="CRLV" />
      </div>
      <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        Atualizado em {formatDate(document.updated_at ?? document.created_at)}
      </div>
      {canWrite ? (
        <div className="mt-3 flex justify-end gap-2">
          <DocumentEditDialog document={document} />
          <DocumentDeleteDialog document={document} />
        </div>
      ) : null}
    </article>
  );
}

function DocumentActions({ signedUrl, label }: { signedUrl: string | null; label: string }) {
  if (!signedUrl) return <span className="text-xs text-muted-foreground">Indisponivel</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button asChild variant="outline" size="sm">
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </a>
      </Button>
      <Button asChild variant="ghost" size="icon" aria-label={`Baixar ${label}`}>
        <a href={signedUrl} download>
          <Download className="h-4 w-4" aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

function DocumentStatus({ doc }: { doc: DocumentRecordWithSignedUrls }) {
  if (doc.dut_url && doc.crlv_url) {
    return <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">Completo</Badge>;
  }
  if (doc.dut_url || doc.crlv_url) {
    return <Badge className="border-transparent bg-amber-500 text-white hover:bg-amber-500">Parcial</Badge>;
  }
  return <Badge variant="outline">Pendente</Badge>;
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "blue",
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone?: "blue" | "amber";
}) {
  return (
    <div className="rounded-md border bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <Icon className={tone === "amber" ? "h-4 w-4 text-amber-600" : "h-4 w-4 text-blue-700"} aria-hidden="true" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "slate" }) {
  const className =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return <span className={`rounded-full border px-3 py-1 font-medium ${className}`}>{label}: {value}</span>;
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} defaultValue={defaultValue} required={required} />
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
