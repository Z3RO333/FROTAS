import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { UserMenu } from "@/components/user-menu";
import { MobileNav } from "@/components/mobile-nav";
import { OnlineStatus } from "@/components/online-status";
import { navigationForProfile } from "@/lib/navigation-config";
import { type PerfilUsuario } from "@/lib/rbac";

export function AppShell({
  email,
  name,
  perfil,
  children,
}: {
  email: string;
  name: string;
  perfil: PerfilUsuario;
  children: React.ReactNode;
}) {
  const sections = navigationForProfile(perfil);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip text-foreground lg:grid lg:grid-cols-[auto_minmax(0,1fr)] bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.06),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(15,23,42,0.05),_transparent_50%)] bg-slate-50">
      {/* A barra lateral pertence exclusivamente ao layout desktop. No mobile,
          o MobileNav fornece a mesma navegação sem duplicar altura/conteúdo. */}
      <div className="hidden shrink-0 lg:block">
        <AppSidebar sections={sections} perfil={perfil} />
      </div>

      <div className="flex w-full min-w-0 max-w-full flex-col">
        <header className="sticky top-0 z-30 flex min-h-12 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md lg:min-h-14 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            {/* Hamburger só no mobile */}
            <MobileNav sections={sections} perfil={perfil} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 lg:text-[11px]">
                Frotas Bemol
              </p>
              <div className="hidden md:block">
                <BreadcrumbNav sections={sections} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <OnlineStatus />
            <UserMenu email={email} name={name} />
          </div>
        </header>
        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
