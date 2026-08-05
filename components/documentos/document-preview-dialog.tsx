"use client";

import { Download, ExternalLink, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DocumentPreviewDialog({
  signedUrl,
  downloadUrl,
  label,
}: {
  signedUrl: string;
  downloadUrl: string;
  label: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-white"
          aria-label={`Visualizar ${label}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="grid h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[92dvh] sm:w-[94vw] sm:max-w-6xl sm:rounded-xl sm:border">
        <DialogHeader className="border-b bg-white px-4 py-3 pr-12 text-left sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-700" aria-hidden="true" />
            Visualizar {label}
          </DialogTitle>
          <DialogDescription>
            Consulte o documento sem precisar salvá-lo no dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 bg-slate-200">
          <iframe
            src={`${signedUrl}#view=FitH&toolbar=1&navpanes=0`}
            title={`Documento ${label}`}
            className="h-full w-full border-0 bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-white px-3 py-2 sm:px-5">
          <p className="text-[11px] text-slate-500">
            Se o aparelho não renderizar o PDF, use “Abrir em nova aba”.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Abrir em nova aba
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download aria-label={`Baixar ${label}`}>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Baixar</span>
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
