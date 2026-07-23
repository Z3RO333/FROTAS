import { AppSidebar, type NavIconName } from "@/components/app-sidebar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { UserMenu } from "@/components/user-menu";
import { MobileNav } from "@/components/mobile-nav";
import { cn } from "@/lib/utils";
import { OnlineStatus } from "@/components/online-status";
import {
  canAccessDocumentos,
  canAccessManutencao,
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
  { href: "/sinistros", label: "Sinistros", icon: "ShieldAlert" },
  { href: "/frotas", label: "Veículos", icon: "List" },
  { href: "/planejamento/paradas", label: "Frotas Paradas", icon: "AlertTriangle" },
  { href: "/frotas/disponibilidades", label: "Disponibilidade", icon: "Gauge" },
  { href: "/checklists/validacao-km", label: "Quilometragem", icon: "Gauge" },
  { href: "/frotas/vendidos", label: "Vendidos", icon: "ShoppingCart" },
];

const PORTARIA_OPERACIONAL_NAV: NavItem[] = [
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" },
  { href: "/checklists", label: "Checklists", icon: "ClipboardCheck" },
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
  { href: "/motorista/sinistro", label: "Reportar Sinistro", icon: "AlertTriangle" },
  { href: "/motorista/sinistros", label: "Meus Sinistros", icon: "ShieldAlert" },
  { href: "/motorista/checklists", label: "Meus Checklists", icon: "List" },
  { href: "/motorista/historico", label: "Meu histórico", icon: "History" },
];

const PORTARIA_NAV: NavItem[] = [
  { href: "/portaria", label: "Liberação", icon: "DoorOpen" },
];

function buildSections(perfil: PerfilUsuario): NavSection[] {
  if (perfil === "MOTORISTA") return [{ title: "Motorista", items: MOTORISTA_NAV }];

  if (perfil === "APROVADOR") return [{ title: "Aprovação", items: PORTARIA_NAV }];

  if (perfil === "PORTARIA") {
    const sections: NavSection[] = [{ title: "Portaria", items: PORTARIA_NAV }];
    if (canAccessDocumentos(perfil)) sections.push({ title: "Documentos", items: DOCUMENTOS_NAV });
    return sections;
  }

  const sections: NavSection[] = [
    { title: "Cockpit", items: COCKPIT_NAV },
    { title: "Frota", items: FROTA_NAV },
  ];

  if (canAccessManutencao(perfil)) sections.push({ title: "Manutenção", items: MANUTENCAO_NAV });
  if (canAccessManutencao(perfil)) sections.push({ title: "Pneus", items: PNEUS_NAV });

  // Ordem final pedida: Administração > Documentos > Motorista > Portaria
  if (canManageUsers(perfil)) sections.push({ title: "Administração", items: ADMINISTRACAO_NAV });
  if (canAccessDocumentos(perfil)) sections.push({ title: "Documentos", items: DOCUMENTOS_NAV });

  // ADMIN, GESTOR e DEV podem acessar as visões do motorista para supervisão
  if (perfil === "ADMIN" || perfil === "GESTOR" || perfil === "DEV") {
    sections.push({
      title: perfil === "DEV" ? "Motorista (Dev)" : "Motorista",
      items: [
        { href: "/motorista", label: "Início motorista", icon: "Home" },
        { href: "/motorista/checklist", label: "Fazer checklist", icon: "ClipboardCheck" },
        { href: "/motorista/sinistro", label: "Reportar sinistro", icon: "AlertTriangle" },
        { href: "/motorista/sinistros", label: "Sinistros motorista", icon: "ShieldAlert" },
        { href: "/motorista/checklists", label: "Histórico motorista", icon: "List" },
      ],
    });
  }

  if (perfil === "ADMIN" || perfil === "GESTOR" || perfil === "DEV") {
    sections.push({ title: "Portaria", items: PORTARIA_OPERACIONAL_NAV });
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
  const hideMobileSidebar = perfil === "MOTORISTA";

  return (
    <div className="min-h-screen text-foreground lg:flex bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.06),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(15,23,42,0.05),_transparent_50%)] bg-slate-50">
      <div className={cn(hideMobileSidebar && "hidden lg:block")}>
        <AppSidebar sections={sections} perfil={perfil} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
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
        <main className="flex-1 overflow-auto p-3 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
