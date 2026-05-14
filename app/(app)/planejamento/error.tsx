"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlanejamentoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[planejamento] error boundary", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-red-900">
            Falha ao carregar dados de planejamento
          </h2>
          <p className="text-xs text-red-700">
            Pode ser indisponibilidade temporária do Supabase ou ETL incompleto.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-red-500">ref: {error.digest}</p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}
