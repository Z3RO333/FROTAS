import { CheckCircle2, FileText, ShieldAlert, XCircle } from "lucide-react";
import { getDocumentos, type DocumentoRow } from "@/lib/repos/planejamento";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

function urgencia(r: DocumentoRow): "vencido" | "vencendo" | "ok" | "sem_data" {
  if (r.status === "VENCIDO") return "vencido";
  if (r.status === "NO_PRAZO") return "ok";
  if (r.data_vencimento) {
    const dias = (new Date(r.data_vencimento).getTime() - Date.now()) / 86400000;
    if (dias < 30) return "vencendo";
  }
  return "sem_data";
}

export default async function DocumentosPage() {
  const rows = await getDocumentos();

  if (rows.length === 0) {
    return <EmptyState icon={FileText} title="Sem documentos" />;
  }

  const byTipo = rows.reduce<Record<string, DocumentoRow[]>>((acc, r) => {
    acc[r.tipo_documento] ??= [];
    acc[r.tipo_documento].push(r);
    return acc;
  }, {});

  const totalVencidos = rows.filter((r) => r.status === "VENCIDO").length;
  const totalOk = rows.filter((r) => r.status === "NO_PRAZO").length;
  const totalSemData = rows.filter((r) => !r.data_vencimento || r.data_vencimento === "-").length;

  const vencidos = rows
    .filter((r) => r.status === "VENCIDO")
    .sort((a, b) => (b.dias_passados ?? 0) - (a.dias_passados ?? 0))
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <MetricGrid cols={4}>
        <MetricCard
          label="Total de documentos"
          value={rows.length}
          icon={FileText}
          severity="INFO"
        />
        <MetricCard
          label="Vencidos"
          value={totalVencidos}
          icon={XCircle}
          severity="CRITICO"
          hint="Ação imediata"
        />
        <MetricCard
          label="Em dia"
          value={totalOk}
          icon={CheckCircle2}
          severity="OK"
        />
        <MetricCard
          label="Sem data"
          value={totalSemData}
          icon={ShieldAlert}
          severity="ATENCAO"
        />
      </MetricGrid>

      {/* Resumo por tipo */}
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(byTipo).map(([tipo, items]) => {
          const venc = items.filter((i) => i.status === "VENCIDO").length;
          const ok = items.filter((i) => i.status === "NO_PRAZO").length;
          const pct = items.length > 0 ? Math.round((ok / items.length) * 100) : 0;
          return (
            <div key={tipo} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{tipo}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {items.length} docs
                </span>
              </div>
              <div className="mt-3 flex items-end gap-4">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-red-600">{venc}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Vencidos
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums text-emerald-600">{ok}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Em dia
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div
                    className={`text-sm font-semibold ${
                      pct >= 80
                        ? "text-emerald-600"
                        : pct >= 50
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {pct}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">conformidade</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top vencidos */}
      {vencidos.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b bg-red-50 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-red-900">
                Documentos vencidos há mais tempo ({vencidos.length} de {totalVencidos})
              </h2>
              <p className="mt-0.5 text-xs text-red-700">Priorizar regularização imediata</p>
            </div>
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
          <div className="divide-y">
            {vencidos.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      Frota {r.frota_numero ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.placa ?? "—"}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                      {r.tipo_documento}
                    </span>
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    <span>Venc.: {r.data_vencimento ?? "—"}</span>
                    {r.localizacao && <span>· {r.localizacao}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold tabular-nums text-red-600">
                    {r.dias_passados ?? "—"}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">dias</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista completa */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Todos os documentos ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Frota</th>
                <th className="p-3 text-left">Placa</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">Vencimento</th>
                <th className="p-3 text-right">Dias atraso</th>
                <th className="p-3 text-left">Localização</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 300).map((r, i) => {
                const u = urgencia(r);
                return (
                  <tr key={i} className={u === "vencido" ? "bg-red-50/30 hover:bg-red-50/60" : "hover:bg-slate-50"}>
                    <td className="p-3 font-medium">{r.frota_numero ?? "—"}</td>
                    <td className="p-3">{r.placa ?? "—"}</td>
                    <td className="p-3 text-xs">{r.tipo_documento}</td>
                    <td className="p-3 text-xs tabular-nums">{r.data_vencimento ?? "—"}</td>
                    <td className={`p-3 text-right text-xs tabular-nums ${(r.dias_passados ?? 0) > 0 ? "text-red-600 font-semibold" : ""}`}>
                      {r.dias_passados ?? "—"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{r.localizacao ?? "—"}</td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
