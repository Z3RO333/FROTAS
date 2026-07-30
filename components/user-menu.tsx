"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function UserMenu({ email, name }: { email: string; name: string }) {
  async function handleSignOut() {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("frotas-")).map((key) => caches.delete(key)));
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <div className="min-w-0 max-w-24 text-right sm:max-w-64">
        <div className="truncate text-sm font-medium leading-5">{name}</div>
        <div className="hidden truncate text-xs text-muted-foreground md:block">{email}</div>
      </div>
      <Button
        aria-label="Sair"
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
