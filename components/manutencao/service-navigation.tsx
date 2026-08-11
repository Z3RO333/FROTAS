import Link from "next/link";
import { ArrowRight, Droplets } from "lucide-react";
import { SERVICE_CATALOG } from "@/lib/manutencao-service-catalog";

export function ServiceNavigation() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-950">Serviços separados por página</h2>
        <p className="text-sm text-slate-500">Abra o serviço para registrar e consultar somente o histórico dele.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Link href="/planejamento/lavagem" className="group flex items-center justify-between rounded-lg border bg-white p-3 text-sm font-medium shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50">
          <span className="flex items-center gap-2"><Droplets className="h-4 w-4 text-blue-600" />Lavagem</span>
          <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {SERVICE_CATALOG.map((service) => (
          <Link key={service.slug} href={`/planejamento/manutencao/${service.slug}`} className="group flex items-center justify-between rounded-lg border bg-white p-3 text-sm font-medium shadow-sm transition hover:border-violet-300 hover:bg-violet-50/50">
            <span>{service.label}</span>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
