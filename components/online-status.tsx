"use client";

import { useEffect, useState } from "react";

export function OnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <span
      className={`items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
        online
          ? "hidden bg-emerald-50 text-emerald-700 ring-emerald-200 lg:inline-flex"
          : "inline-flex bg-amber-50 text-amber-800 ring-amber-200"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
      {online ? "Sistema online" : "Offline"}
    </span>
  );
}
