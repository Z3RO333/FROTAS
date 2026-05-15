import Link from "next/link";
import { AppSidebar, type NavIconName } from "@/components/app-sidebar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
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
  { href: "/operacao/disponibilidade", label: "Disponibilidade", icon: "Gauge" },
];

const MANUTENCAO_NAV: NavItem[] = [
  { href: "/planejamento/manutencao", label: "Preventivas", icon: "Wrench" },
  { href: "/manutencao", label: "Serviços", icon: "Wrench" },
  { href: "/manutencao/ordens", label: "Ordens", icon: "FileText" },
  { href: "/manutencao/custos", label: "Custos", icon: "BarChart2" },
  { href: "/oficinas", label: "Oficinas", icon: "MapPin" },
  { href: "/planejamento/lavagem", label: "Lavagem", icon: "ClipboardCheck" },
  { href: "/planejamento/bateria", label: "Bateria", icon: "Wrench" },
  { href: "/planejamento/seguranca", label: "Kit Segurança", icon: "ShieldAlert" },
  { href: "/planejamento/manutencao/tacografo", label: "Tacógrafo", icon: "ClipboardCheck" },
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
  { href: "/administracao/motoristas", label: "Motoristas", icon: "Users" },
  { href: "/unidades", label: "Unidades", icon: "Building2" },
  { href: "/equipamentos", label: "Equipamentos", icon: "Settings" },
  { href: "/administracao/emails", label: "E-mails", icon: "FileText" },
];

const MOTORISTA_NAV: NavItem[] = [
  { href: "/motorista", label: "Início", icon: "Home" },
  { href: "/motorista/checklist", label: "Fazer Checklist", icon: "ClipboardCheck" },
  { href: "/motorista/checklists", label: "Meus Checklists", icon: "List" },
  { href: "/motorista/historico", label: "Meu histórico", icon: "History" },
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

  // GESTOR e DEV podem acessar as visões do motorista para supervisão
  if (perfil === "GESTOR" || perfil === "DEV") {
    sections.push({
      title: perfil === "DEV" ? "Motorista (Dev)" : "Motorista",
      items: [
        { href: "/motorista", label: "Início motorista", icon: "Home" },
        { href: "/motorista/checklist", label: "Fazer checklist", icon: "ClipboardCheck" },
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

  return (
    <div className="min-h-screen bg-slate-100 text-foreground lg:flex">
      <AppSidebar sections={sections} perfil={perfil} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-4 border-b bg-white/98 px-4 shadow-sm backdrop-blur-sm lg:px-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
              Frotas Bemol
            </p>
            <div className="hidden md:block">
              <BreadcrumbNav sections={sections} />
            </div>
          </div>
          <UserMenu email={email} name={name} />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
