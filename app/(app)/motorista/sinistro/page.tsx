import Link from "next/link";
import { Car, ChevronRight, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireAppUser } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportarSinistroPage() {
  await requireAppUser();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-2xl flex-col justify-center space-y-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Sinistros</p>
        <h1 className="text-2xl font-bold tracking-tight">Selecione o tipo de acidente</h1>
      </div>

      <div className="space-y-4">
        <SinistroTypeCard
          href="/motorista/sinistro/veiculo"
          icon={Car}
          title="Acidente com Veiculo"
          description="Registrar acidentes envolvendo carros, motos ou caminhoes"
          tone="blue"
        />
        <SinistroTypeCard
          href="/motorista/sinistro/casa"
          icon={Home}
          title="Acidente com Casas"
          description="Reportar acidentes em residencias"
          tone="sky"
        />
      </div>
    </div>
  );
}

function SinistroTypeCard({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: typeof Car;
  title: string;
  description: string;
  tone: "blue" | "sky";
}) {
  return (
    <Link href={href} className="block">
      <Card className="grid grid-cols-[64px_1fr_auto] items-center gap-4 rounded-md border-0 bg-white p-5 shadow-sm transition-colors hover:bg-blue-50">
        <span
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full text-white",
            tone === "blue" ? "bg-blue-600" : "bg-sky-500"
          )}
        >
          <Icon className="h-8 w-8" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-slate-900">{title}</span>
          <span className="mt-1 block text-sm text-slate-500">{description}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-blue-600" aria-hidden="true" />
      </Card>
    </Link>
  );
}
