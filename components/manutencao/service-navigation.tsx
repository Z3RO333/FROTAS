"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Battery, Droplets, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SERVICE_CATALOG } from "@/lib/manutencao-service-catalog";
import { cn } from "@/lib/utils";

const SERVICE_LINKS: Array<{ href: string; label: string; icon?: LucideIcon }> = [
  { href: "/planejamento/lavagem", label: "Lavagem", icon: Droplets },
  { href: "/planejamento/bateria", label: "Bateria", icon: Battery },
  ...SERVICE_CATALOG.map((service) => ({
    href: `/planejamento/manutencao/${service.slug}`,
    label: service.label,
  })),
];

export function ServiceNavigation({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  if (compact) {
    return (
      <nav aria-label="Navegação entre serviços" className="rounded-xl border bg-white p-2 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Link
            href="/planejamento/manutencao"
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
              pathname === "/planejamento/manutencao"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            )}
          >
            <LayoutGrid className="h-4 w-4" /> Todos
          </Link>
          {SERVICE_LINKS.map((service) => {
            const active = pathname === service.href;
            return (
              <Link
                key={service.href}
                href={service.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )}
              >
                {service.icon ? <service.icon className="h-4 w-4" /> : null}
                {service.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

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
        <Link href="/planejamento/bateria" className="group flex items-center justify-between rounded-lg border bg-white p-3 text-sm font-medium shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50">
          <span className="flex items-center gap-2"><Battery className="h-4 w-4 text-amber-600" />Bateria</span>
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
