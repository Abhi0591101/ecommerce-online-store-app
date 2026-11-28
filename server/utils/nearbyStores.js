/**
 * Resolve approved stores that can serve the customer's delivery location
 * (radius + optional ServiceArea pin coverage + same city/pin).
 */
const Store = require('../models/Store');
const ServiceArea = require('../models/ServiceArea');
const { hasCompleteSellerKyc } = require('./storeVisibility');

const toRadians = (deg) => (deg * Math.PI) / 180;

const distanceKm = (lat1, lon1, lat2, lon2) => {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) {
    return null;
  }
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const hasLocationQuery = (q = {}) =>
  q.lat != null ||
  q.lng != null ||
  (q.pincode && String(q.pincode).trim()) ||
  (q.city && String(q.city).trim());

async function loadServicePins(pincode) {
  const pin = String(pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) return null;
  const area = await ServiceArea.findOne({
    isActive: true,
    pinCodeStatus: { $ne: 'rejected' },
    $or: [{ pincode: pin }, { pinCodes: pin }]
  }).lean();
  if (!area) return null;
  return new Set([area.pincode, ...(area.pinCodes || [])].filter(Boolean).map(String));
}

/**
 * @returns {{ storeIds: import('mongoose').Types.ObjectId[]|null, stores: object[], serviceable: boolean|null }}
 * storeIds null ⇒ no location filter requested (return all later)
 */
async function resolveNearbyStores(query = {}) {
  if (!hasLocationQuery(query)) {
    return { storeIds: null, stores: [], serviceable: null };
  }

  const userLat = query.lat != null && query.lat !== '' ? Number(query.lat) : null;
  const userLng = query.lng != null && query.lng !== '' ? Number(query.lng) : null;
  const maxRadius = Number(query.radiusKm) > 0 ? Number(query.radiusKm) : 40;
  const pincode = String(query.pincode || '').trim();
  const city = String(query.city || '').trim();
  const onlineOnly = query.onlineOnly !== 'false' && query.onlineOnly !== false;

  // Customer catalog: approved + active + online + complete KYC (docs)
  const filter = {
    status: 'approved',
    isActive: { $ne: false }
  };
  if (onlineOnly) filter.isOnline = true;

  const servicePins = pincode ? await loadServicePins(pincode) : null;
  // If ServiceArea exists for this PIN, area is serviceable; if PIN given but no area, still allow radius stores
  const serviceable = pincode ? (servicePins ? true : null) : null;

  let stores = await Store.find(filter).lean();

  stores = stores
    .filter((s) => hasCompleteSellerKyc(s))
    .map((s) => {
      const [sLng, sLat] = s.location?.coordinates || [s.lng, s.lat];
      const d =
        userLat != null && userLng != null && sLat != null && sLng != null
          ? distanceKm(userLat, userLng, sLat, sLng)
          : null;
      return { ...s, lat: sLat, lng: sLng, distanceKm: d != null ? Number(d.toFixed(1)) : null };
    })
    .filter((s) => {
      const inRadius = s.distanceKm != null && s.distanceKm <= maxRadius;
      const samePin = pincode && String(s.pincode) === pincode;
      const inServicePins = servicePins && servicePins.has(String(s.pincode));
      const sameCity =
        city && s.city && new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(s.city);

      if (userLat != null && userLng != null) {
        // Geo primary: within radius, or covered by ServiceArea pins, or exact PIN
        return inRadius || !!inServicePins || !!samePin;
      }
      if (servicePins) return !!inServicePins || !!samePin || !!sameCity;
      if (pincode) return !!samePin || !!sameCity;
      if (city) return !!sameCity;
      return true;
    })
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

  return {
    storeIds: stores.map((s) => s._id),
    stores,
    serviceable,
    servicePins: servicePins ? [...servicePins] : null
  };
}

module.exports = {
  hasLocationQuery,
  resolveNearbyStores,
  distanceKm
};
