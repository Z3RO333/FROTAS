"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/components/app-sidebar";

const NAV_ICONS_MAP: Record<string, string> = {};

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
        className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer lateral */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header do drawer */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <p className="text-sm font-bold text-white">FROTAS BEMOL</p>
            <p className="text-[11px] text-slate-400">{perfil}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
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
              <div key={section.title} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    {section.title}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-slate-600 transition-transform",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex h-9 items-center rounded-lg px-3 text-[13px] font-medium transition-colors",
                            active
                              ? "bg-blue-500/15 text-white ring-1 ring-inset ring-blue-400/20"
                              : "text-slate-400 hover:bg-white/8 hover:text-white"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}

                <div className="my-2 border-t border-white/[0.06]" />
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
