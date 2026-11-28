/**
 * Resolve Indian PIN from GPS via nearest India Post office
 * (same approach as pincodeindia nearest-office lookup).
 * Office coord clusters / bad geoQuality are demoted so polluted
 * BO dumps and skewed centroids don't steal the PIN.
 */
const pinGeo = require('@devzoy/indian-pincode-geo');

const isValidIndianPin = (pin) => /^[1-9]\d{5}$/.test(String(pin || ''));

const normalizePin = (raw) => {
  if (!raw) return '';
  const matches = String(raw).match(/\d{6}/g) || [];
  return matches.find(isValidIndianPin) || '';
};

const toRad = (d) => (d * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const coordKey = (lat, lng) =>
  `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;

/**
 * Score nearest India Post offices. Lower = better.
 * Mirrors pincodeindia `/api/nearest` (nearest office → PIN) with
 * extra guards against duplicated/wrong BO coordinates in open data.
 */
function scoreNearbyOffices(lat, lng, { radiusKm = 12, limit = 80 } = {}) {
  const nearby = pinGeo.findNearby(lat, lng, { radiusKm, limit }) || [];
  if (!nearby.length) return [];

  const clusterCounts = {};
  for (const o of nearby) {
    if (o.latitude == null || o.longitude == null) continue;
    const k = coordKey(o.latitude, o.longitude);
    clusterCounts[k] = (clusterCounts[k] || 0) + 1;
  }

  return nearby
    .filter(
      (o) =>
        isValidIndianPin(o.pincode) &&
        Number.isFinite(o.latitude) &&
        Number.isFinite(o.longitude) &&
        typeof o.distanceKm === 'number' &&
        o.distanceKm <= radiusKm
    )
    .map((o) => {
      const cluster = clusterCounts[coordKey(o.latitude, o.longitude)] || 1;
      const isBo = String(o.officeType || '').toUpperCase() === 'BO';
      const isDelivery = String(o.deliveryStatus || '') === 'Delivery';
      const geoOk = !o.geoQuality || o.geoQuality === 'original';

      let score = o.distanceKm;
      // Prefer Sub/Head offices over Branch Offices (BOs often share dump coords)
      if (isBo) score += 0.85;
      // Mild preference for Delivery offices (Non-Delivery SO can still be correct area)
      if (!isDelivery) score += 0.35;
      if (!geoOk) score += 2.2;
      // Many different offices stacked on one lat/lng = polluted data
      if (cluster >= 4) score += 3.5;
      else if (cluster >= 3) score += 2.2;

      return {
        pincode: String(o.pincode),
        officeName: o.officeName || '',
        officeType: o.officeType || '',
        deliveryStatus: o.deliveryStatus || '',
        district: o.district || '',
        state: o.state || '',
        latitude: o.latitude,
        longitude: o.longitude,
        distanceKm: Math.round(o.distanceKm * 1000) / 1000,
        geoQuality: o.geoQuality || '',
        cluster,
        score: Math.round(score * 1000) / 1000
      };
    })
    .sort((a, b) => a.score - b.score || a.distanceKm - b.distanceKm);
}

function resolvePinFromGps(lat, lng, providerPins = []) {
  const scored = scoreNearbyOffices(lat, lng);
  const hintPins = [
    ...new Set(
      (providerPins || []).map(normalizePin).filter(isValidIndianPin)
    )
  ];

  // Ignore OSM/BDC/Google postal_code for *selection* — those hints are often
  // wrong in India and were flipping 243006 → 243005/243122. Nearest office wins.
  // Provider pins are still surfaced as alternates below for manual correction.
  const best = scored[0] || null;
  if (best && hintPins.includes(best.pincode)) {
    best.fromProviderHint = true;
  }

  // Fallback: PIN centroid reverseLookup when no usable office nearby
  if (!best) {
    const nearest = pinGeo.reverseLookup(lat, lng);
    if (
      !nearest?.pincode ||
      !isValidIndianPin(nearest.pincode) ||
      (typeof nearest.distanceKm === 'number' && nearest.distanceKm > 20)
    ) {
      return null;
    }
    const offices = pinGeo.lookup(nearest.pincode) || [];
    const deliveryOffice =
      offices.find((o) => o.deliveryStatus === 'Delivery' && o.officeType !== 'BO') ||
      offices.find((o) => o.deliveryStatus === 'Delivery') ||
      offices[0] ||
      null;
    return {
      pincode: String(nearest.pincode),
      distanceKm: Math.round((Number(nearest.distanceKm) || 0) * 1000) / 1000,
      pinConfidence: 'low',
      sources: ['india-post-centroid-fallback'],
      officeName: deliveryOffice?.officeName || '',
      district: deliveryOffice?.district || '',
      state: deliveryOffice?.state || '',
      alternates: []
    };
  }

  // Unique alternate PINs from next-best offices
  const seen = new Set([best.pincode]);
  const alternates = [];
  for (const o of scored) {
    if (seen.has(o.pincode)) continue;
    seen.add(o.pincode);
    alternates.push({
      pincode: o.pincode,
      distanceKm: o.distanceKm,
      officeName: o.officeName
    });
    if (alternates.length >= 4) break;
  }

  // Also surface provider-hint pins as alternates if missing
  for (const tip of hintPins) {
    if (seen.has(tip)) continue;
    const tipOffice = scored.find((o) => o.pincode === tip);
    alternates.push({
      pincode: tip,
      distanceKm: tipOffice?.distanceKm ?? null,
      officeName: tipOffice?.officeName || ''
    });
    seen.add(tip);
    if (alternates.length >= 4) break;
  }

  const pinConfidence =
    best.distanceKm <= 1.2
      ? 'high'
      : best.distanceKm <= 3.5
        ? 'medium'
        : 'low';

  return {
    pincode: best.pincode,
    distanceKm: best.distanceKm,
    pinConfidence,
    sources: best.fromProviderHint
      ? ['india-post-nearest-office', 'provider-pin-hint']
      : ['india-post-nearest-office'],
    officeName: best.officeName,
    district: best.district,
    state: best.state,
    officeType: best.officeType,
    deliveryStatus: best.deliveryStatus,
    alternates
  };
}

module.exports = {
  isValidIndianPin,
  normalizePin,
  haversineKm,
  scoreNearbyOffices,
  resolvePinFromGps
};
