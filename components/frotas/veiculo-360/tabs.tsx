"use client";

import { type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  FileText,
  Fuel,
  History,
  LayoutDashboard,
  Truck,
  Wrench,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

const TAB_ICONS = {
  LayoutDashboard,
  Wrench,
  Truck,
  FileText,
  ClipboardCheck,
  Fuel,
  History,
} as const;

export type TabIconName = keyof typeof TAB_ICONS;

export type TabDef = {
  id: string;
  label: string;
  content: ReactNode;
  icon?: TabIconName;
  /** Contador opcional ao lado do label (ex: pendências, eventos). */
  count?: number | null;
};

export function VeiculoTabs({ tabs }: { tabs: TabDef[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Aba compartilhável/recarregável via URL — ausência de ?tab= (ou valor
  // inválido) cai na primeira aba, mantendo links antigos sem ?tab= válidos.
  const tabParam = searchParams.get("tab");
  const active = tabs.find((t) => t.id === tabParam)?.id ?? tabs[0]?.id ?? "";
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  function selectTab(id: string) {
    if (id === active) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    // replaceState (não pushState) — trocar de aba não deve empilhar o Back;
    // usePathname/useSearchParams ficam sincronizados sem recarregar a rota.
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/80 bg-white/80 p-1.5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] backdrop-blur-sm">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === active;
            const Icon: ComponentType<LucideProps> | null = tab.icon ? TAB_ICONS[tab.icon] : null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={cn(
                  "group relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-[0_2px_8px_-2px_rgba(59,130,246,0.45)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"
                    )}
                    aria-hidden="true"
                  />
                )}
                <span>{tab.label}</span>
                {tab.count != null && tab.count > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                      isActive ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      <div>{activeTab?.content}</div>
    </div>
  );
}
