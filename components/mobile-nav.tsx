"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
  PackageSearch,
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
import { findActiveHref, isActivePath, type NavIconName, type NavSection } from "@/components/app-sidebar";

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
  PackageSearch,
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
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname, sections);
  const activeSectionTitle = sections.find((s) => s.items.some((i) => i.href === activeHref))?.title;
  // Só a seção com a rota ativa começa aberta — o resto fica um toque de distância.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map((s) => [s.title, s.title === activeSectionTitle]))
  );

  useEffect(() => {
    if (!activeSectionTitle) return;
    setOpenSections((prev) => (prev[activeSectionTitle] ? prev : { ...prev, [activeSectionTitle]: true }));
  }, [activeSectionTitle]);

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  function isActive(href: string) {
    return isActivePath(pathname, href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col text-white shadow-2xl outline-none lg:hidden",
            "bg-[linear-gradient(180deg,#0b1220_0%,#070d18_60%,#050913_100%)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          )}
        >
        {/* Header do drawer */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-sm font-bold tracking-wide text-white">
              FROTAS BEMOL
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Menu principal do sistema de frotas
            </DialogPrimitive.Description>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 ring-1 ring-inset ring-white/10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[10.5px] font-semibold tracking-wide text-slate-200">{perfil}</span>
            </span>
          </div>
          <DialogPrimitive.Close className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" aria-label="Fechar menu">
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" aria-label="Menu principal">
          {sections.map((section) => {
            const isOpen = openSections[section.title] !== false;
            return (
              <div key={section.title}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="group mb-1 flex min-h-11 w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  aria-expanded={isOpen}
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
                            "group relative flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
                            "hover:bg-white/[0.06] hover:text-white",
                            active &&
                              "bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.18)]"
                          )}
                          aria-current={active ? "page" : undefined}
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
