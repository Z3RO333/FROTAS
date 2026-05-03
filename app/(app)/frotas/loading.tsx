export default function FrotasLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-36 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-32 animate-pulse rounded bg-slate-200" />
        </div>
      </div>

      <div className="h-16 animate-pulse rounded-lg border bg-white" />

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="h-12 animate-pulse bg-slate-50" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t p-4">
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
            <div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
