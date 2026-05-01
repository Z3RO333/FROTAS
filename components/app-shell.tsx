import Link from "next/link";
import { LayoutDashboard, List, ShoppingCart, Truck } from "lucide-react";
import { UserMenu } from "@/components/user-menu";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/frotas", label: "Frotas", icon: List },
  { href: "/frotas/vendidos", label: "Vendidos", icon: ShoppingCart },
];

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b bg-primary text-primary-foreground lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
            <Truck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="font-semibold">Frotas Bemol</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-primary-foreground/90 hover:bg-white/10 hover:text-primary-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-end border-b bg-background px-4 lg:px-6">
          <UserMenu email={email} />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
