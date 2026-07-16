"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] error boundary", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md space-y-4 rounded-lg border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
          <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Algo deu errado</h2>
          <p className="text-sm text-muted-foreground">
            Não conseguimos carregar essa página. Tente novamente ou volte para o início.
          </p>
        </div>
        {error.digest && (
          <p className="text-[10px] font-mono text-slate-400">ref: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => reset()}>
            <RotateCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
          <Button type="button" asChild>
            <Link href="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
