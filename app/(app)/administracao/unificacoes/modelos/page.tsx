import { ModelosFrotaList } from "@/components/administracao/modelos-frota-list";
import { listModelosFrotaComContagem } from "@/lib/repos/modelos-frota";

export const dynamic = "force-dynamic";

export default async function ModelosPage() {
  const modelos = await listModelosFrotaComContagem();
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b px-5 py-4"><h2 className="font-semibold text-slate-950">Modelos de frota</h2><p className="mt-1 text-sm text-muted-foreground">Padronize nomes diferentes usados para o mesmo modelo de veículo.</p></div>
      <div className="border-b px-5 py-3 text-sm text-muted-foreground">{modelos.length} modelo(s) em veículos ativos, ocultos e vendidos.</div>
      {modelos.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum modelo cadastrado.</p> : <ModelosFrotaList modelos={modelos} />}
    </section>
  );
}
