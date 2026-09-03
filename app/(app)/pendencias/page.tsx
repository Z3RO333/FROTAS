import { ShieldAlert } from "lucide-react";
import { listOpenPendencias } from "@/lib/repos/checklists";
import { requireAdminUser } from "@/lib/rbac";
import { PendenciasWorkspace } from "@/components/pendencias/pendencias-workspace";

export const dynamic = "force-dynamic";

export default async function PendenciasPage() {
  await requireAdminUser();
  const rows = await listOpenPendencias(200);

  return (
    <div className="space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-blue-700" />
        <div className="flex items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 sm:flex">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Central de alertas</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Pendências e não conformidades</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Acompanhe ocorrências abertas e escolha a ação operacional adequada para cada frota.</p>
          </div>
        </div>
      </div>

      <PendenciasWorkspace rows={rows} />
    </div>
  );
}
