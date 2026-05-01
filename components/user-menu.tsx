"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function UserMenu({ email }: { email: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="hidden max-w-64 truncate text-sm text-muted-foreground sm:inline">{email}</span>
      <Button
        aria-label="Sair"
        variant="ghost"
        size="icon"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
