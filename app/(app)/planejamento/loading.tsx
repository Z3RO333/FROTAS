import { MetricGridSkeleton, Skeleton } from "@/components/ui/loading-skeleton";

export default function PlanejamentoLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Skeleton className="h-2.5 w-40" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-96" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <MetricGridSkeleton count={5} />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <MetricGridSkeleton count={4} />
      </div>
    </div>
  );
}
