"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/planejamento", label: "Visão Geral", exact: true },
  { href: "/planejamento/paradas", label: "Frotas Paradas" },
  { href: "/planejamento/manutencao", label: "Manutenção" },
  { href: "/planejamento/documentos", label: "Documentos" },
  { href: "/planejamento/disponibilidade", label: "Disponibilidade" },
  { href: "/planejamento/pneus", label: "Pneus" },
  { href: "/planejamento/lavagem", label: "Lavagem" },
  { href: "/planejamento/seguranca", label: "Kit Segurança" },
  { href: "/planejamento/bateria", label: "Bateria" },
  { href: "/planejamento/estepes", label: "Estepes" },
];

export function PlanejamentoTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "text-blue-700"
                : "text-muted-foreground hover:text-slate-900"
            )}
          >
            {tab.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-blue-600" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
