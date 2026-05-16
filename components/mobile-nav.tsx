"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  ChevronDown,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Gauge,
  History,
  Home,
  LayoutDashboard,
  List,
  MapPin,
  Menu,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { NavIconName, NavSection } from "@/components/app-sidebar";

const NAV_ICONS: Record<NavIconName, ComponentType<LucideProps>> = {
  AlertTriangle,
  BarChart2,
  Building2,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Gauge,
  History,
  Home,
  LayoutDashboard,
  List,
  MapPin,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
};

export function MobileNav({
  sections,
  perfil,
}: {
  sections: NavSection[];
  perfil: string;
}) {
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Botão hamburger — só aparece no mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer lateral */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col text-white shadow-2xl transition-transform duration-200 lg:hidden",
          "bg-[linear-gradient(180deg,#0b1220_0%,#070d18_60%,#050913_100%)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header do drawer */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-bold tracking-wide text-white">FROTAS BEMOL</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 ring-1 ring-inset ring-white/10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10.5px] font-semibold tracking-wide text-slate-200">{perfil}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => {
            const isOpen = openSections[section.title] !== false;
            return (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="group mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 group-hover:text-slate-400">
                    {section.title}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-slate-600 transition-transform group-hover:text-slate-400",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = NAV_ICONS[item.icon];
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "group relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-400 transition-all duration-150",
                            "hover:bg-white/[0.06] hover:text-white",
                            active &&
                              "bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.18)]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all duration-150",
                              active
                                ? "bg-gradient-to-b from-blue-400 to-sky-500 opacity-100 shadow-[0_0_8px_rgba(96,165,250,0.65)]"
                                : "opacity-0"
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                              active
                                ? "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/20"
                                : "text-slate-500"
                            )}
                          >
                            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                <div
                  className="my-2.5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
