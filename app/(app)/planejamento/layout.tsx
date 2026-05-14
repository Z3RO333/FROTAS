import Link from "next/link";
import { requireAdminUser } from "@/lib/rbac";

const TABS = [
  { href: "/planejamento", label: "Visão Geral" },
  { href: "/planejamento/manutencao", label: "Manutenção" },
  { href: "/planejamento/documentos", label: "Documentos" },
  { href: "/planejamento/disponibilidade", label: "Disponibilidade" },
  { href: "/planejamento/pneus", label: "Pneus" },
  { href: "/planejamento/lavagem", label: "Lavagem" },
  { href: "/planejamento/seguranca", label: "Kit Segurança" },
  { href: "/planejamento/bateria", label: "Bateria" },
  { href: "/planejamento/estepes", label: "Estepes" },
];

export default async function PlanejamentoLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Planejamento de Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Cockpit Operacional</h1>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b pb-0">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="shrink-0 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-blue-600 hover:text-blue-700"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
