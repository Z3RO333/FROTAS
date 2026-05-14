import Link from "next/link";
import { AppSidebar, type NavIconName } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import {
  canAccessDocumentos,
  canAccessManutencao,
  canAccessOperacao,
  canManageUsers,
  type PerfilUsuario,
} from "@/lib/rbac";

type NavItem = { href: string; label: string; icon: NavIconName };
type NavSection = { title: string; items: NavItem[] };

const COCKPIT_NAV: NavItem[] = [
  { href: "/", label: "Visão Geral", icon: "LayoutDashboard" },
  { href: "/planejamento", label: "Radar de Manutenção", icon: "Gauge" },
  { href: "/pendencias", label: "Alertas", icon: "AlertTriangle" },
  { href: "/relatorios/checklists", label: "Relatórios IA", icon: "BarChart2" },
];

const FROTA_NAV: NavItem[] = [
  { href: "/frotas", label: "Veículos", icon: "List" },
  { href: "/planejamento/paradas", label: "Frotas Paradas", icon: "AlertTriangle" },
  { href: "/planejamento/disponibilidade", label: "Disponibilidade", icon: "Gauge" },
  { href: "/checklists/validacao-km", label: "Quilometragem", icon: "Gauge" },
  { href: "/frotas/vendidos", label: "Vendidos", icon: "ShoppingCart" },
];

const OPERACAO_NAV: NavItem[] = [
  { href: "/checklists", label: "Checklists", icon: "ClipboardCheck" },
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" },
  { href: "/operacao", label: "Operação", icon: "Gauge" },
];

const MANUTENCAO_NAV: NavItem[] = [
  { href: "/planejamento/manutencao", label: "Preventivas", icon: "Wrench" },
  { href: "/manutencao", label: "Serviços", icon: "Wrench" },
  { href: "/oficinas", label: "Oficinas", icon: "MapPin" },
  { href: "/planejamento/lavagem", label: "Lavagem", icon: "ClipboardCheck" },
  { href: "/planejamento/bateria", label: "Bateria", icon: "Wrench" },
  { href: "/planejamento/seguranca", label: "Kit Segurança", icon: "ShieldAlert" },
];

const PNEUS_NAV: NavItem[] = [
  { href: "/planejamento/pneus", label: "Painel de Pneus", icon: "Truck" },
  { href: "/pneus", label: "Trocas e Histórico", icon: "Truck" },
  { href: "/planejamento/estepes", label: "Estepes", icon: "Truck" },
];

const DOCUMENTOS_NAV: NavItem[] = [
  { href: "/documentos", label: "Documentos da Frota", icon: "FileText" },
  { href: "/planejamento/documentos", label: "Vencimentos", icon: "FileText" },
];

const ADMINISTRACAO_NAV: NavItem[] = [
  { href: "/administracao/usuarios", label: "Usuários", icon: "Users" },
  { href: "/unidades", label: "Unidades", icon: "Building2" },
  { href: "/equipamentos", label: "Equipamentos", icon: "Settings" },
];

const MOTORISTA_NAV: NavItem[] = [
  { href: "/motorista", label: "Início", icon: "Home" },
  { href: "/motorista/checklist", label: "Fazer Checklist", icon: "ClipboardCheck" },
  { href: "/motorista/checklists", label: "Meus Checklists", icon: "List" },
  { href: "/documentos", label: "Documentos", icon: "FileText" },
];

const PORTARIA_NAV: NavItem[] = [
  { href: "/portaria", label: "Liberação", icon: "DoorOpen" },
];

function buildSections(perfil: PerfilUsuario): NavSection[] {
  if (perfil === "MOTORISTA") return [{ title: "Motorista", items: MOTORISTA_NAV }];

  if (perfil === "PORTARIA") {
    const sections: NavSection[] = [{ title: "Portaria", items: PORTARIA_NAV }];
    if (canAccessOperacao(perfil)) sections.push({ title: "Operação", items: OPERACAO_NAV });
    if (canAccessDocumentos(perfil)) sections.push({ title: "Documentos", items: DOCUMENTOS_NAV });
    return sections;
  }

  const sections: NavSection[] = [
    { title: "Cockpit", items: COCKPIT_NAV },
    { title: "Frota", items: FROTA_NAV },
    { title: "Operação", items: OPERACAO_NAV },
  ];

  if (canAccessManutencao(perfil)) sections.push({ title: "Manutenção", items: MANUTENCAO_NAV });
  if (canAccessManutencao(perfil)) sections.push({ title: "Pneus", items: PNEUS_NAV });
  if (canAccessDocumentos(perfil)) sections.push({ title: "Documentos", items: DOCUMENTOS_NAV });
  if (canManageUsers(perfil)) sections.push({ title: "Administração", items: ADMINISTRACAO_NAV });

  if (perfil === "DEV") {
    sections.push({
      title: "Motorista (Dev)",
      items: [
        { href: "/motorista", label: "Início motorista", icon: "Home" },
        { href: "/motorista/checklist", label: "Checklist motorista", icon: "ClipboardCheck" },
        { href: "/motorista/checklists", label: "Histórico motorista", icon: "List" },
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
