/** Haversine distance between two WGS84 points, in kilometers. */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    [lat1, lon1, lat2, lon2].some(
      (v) => v === null || v === undefined || Number.isNaN(Number(v))
    )
  ) {
    return null;
  }

  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function estimateDeliveryMins(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return 25;
  return Math.max(15, Math.min(60, Math.round(15 + distanceKm * 4)));
}

export function withStoreDistances(stores = [], location) {
  if (!location?.lat || !location?.lng) return stores;
  return stores
    .map((store) => {
      const lat = store.lat ?? store.location?.coordinates?.[1];
      const lng = store.lng ?? store.location?.coordinates?.[0];
      const distanceKm = calculateDistanceKm(location.lat, location.lng, lat, lng);
      return {
        ...store,
        lat: lat ?? store.lat,
        lng: lng ?? store.lng,
        distanceKm,
        estDeliveryMins: estimateDeliveryMins(distanceKm)
      };
    })
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

export function formatDistanceKm(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return '—';
  return `${Number(distanceKm).toFixed(1)} km`;
}
