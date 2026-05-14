import Link from "next/link";
import type { ElementType } from "react";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Gauge,
  Home,
  LayoutDashboard,
  List,
  MapPin,
  Settings,
  ShoppingCart,
  Truck,
  Wrench,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import {
  canAccessDocumentos,
  canAccessManutencao,
  canAccessOperacao,
  type PerfilUsuario,
} from "@/lib/rbac";

type NavItem = { href: string; label: string; icon: ElementType };

const BASE_ADMIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/frotas", label: "Frotas", icon: List },
  { href: "/checklists", label: "Checklists", icon: ClipboardCheck },
  { href: "/checklists/validacao-km", label: "Validar KM", icon: Gauge },
  { href: "/pendencias", label: "Pendências", icon: AlertTriangle },
  { href: "/unidades", label: "Unidades", icon: Building2 },
  { href: "/portaria", label: "Portaria", icon: DoorOpen },
  { href: "/frotas/vendidos", label: "Vendidos", icon: ShoppingCart },
];

const MANUTENCAO_NAV: NavItem[] = [
  { href: "/pneus", label: "Pneus", icon: Truck },
  { href: "/manutencao", label: "Serviços", icon: Wrench },
  { href: "/equipamentos", label: "Equipamentos", icon: Settings },
  { href: "/oficinas", label: "Oficinas", icon: MapPin },
];

const OPERACAO_NAV: NavItem[] = [{ href: "/operacao", label: "Operação", icon: Gauge }];
const DOCUMENTOS_NAV: NavItem[] = [{ href: "/documentos", label: "Documentos", icon: FileText }];

const MOTORISTA_NAV: NavItem[] = [
  { href: "/motorista", label: "Início", icon: Home },
  { href: "/motorista/checklist", label: "Fazer checklist", icon: ClipboardCheck },
  { href: "/motorista/checklists", label: "Meus checklists", icon: List },
];

const PORTARIA_NAV: NavItem[] = [{ href: "/portaria", label: "Liberação", icon: DoorOpen }];

function buildNav(perfil: PerfilUsuario): NavItem[] {
  if (perfil === "MOTORISTA") return MOTORISTA_NAV;
  if (perfil === "PORTARIA") {
    const nav: NavItem[] = [...PORTARIA_NAV];
    if (canAccessOperacao(perfil)) nav.push(...OPERACAO_NAV);
    if (canAccessDocumentos(perfil)) nav.push(...DOCUMENTOS_NAV);
    return nav;
  }

  const nav: NavItem[] = [...BASE_ADMIN_NAV];
  if (canAccessManutencao(perfil)) nav.push(...MANUTENCAO_NAV);
  if (canAccessOperacao(perfil)) nav.push(...OPERACAO_NAV);
  if (canAccessDocumentos(perfil)) nav.push(...DOCUMENTOS_NAV);

  if (perfil === "DEV") {
    nav.push(
      { href: "/motorista", label: "Início motorista", icon: Home },
      { href: "/motorista/checklist", label: "Checklist motorista", icon: ClipboardCheck },
      { href: "/motorista/checklists", label: "Histórico motorista", icon: List }
    );
  }

  return nav;
}

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
  const nav = buildNav(perfil);

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b bg-primary text-primary-foreground lg:border-b-0 lg:border-r lg:border-blue-950/20">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
            <Truck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="font-semibold">Frotas Bemol</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-primary-foreground/90 transition-colors hover:bg-white/10 hover:text-primary-foreground"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-end border-b bg-white px-4 lg:px-6">
          <UserMenu email={email} name={name} />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
