"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ModeloFrotaRenameRow } from "@/components/administracao/modelo-frota-rename-row";
import { Input } from "@/components/ui/input";
import type { ModeloFrotaComContagem } from "@/lib/repos/modelos-frota";

export function ModelosFrotaList({ modelos }: { modelos: ModeloFrotaComContagem[] }) {
  const [busca, setBusca] = useState("");
  const nomes = useMemo(() => modelos.map((item) => item.modelo), [modelos]);
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return termo ? modelos.filter((item) => item.modelo.toLocaleLowerCase("pt-BR").includes(termo)) : modelos;
  }, [busca, modelos]);

  return <>
    <div className="border-b px-5 py-3">
      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <span className="sr-only">Buscar modelo</span>
        <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar modelo..." className="pl-9" />
      </label>
      {busca && <p className="mt-2 text-xs text-muted-foreground">{filtrados.length} de {modelos.length} modelos exibidos</p>}
    </div>
    {filtrados.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum modelo encontrado.</p> : (
      <div className="overflow-x-auto px-5 py-2"><table className="w-full text-sm"><thead><tr className="border-b text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="py-2 pr-4 text-left">Modelo atual</th><th className="py-2 pr-4 text-right">Frotas</th><th className="py-2 text-right">Ação</th></tr></thead><tbody>{filtrados.map(({ modelo, total }) => <ModeloFrotaRenameRow key={modelo} modelo={modelo} total={total} modelos={nomes} />)}</tbody></table></div>
    )}
  </>;
}
