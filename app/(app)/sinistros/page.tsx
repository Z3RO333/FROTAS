import Link from "next/link";
import { AlertTriangle, Camera, ExternalLink, LifeBuoy, MapPin, Phone, ShieldAlert, Truck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SocorroStatusForm } from "@/components/sinistros/socorro-status-form";
import { SinistroStatusForm } from "@/components/sinistros/sinistro-status-form";
import { createSignedSinistroImageUrl } from "@/lib/repos/sinistro-images";
import { listAdminSinistros, sinistrosDashboardKpis, type SinistroRow } from "@/lib/repos/sinistros";
import { requireAdminUser } from "@/lib/rbac";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SinistroAdminRow = SinistroRow & {
  signed_media_urls: Array<{ path: string; url: string | null }>;
};

const TIPO_LABELS: Record<string, string> = {
  veiculo: "VEICULO",
  casa: "CASA",
  socorro: "SOCORRO",
};

const SOCORRO_STATUS_COLORS: Record<string, string> = {
  ABERTO: "border-slate-200 bg-slate-50 text-slate-800",
  EM_ATENDIMENTO: "border-blue-200 bg-blue-50 text-blue-800",
  GUINCHO_ACIONADO: "border-orange-200 bg-orange-50 text-orange-800",
  RESOLVIDO: "border-green-200 bg-green-50 text-green-800",
  CANCELADO: "border-red-200 bg-red-50 text-red-700",
};

