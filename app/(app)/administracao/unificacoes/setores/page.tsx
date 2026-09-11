import { SetorRenameRow } from "@/components/administracao/setor-rename-row";
import { listSetoresComContagem } from "@/lib/repos/setores";

export const dynamic = "force-dynamic";

export default async function SetoresPage() {
  const setores = await listSetoresComContagem();
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold text-slate-950">Setores</h2>
        <p className="mt-1 text-sm text-muted-foreground">Unifique grafias diferentes do mesmo setor. A troca também atualiza as agendas de e-mail vinculadas.</p>
      </div>
      <div className="border-b px-5 py-3 text-sm text-muted-foreground">{setores.length} setor(es) em veículos ativos, ocultos e vendidos.</div>
      {setores.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum setor cadastrado.</p> : (
        <div className="overflow-x-auto px-5 py-2"><table className="w-full text-sm"><thead><tr className="border-b text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="py-2 pr-4 text-left">Setor</th><th className="py-2 pr-4 text-right">Frotas</th><th className="py-2 text-right">Ação</th></tr></thead><tbody>{setores.map(({ setor, total }) => <SetorRenameRow key={setor} setor={setor} total={total} />)}</tbody></table></div>
      )}
    </section>
  );
}
