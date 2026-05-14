"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabDef = {
  id: string;
  label: string;
  content: ReactNode;
};

export function VeiculoTabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
                isActive ? "text-blue-700" : "text-muted-foreground hover:text-slate-900"
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-blue-600" />
              )}
            </button>
          );
        })}
      </nav>
      <div>{activeTab?.content}</div>
    </div>
  );
}
