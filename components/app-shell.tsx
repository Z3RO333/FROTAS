import Link from "next/link";
import { AppSidebar, type NavIconName } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import {
  canAccessDocumentos,
  canAccessManutencao,
  canAccessOperacao,
  type PerfilUsuario,
} from "@/lib/rbac";

type NavItem = { href: string; label: string; icon: NavIconName };
type NavSection = { title: string; items: NavItem[] };

const COCKPIT_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/pendencias", label: "Pendencias", icon: "AlertTriangle" },
];

const FROTA_NAV: NavItem[] = [
  { href: "/frotas", label: "Frotas", icon: "List" },
  { href: "/unidades", label: "Unidades", icon: "Building2" },
  { href: "/frotas/vendidos", label: "Vendidos", icon: "ShoppingCart" },
];

const CHECKLIST_NAV: NavItem[] = [
  { href: "/checklists", label: "Checklists", icon: "ClipboardCheck" },
  { href: "/checklists/validacao-km", label: "Validar KM", icon: "Gauge" },
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" },
  { href: "/relatorios/checklists", label: "Relatórios IA", icon: "BarChart2" },
];

const MANUTENCAO_NAV: NavItem[] = [
  { href: "/pneus", label: "Pneus", icon: "Truck" },
  { href: "/manutencao", label: "Servicos", icon: "Wrench" },
  { href: "/equipamentos", label: "Equipamentos", icon: "Settings" },
  { href: "/oficinas", label: "Oficinas", icon: "MapPin" },
];

const OPERACAO_NAV: NavItem[] = [{ href: "/operacao", label: "Operacao", icon: "Gauge" }];
const DOCUMENTOS_NAV: NavItem[] = [{ href: "/documentos", label: "Documentos", icon: "FileText" }];

const MOTORISTA_NAV: NavItem[] = [
  { href: "/motorista", label: "Inicio", icon: "Home" },
  { href: "/motorista/checklist", label: "Fazer checklist", icon: "ClipboardCheck" },
  { href: "/motorista/checklists", label: "Meus checklists", icon: "List" },
  { href: "/documentos", label: "Documentos", icon: "FileText" },
];

const PORTARIA_NAV: NavItem[] = [{ href: "/portaria", label: "Liberacao", icon: "DoorOpen" }];

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
        { href: "/motorista", label: "Inicio motorista", icon: "Home" },
        { href: "/motorista/checklist", label: "Checklist motorista", icon: "ClipboardCheck" },
        { href: "/motorista/checklists", label: "Historico motorista", icon: "List" },
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
    <div className="min-h-screen bg-slate-100 text-foreground lg:flex">
      <AppSidebar sections={sections} perfil={perfil} />

      <div className="flex min-w-0 flex-1 flex-col">
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
