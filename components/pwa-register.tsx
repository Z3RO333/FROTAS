"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.info("[PWA] Service worker registrado", reg.scope))
        .catch((err) => console.warn("[PWA] Falha ao registrar service worker", err));
    }
  }, []);

  return null;
}
