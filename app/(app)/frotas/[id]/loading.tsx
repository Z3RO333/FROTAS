export default function FrotaDetailLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-8 w-48 rounded bg-slate-200" />
          <div className="h-4 w-64 rounded bg-slate-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-md bg-slate-200" />
          <div className="h-9 w-20 rounded-md bg-slate-200" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-7 w-12 rounded bg-slate-200" />
            <div className="mt-1 h-3 w-20 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-b pb-2">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className="h-8 w-20 rounded-md bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="mt-4 space-y-3">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-4 w-32 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="h-5 w-28 rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            {[0,1,2,3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
