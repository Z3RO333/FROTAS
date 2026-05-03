export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-80 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg border bg-white" />
        ))}
      </div>

      <div className="h-40 animate-pulse rounded-lg border bg-white" />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg border bg-white" />
        <div className="h-72 animate-pulse rounded-lg border bg-white" />
      </div>
    </div>
  );
}
