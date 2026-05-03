export default function FrotaDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-md bg-slate-200" />
          <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-28 animate-pulse rounded bg-slate-200" />
        </div>
      </div>

      <div className="h-48 animate-pulse rounded-lg border bg-white" />
      <div className="h-72 animate-pulse rounded-lg border bg-white" />
      <div className="h-64 animate-pulse rounded-lg border bg-white" />
    </div>
  );
}
