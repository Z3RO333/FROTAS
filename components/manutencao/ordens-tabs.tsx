"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/manutencao/ordens", label: "Ordens" },
  { href: "/manutencao/ordens/custos", label: "Custos" },
] as const;

export function OrdensTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-slate-200" aria-label="Seções de Ordens">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            )}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
