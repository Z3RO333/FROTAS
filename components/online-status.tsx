"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ConnectionState = "checking" | "online" | "offline" | "unavailable";

export function OnlineStatus({ variant = "header" }: { variant?: "header" | "login" }) {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    const check = async () => {
      if (!navigator.onLine) {
        if (active) setState("offline");
        return;
      }

      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 5_000);
      try {
        const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
        if (active) setState(response.ok ? "online" : "unavailable");
      } catch {
        if (active) setState(navigator.onLine ? "unavailable" : "offline");
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const handleOffline = () => setState("offline");
    const handleOnline = () => void check();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    const interval = window.setInterval(check, 60_000);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const label =
    state === "online"
      ? "Sistema online"
      : state === "offline"
        ? "Sem internet"
        : state === "unavailable"
          ? "Servidor indisponível"
          : "Verificando sistema";

  if (variant === "login") {
    return (
      <span className="login-badge" data-status={state} role="status" aria-live="polite">
        <span className="login-badge-dot" />
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        state === "online" && "hidden bg-emerald-50 text-emerald-700 ring-emerald-200 lg:inline-flex",
        state === "checking" && "hidden bg-slate-50 text-slate-600 ring-slate-200 lg:inline-flex",
        state === "offline" && "inline-flex bg-amber-50 text-amber-800 ring-amber-200",
        state === "unavailable" && "inline-flex bg-red-50 text-red-700 ring-red-200"
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "online" && "bg-emerald-500",
          state === "checking" && "animate-pulse bg-slate-400",
          state === "offline" && "bg-amber-500",
          state === "unavailable" && "bg-red-500"
        )}
      />
      {label}
    </span>
  );
}
