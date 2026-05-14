import { MetricGridSkeleton, Skeleton } from "@/components/ui/loading-skeleton";

export default function FrotaDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <MetricGridSkeleton count={4} />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
