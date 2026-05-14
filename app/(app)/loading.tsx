import { MetricGridSkeleton, Skeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3 w-96" />
      </div>
      <MetricGridSkeleton count={5} />
      <MetricGridSkeleton count={5} />
      <MetricGridSkeleton count={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <TableSkeleton rows={4} cols={3} />
        <TableSkeleton rows={4} cols={3} />
      </div>
    </div>
  );
}
