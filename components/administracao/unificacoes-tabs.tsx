"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/administracao/unificacoes/setores", label: "Setores" },
  { href: "/administracao/unificacoes/modelos", label: "Modelos de frota" },
] as const;

export function UnificacoesTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-slate-200" aria-label="Tipos de unificação">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
            className={cn("border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", active ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
