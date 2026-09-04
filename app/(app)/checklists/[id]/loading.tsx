import { MetricGridSkeleton, Skeleton } from "@/components/ui/loading-skeleton";

export default function ChecklistDetailLoading() {
  return (
    <div className="space-y-6" aria-label="Carregando checklist" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <MetricGridSkeleton count={4} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
