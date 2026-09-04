import { MetricGridSkeleton, Skeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Carregando página" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>
      <MetricGridSkeleton count={4} />
      <TableSkeleton rows={7} cols={5} />
    </div>
  );
}
