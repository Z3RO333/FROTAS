"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          await reg.update();
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((key) => key === "frotas-v1").map((key) => caches.delete(key)));
          }
        })
        .catch((err) => console.warn("[PWA] Falha ao registrar service worker", err));
    }
  }, []);

  return null;
}