export default async function SinistrosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireAdminUser();
  const { tipo: filtroTipo } = await searchParams;

  const [kpis, rows] = await Promise.all([sinistrosDashboardKpis(), listAdminSinistros(200)]);

  const filteredRows = filtroTipo && filtroTipo !== "todos"
    ? rows.filter((row) => row.tipo_sinistro === filtroTipo)
    : rows;

  const sinistros: SinistroAdminRow[] = await Promise.all(
    filteredRows.map(async (row) => ({
      ...row,
      signed_media_urls: await Promise.all(
        (row.media_paths ?? []).map(async (path) => ({
          path,
          url: await createSignedSinistroImageUrl(path).catch((error) => {
            console.warn("[sinistros] falha ao assinar imagem", error);
            return null;
          }),
        }))
      ),
    }))
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">Administracao</p>
        <h1 className="text-3xl font-semibold tracking-tight">Sinistros recebidos</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi title="Total" value={kpis.total} icon={<ShieldAlert className="h-4 w-4" />} />
        <Kpi title="Pendentes" value={kpis.pendentes} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi title="Socorros abertos" value={kpis.socorros_abertos} icon={<LifeBuoy className="h-4 w-4" />} accent="amber" />
        <Kpi title="Com feridos" value={kpis.com_feridos} icon={<UserRound className="h-4 w-4" />} />
        <Kpi title="Com fotos" value={kpis.com_fotos} icon={<Camera className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: "todos", label: "Todos" },
          { value: "veiculo", label: "Veiculo" },
          { value: "casa", label: "Casa" },
          { value: "socorro", label: "Socorro" },
        ].map((opt) => {
          const active = (filtroTipo ?? "todos") === opt.value;
          return (
            <Link
              key={opt.value}
              href={opt.value === "todos" ? "/sinistros" : `/sinistros?tipo=${opt.value}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4">
        {sinistros.length > 0 ? (
          sinistros.map((sinistro) => <SinistroCard key={sinistro.id} sinistro={sinistro} />)
        ) : (
          <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
            Nenhum sinistro recebido.
          </div>
        )}
      </div>
    </div>
  );
}

function SinistroCard({ sinistro }: { sinistro: SinistroAdminRow }) {
  const isSocorro = sinistro.tipo_sinistro === "socorro";
  const statusClass = isSocorro
    ? SOCORRO_STATUS_COLORS[sinistro.status] ?? ""
    : "";

  return (
    <article className="rounded-md border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{sinistro.ticket_number}</h2>
            <Badge variant="outline">{TIPO_LABELS[sinistro.tipo_sinistro] ?? sinistro.tipo_sinistro}</Badge>
            <Badge variant="outline" className={statusClass}>{sinistro.status}</Badge>
            {sinistro.houve_feridos ? (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
                Com feridos
              </Badge>
            ) : null}
            {isSocorro && sinistro.precisa_guincho ? (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
                Guincho necessario
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Truck className="h-4 w-4" />} value={`${sinistro.numero_frota ?? "-"} / ${sinistro.placa ?? "-"}`} />
            <Metric icon={<UserRound className="h-4 w-4" />} value={sinistro.motorista_nome ?? sinistro.motorista_id} />
            <Metric icon={<MapPin className="h-4 w-4" />} value={sinistro.endereco} />
            {isSocorro && sinistro.telefone_solicitante ? (
              <Metric icon={<Phone className="h-4 w-4" />} value={sinistro.telefone_solicitante} />
            ) : (
              <Metric icon={<Camera className="h-4 w-4" />} value={`${sinistro.signed_media_urls.length} foto(s)`} />
            )}
          </div>

          <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-800">
            <p className="font-medium text-slate-600">Descricao do ocorrido</p>
            <p className="mt-1 whitespace-pre-wrap">{sinistro.descricao}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Criado em" value={formatDate(sinistro.criado_em)} />
            <Info label="Setor" value={sinistro.setor ?? "-"} />
            {isSocorro ? (
              <Info label="Responsavel" value={sinistro.responsavel_atendimento ?? "Nenhum"} />
            ) : (
              <Info
                label="SAMU/Bombeiros"
                value={sinistro.houve_feridos ? (sinistro.samu_bombeiros_presente ? "Sim" : "Nao") : "Nao houve feridos"}
              />
            )}
          </div>

          {!isSocorro ? <Terceiros terceiros={sinistro.terceiros ?? []} /> : null}

          {isSocorro ? (
            <SocorroStatusForm sinistroId={sinistro.id} currentStatus={sinistro.status} />
          ) : (
            <SinistroStatusForm sinistroId={sinistro.id} currentStatus={sinistro.status} />
          )}
        </div>

        <div className="w-full shrink-0 xl:w-80">
          <p className="mb-2 text-sm font-semibold">Fotos anexadas</p>
          {sinistro.signed_media_urls.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {sinistro.signed_media_urls.map((media, index) =>
                media.url ? (
                  <Link
                    key={media.path}
                    href={media.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-md border bg-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={media.url} alt={`Foto ${index + 1} do sinistro`} className="h-full w-full object-cover" />
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </Link>
                ) : (
                  <div key={media.path} className="flex aspect-square items-center justify-center rounded-md border bg-slate-50 text-xs text-muted-foreground">
                    Indisponivel
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="rounded-md border bg-slate-50 p-4 text-sm text-muted-foreground">Nenhuma foto anexada.</div>
          )}
        </div>
      </div>
    </article>
  );
}

function Terceiros({ terceiros }: { terceiros: SinistroRow["terceiros"] }) {
  if (!terceiros || terceiros.length === 0) {
    return <div className="rounded-md border bg-slate-50 p-3 text-sm text-muted-foreground">Nenhum terceiro informado.</div>;
  }

  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <p className="text-sm font-semibold">Terceiros afetados</p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {terceiros.map((terceiro, index) => (
          <div key={`${terceiro.cpf}-${index}`} className="rounded-md border bg-white p-3 text-sm">
            <p className="font-medium">{terceiro.nome}</p>
            <p className="text-muted-foreground">Telefone: {terceiro.telefone || "-"}</p>
            <p className="text-muted-foreground">CPF: {terceiro.cpf || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-blue-700">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-1 block">{value}</span>
    </div>
  );
}

function Kpi({ title, value, icon, accent }: { title: string; value: number; icon: React.ReactNode; accent?: "amber" }) {
  return (
    <Card className="rounded-md">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={accent === "amber" ? "text-amber-600" : "text-red-700"}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
}
