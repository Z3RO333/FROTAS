"use client";

import { useCallback, useState } from "react";

// Motivo distinto pra cada falha — GPS negado, GPS sem resposta a tempo e
// dispositivo sem suporte pedem mensagens diferentes, não um erro genérico.
export type GeolocationErrorKind =
  | "unsupported"
  | "permission-denied"
  | "timeout"
  | "unavailable"
  | "geocode-failed";

export type GeolocationAddressState = {
  loading: boolean;
  endereco: string;
  latitude: string;
  longitude: string;
  accuracy: number | null;
  errorKind: GeolocationErrorKind | null;
  errorMessage: string | null;
};

export const GEOLOCATION_ERROR_MESSAGES: Record<GeolocationErrorKind, string> = {
  unsupported: "Este dispositivo não suporta localização por GPS. Digite o endereço manualmente.",
  "permission-denied":
    "Permissão de localização negada. Habilite o GPS nas configurações do navegador ou digite o endereço manualmente.",
  timeout: "A localização demorou demais para responder. Tente de novo ou digite o endereço manualmente.",
  unavailable: "Não foi possível determinar sua localização agora. Tente de novo ou digite o endereço manualmente.",
  "geocode-failed": "Localização obtida, mas não conseguimos traduzir para um endereço. As coordenadas foram preenchidas.",
};

const INITIAL_STATE: GeolocationAddressState = {
  loading: false,
  endereco: "",
  latitude: "",
  longitude: "",
  accuracy: null,
  errorKind: null,
  errorMessage: null,
};

/**
 * GPS + reverse geocode com endereço editável e erro específico por causa
 * (permissão negada / timeout / indisponível / sem suporte / geocode falhou).
 * Endereço manual sempre funciona mesmo sem localização — locate() é opcional.
 */
export function useGeolocationAddress() {
  const [state, setState] = useState<GeolocationAddressState>(INITIAL_STATE);

  const setEndereco = useCallback((value: string) => {
    setState((prev) => ({ ...prev, endereco: value }));
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        errorKind: "unsupported",
        errorMessage: GEOLOCATION_ERROR_MESSAGES.unsupported,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, errorKind: null, errorMessage: null }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;

        try {
          const response = await fetch(
            `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accuracy=${encodeURIComponent(accuracy ?? "")}`
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error ?? "Não foi possível buscar o endereço.");
          setState({
            loading: false,
            endereco: data?.address || `Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`,
            latitude: String(lat),
            longitude: String(lon),
            accuracy,
            errorKind: null,
            errorMessage: null,
          });
        } catch {
          setState({
            loading: false,
            endereco: `Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`,
            latitude: String(lat),
            longitude: String(lon),
            accuracy,
            errorKind: "geocode-failed",
            errorMessage: GEOLOCATION_ERROR_MESSAGES["geocode-failed"],
          });
        }
      },
      (error) => {
        const kind: GeolocationErrorKind =
          error.code === error.PERMISSION_DENIED
            ? "permission-denied"
            : error.code === error.TIMEOUT
              ? "timeout"
              : "unavailable";
        setState((prev) => ({
          ...prev,
          loading: false,
          errorKind: kind,
          errorMessage: GEOLOCATION_ERROR_MESSAGES[kind],
        }));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  return { ...state, locate, setEndereco };
}
