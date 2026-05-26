"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ClipboardCheck, Home, List, ShieldAlert } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
  primary?: boolean;
};

const ITEMS: Item[] = [
  { href: "/motorista", label: "Início", icon: Home },
  { href: "/motorista/checklist", label: "Checklist", icon: ClipboardCheck, primary: true },
  { href: "/motorista/sinistro", label: "Sinistro", icon: AlertTriangle, primary: true },
  { href: "/motorista/checklists", label: "Histórico", icon: List },
  { href: "/motorista/sinistros", label: "Sinistros", icon: ShieldAlert },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/motorista") return pathname === "/motorista";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MotoristaBottomBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Spacer para não tampar conteúdo no mobile */}
      <div aria-hidden="true" className="h-20 lg:hidden" />

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 backdrop-blur-md lg:hidden",
          "shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]"
        )}
        aria-label="Navegação do motorista"
      >
        <ul className="grid grid-cols-5 gap-1 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const isPrimary = item.primary;
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all duration-150",
                    !isPrimary &&
                      cn(
                        "text-slate-500 hover:bg-slate-50",
                        active && "text-blue-700"
                      ),
                    isPrimary &&
                      cn(
                        "-mt-6 h-14 w-14 self-center rounded-full text-white shadow-[0_12px_24px_-8px_rgba(59,130,246,0.55)] ring-4 ring-white",
                        "bg-gradient-to-br from-blue-500 to-sky-600 hover:from-blue-500 hover:to-sky-700",
                        active && "from-blue-600 to-sky-700"
                      )
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn(isPrimary ? "h-5 w-5" : "h-5 w-5")} aria-hidden="true" />
                  {!isPrimary && (
                    <span
                      className={cn(
                        "text-[10.5px] font-medium",
                        active && "font-semibold"
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                  {!isPrimary && active && (
                    <span
                      className="pointer-events-none absolute inset-x-3 top-0 h-[2px] rounded-b-full bg-gradient-to-r from-blue-400 to-sky-500"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
