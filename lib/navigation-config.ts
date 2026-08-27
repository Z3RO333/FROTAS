import type { NavItem, NavSection } from "@/components/app-sidebar";
import { canAccessDocumentos, canAccessManutencao, canManageUsers, type PerfilUsuario } from "@/lib/rbac";

export type { NavItem, NavSection };

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
  { href: "/frotas/vendidos", label: "Vendidos", icon: "ShoppingCart" },
];

const PORTARIA_OPERACIONAL_NAV: NavItem[] = [
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" },
  { href: "/checklists", label: "Checklists", icon: "ClipboardCheck" },
];

const MANUTENCAO_NAV: NavItem[] = [
  { href: "/planejamento/manutencao", label: "Manutenção", icon: "Wrench" },
  { href: "/manutencao/pecas", label: "Pedidos de peças", icon: "PackageSearch" },
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

export function navigationForProfile(perfil: PerfilUsuario): NavSection[] {
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
