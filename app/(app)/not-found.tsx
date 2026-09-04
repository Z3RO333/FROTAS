import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <SearchX className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Página não encontrada</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-950">Esse conteúdo não está disponível</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          O endereço pode ter mudado ou você pode não ter acesso a esse registro.
        </p>
        <Button asChild className="mt-5">
          <Link href="/">
            <ArrowLeft aria-hidden="true" /> Voltar à visão geral
          </Link>
        </Button>
      </div>
    </div>
  );
}
