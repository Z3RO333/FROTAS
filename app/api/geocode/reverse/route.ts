import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/api-error";

export const runtime = "nodejs";

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
};

type NominatimResponse = {
  display_name?: string;
  category?: string;
  type?: string;
  name?: string;
  address?: NominatimAddress;
};

type BigDataCloudResponse = {
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  city?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; description?: string }>;
  };
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return apiError("Nao autenticado.", 401, "AUTH_REQUIRED");
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const accuracy = Number(searchParams.get("accuracy"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return apiError("Coordenadas invalidas.", 400, "INVALID_COORDINATES");
  }

  try {
    const address = await reverseWithNominatim(lat, lon);
    if (address) {
      return NextResponse.json({
        address,
        provider: "nominatim",
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
      });
    }
  } catch (error) {
    console.warn("[geocode] nominatim indisponivel", error);
  }

  try {
    const address = await reverseWithBigDataCloud(lat, lon);
    if (address) {
      return NextResponse.json({
        address,
        provider: "bigdatacloud",
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
      });
    }
  } catch (error) {
    console.warn("[geocode] bigdatacloud indisponivel", error);
  }

  return NextResponse.json({
    address: `Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`,
    provider: "coordinates",
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
  });
}

async function reverseWithNominatim(lat: number, lon: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "17");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "frotas-bemol/1.0 reverse-geocoding",
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as NominatimResponse;
  return formatNominatimAddress(data);
}

async function reverseWithBigDataCloud(lat: number, lon: number): Promise<string | null> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("localityLanguage", "pt");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as BigDataCloudResponse;
  return [
    data.locality,
    data.city,
    data.principalSubdivision,
    data.countryName,
  ]
    .filter(Boolean)
    .join(", ") || null;
}

function formatNominatimAddress(data: NominatimResponse): string | null {
  const address = data.address;
  if (!address) return null;

  const street = address.road ?? address.pedestrian ?? address.footway;
  const streetLine = [street, address.house_number].filter(Boolean).join(", ");
  const city = address.city ?? address.town ?? address.village ?? address.municipality;

  const parts = [
    streetLine,
    address.neighbourhood ?? address.suburb,
    city,
    address.state,
    address.postcode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}
