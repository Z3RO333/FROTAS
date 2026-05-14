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
type NavSection = { title: string; items: NavItem[] };

const COCKPIT_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pendencias", label: "Pendencias", icon: AlertTriangle },
];

const FROTA_NAV: NavItem[] = [
  { href: "/frotas", label: "Frotas", icon: List },
  { href: "/unidades", label: "Unidades", icon: Building2 },
  { href: "/frotas/vendidos", label: "Vendidos", icon: ShoppingCart },
];

const CHECKLIST_NAV: NavItem[] = [
  { href: "/checklists", label: "Checklists", icon: ClipboardCheck },
  { href: "/checklists/validacao-km", label: "Validar KM", icon: Gauge },
  { href: "/portaria", label: "Portaria", icon: DoorOpen },
];

const MANUTENCAO_NAV: NavItem[] = [
  { href: "/pneus", label: "Pneus", icon: Truck },
  { href: "/manutencao", label: "Servicos", icon: Wrench },
  { href: "/equipamentos", label: "Equipamentos", icon: Settings },
  { href: "/oficinas", label: "Oficinas", icon: MapPin },
];

const OPERACAO_NAV: NavItem[] = [{ href: "/operacao", label: "Operacao", icon: Gauge }];
const DOCUMENTOS_NAV: NavItem[] = [{ href: "/documentos", label: "Documentos", icon: FileText }];

const MOTORISTA_NAV: NavItem[] = [
  { href: "/motorista", label: "Inicio", icon: Home },
  { href: "/motorista/checklist", label: "Fazer checklist", icon: ClipboardCheck },
  { href: "/motorista/checklists", label: "Meus checklists", icon: List },
  { href: "/documentos", label: "Documentos", icon: FileText },
];

const PORTARIA_NAV: NavItem[] = [{ href: "/portaria", label: "Liberacao", icon: DoorOpen }];

function buildSections(perfil: PerfilUsuario): NavSection[] {
  if (perfil === "MOTORISTA") return [{ title: "Motorista", items: MOTORISTA_NAV }];

  if (perfil === "PORTARIA") {
    const sections: NavSection[] = [{ title: "Portaria", items: PORTARIA_NAV }];
    if (canAccessOperacao(perfil)) sections.push({ title: "Operacao", items: OPERACAO_NAV });
    if (canAccessDocumentos(perfil)) sections.push({ title: "Documentos", items: DOCUMENTOS_NAV });
    return sections;
  }

  const sections: NavSection[] = [
    { title: "Cockpit", items: COCKPIT_NAV },
    { title: "Frota", items: FROTA_NAV },
    { title: "Checklists", items: CHECKLIST_NAV },
  ];

  if (canAccessManutencao(perfil)) sections.push({ title: "Manutencao", items: MANUTENCAO_NAV });
  if (canAccessOperacao(perfil)) sections.push({ title: "Operacao", items: OPERACAO_NAV });
  if (canAccessDocumentos(perfil)) sections.push({ title: "Documentos", items: DOCUMENTOS_NAV });

  if (perfil === "DEV") {
    sections.push({
      title: "Motorista",
      items: [
        { href: "/motorista", label: "Inicio motorista", icon: Home },
        { href: "/motorista/checklist", label: "Checklist motorista", icon: ClipboardCheck },
        { href: "/motorista/checklists", label: "Historico motorista", icon: List },
      ],
    });
  }

  return sections;
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
  const sections = buildSections(perfil);
  const quickLinks = sections.flatMap((section) => section.items).slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-100 text-foreground lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b bg-slate-950 text-white lg:border-b-0 lg:border-r lg:border-slate-900">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/15 ring-1 ring-blue-300/20">
              <Truck className="h-5 w-5 text-blue-100" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">FROTAS</div>
              <div className="text-xs text-slate-400">Plataforma operacional</div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Perfil</div>
            <div className="mt-1 text-sm font-medium text-white">{perfil}</div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-5 lg:overflow-visible lg:px-4 lg:py-5">
          {sections.map((section) => (
            <div key={section.title} className="min-w-max lg:min-w-0">
              <div className="mb-2 hidden px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 lg:block">
                {section.title}
              </div>
              <div className="flex gap-1 lg:block lg:space-y-1">
                {section.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:w-full"
                  >
                    <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Frotas Bemol</div>
            <div className="mt-1 hidden items-center gap-1 overflow-x-auto text-sm text-muted-foreground md:flex">
              {quickLinks.map((item, index) => (
                <span key={item.href} className="inline-flex items-center gap-1">
                  {index > 0 ? <span className="text-slate-300">/</span> : null}
                  <Link href={item.href} className="whitespace-nowrap hover:text-blue-700">
                    {item.label}
                  </Link>
                </span>
              ))}
            </div>
          </div>
          <UserMenu email={email} name={name} />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
