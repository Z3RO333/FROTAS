"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Battery, Droplets, LayoutGrid, MapPin, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SERVICE_CATALOG } from "@/lib/manutencao-service-catalog";
import { cn } from "@/lib/utils";

const SERVICE_LINKS: Array<{ href: string; label: string; icon?: LucideIcon }> = [
  { href: "/planejamento/lavagem", label: "Lavagem", icon: Droplets },
  { href: "/planejamento/bateria", label: "Bateria", icon: Battery },
  { href: "/planejamento/seguranca", label: "Kit Segurança", icon: ShieldAlert },
  { href: "/oficinas", label: "Oficinas", icon: MapPin },
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
        <h2 className="text-base font-semibold text-slate-950">Serviços e oficinas</h2>
        <p className="text-sm text-slate-500">Consulte os serviços, o kit de segurança e as oficinas da frota.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SERVICE_LINKS.map((service) => (
          <Link key={service.href} href={service.href} className="group flex items-center justify-between rounded-lg border bg-white p-3 text-sm font-medium shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50">
            <span className="flex items-center gap-2">{service.icon ? <service.icon className="h-4 w-4 text-blue-600" /> : null}{service.label}</span>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
