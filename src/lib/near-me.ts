import { canonicalCity, type CityName } from "@/lib/constants";

export type LatLng = { lat: number; lng: number };

/**
 * Approximate town centres. Shops have no pin today, only the owner's town, so Near me measures
 * to the middle of that town. A shop with Storefront.latitude/longitude set uses its own pin instead.
 * Accuracy is a few km, which is enough to put a fundi in Kisumu ahead of one in Mombasa.
 */
export const TOWN_CENTROIDS: Record<CityName, LatLng> = {
  Kisumu: { lat: -0.0917, lng: 34.768 },
  Oyugis: { lat: -0.51, lng: 34.735 },
  Kosele: { lat: -0.483, lng: 34.573 },
  "Homa Bay": { lat: -0.5273, lng: 34.4571 },
  Siaya: { lat: 0.0607, lng: 34.2881 },
  Migori: { lat: -1.0634, lng: 34.4731 },
  Kisii: { lat: -0.6817, lng: 34.7667 },
  Bondo: { lat: -0.0987, lng: 34.2747 },
  "Kendu Bay": { lat: -0.36, lng: 34.64 },
  Mbita: { lat: -0.432, lng: 34.205 },
  Nakuru: { lat: -0.3031, lng: 36.08 },
  Eldoret: { lat: 0.5143, lng: 35.2698 },
  Mombasa: { lat: -4.0435, lng: 39.6682 },
  Nairobi: { lat: -1.2921, lng: 36.8219 },
  London: { lat: 51.5074, lng: -0.1278 },
};

function valid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** About 1 km. The exact position never reaches the server or the URL. */
export function roundCoord(value: number) {
  return Math.round(value * 100) / 100;
}

/** "?near=-0.09,34.77" to a point, or null for anything else. */
export function parseNear(value: string | null | undefined): LatLng | null {
  const match = /^\s*(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(value ?? "");
  if (!match) return null;
  const lat = roundCoord(Number(match[1]));
  const lng = roundCoord(Number(match[2]));
  return valid(lat, lng) ? { lat, lng } : null;
}

export function nearParam(point: LatLng) {
  return `${roundCoord(point.lat).toFixed(2)},${roundCoord(point.lng).toFixed(2)}`;
}

export function haversineKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Shop pin first, then its town centre, else null (unknown place sorts last). */
export function shopPoint(shop: { latitude?: number | null; longitude?: number | null; city: string }): LatLng | null {
  if (shop.latitude != null && shop.longitude != null && valid(shop.latitude, shop.longitude)) {
    return { lat: shop.latitude, lng: shop.longitude };
  }
  const town = canonicalCity(shop.city);
  return town ? TOWN_CENTROIDS[town] : null;
}

export function distanceToShop(from: LatLng, shop: { latitude?: number | null; longitude?: number | null; city: string }) {
  const point = shopPoint(shop);
  return point ? Math.round(haversineKm(from, point) * 10) / 10 : null;
}

/** Nearest first. Unknown places keep their order at the end. */
export function sortByDistance<T extends { distanceKm: number | null }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const da = a.row.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.row.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db || a.index - b.index;
    })
    .map(({ row }) => row);
}

/** "In town" under 3 km, then whole km. */
export function distanceLabel(km: number | null | undefined) {
  if (km == null) return "";
  if (km < 3) return "In your town";
  if (km < 100) return `About ${Math.round(km)} km away`;
  return `About ${Math.round(km / 10) * 10} km away`;
}
