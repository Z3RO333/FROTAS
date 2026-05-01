import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MissingInfoBadge } from "@/components/frotas/missing-info-badge";
import type { Frota } from "@/lib/repos/frotas";
import { formatNumber } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  disponivel: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90",
  manutencao: "border-transparent bg-amber-500 text-white hover:bg-amber-500/90",
  atencao: "border-transparent bg-orange-500 text-white hover:bg-orange-500/90",
  critico: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

function EmptyValue() {
  return <span className="text-muted-foreground">—</span>;
}

export function FrotasTable({ rows }: { rows: Frota[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Nenhuma frota encontrada.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Frota</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead>Chassi</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Ano</TableHead>
            <TableHead>Localizacao</TableHead>
            <TableHead className="text-right">Km</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => (
            <TableRow key={f.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                <Link className="hover:underline" href={`/frotas/${f.id}`}>
                  {f.frota_geral ?? <EmptyValue />}
                </Link>
              </TableCell>
              <TableCell>
                <Link className="hover:underline" href={`/frotas/${f.id}`}>
                  {f.placa ?? <EmptyValue />}
                </Link>
              </TableCell>
              <TableCell>
                {f.chassi ? (
                  <Link className="hover:underline" href={`/frotas/${f.id}`}>
                    {f.chassi}
                  </Link>
                ) : (
                  <MissingInfoBadge />
                )}
              </TableCell>
              <TableCell>{f.modelo ?? <EmptyValue />}</TableCell>
              <TableCell>{f.ano_fabricacao ?? <EmptyValue />}</TableCell>
              <TableCell>{f.localizacao ?? <EmptyValue />}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(f.km_atual)}</TableCell>
              <TableCell>
                {f.status ? (
                  <Badge className={STATUS_CLASS[f.status] ?? ""}>{f.status}</Badge>
                ) : (
                  <EmptyValue />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
