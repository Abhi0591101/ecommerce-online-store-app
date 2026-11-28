import { reverseGeocode } from '../services/api';
import { EMPTY_LOCATION } from '../data/defaults';

export const isValidIndianPin = (pin) => /^[1-9]\d{5}$/.test(String(pin || ''));

/** True when location is missing / not a real user-confirmed delivery PIN */
export const isFallbackLocation = (loc) => {
  if (!loc) return true;
  if (!isValidIndianPin(loc.pincode)) return true;
  // Legacy hardcoded Noida bootstrap (pre-GPS) — treat as unset
  if (
    loc.pincode === '201301' &&
    !loc.confirmedAt &&
    Number(loc.lat) === 28.628 &&
    Number(loc.lng) === 77.3649
  ) {
    return true;
  }
  return false;
};

export const hasUsableDeliveryLocation = (loc) =>
  Boolean(loc && isValidIndianPin(loc.pincode) && !loc.detecting && !isFallbackLocation(loc));

/**
 * Wait for a precise GPS fix (reject coarse IP/Wi‑Fi guesses when possible).
 */
export function captureBestPosition({
  timeoutMs = 15000,
  minSamples = 2,
  targetAccuracyM = 80
} = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 0 }));
      return;
    }

    let best = null;
    let samples = 0;
    let settled = false;
    let watchId = null;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(err || Object.assign(new Error('timeout'), { code: 3 }));
    };

    const consider = (pos) => {
      samples += 1;
      if (!best || pos.coords.accuracy < best.coords.accuracy) {
        best = pos;
      }
      // Street-level fix — good enough for PIN matching
      if (pos.coords.accuracy > 0 && pos.coords.accuracy <= targetAccuracyM) {
        finish();
        return;
      }
      // Accept after enough samples if reasonably accurate
      if (samples >= minSamples && best && best.coords.accuracy <= 150) {
        finish();
      }
    };

    watchId = navigator.geolocation.watchPosition(
      consider,
      (err) => {
        if (best) finish();
        else finish(err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs
      }
    );

    navigator.geolocation.getCurrentPosition(consider, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: timeoutMs
    });

    const timer = setTimeout(() => finish(), timeoutMs);
  });
}

/**
 * GPS → server reverse geocode → delivery location payload
 */
export async function detectCurrentDeliveryLocation(options = {}) {
  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    const err = new Error('GPS needs HTTPS (or localhost)');
    err.code = 'insecure';
    throw err;
  }
  if (!navigator.geolocation) {
    const err = new Error('Geolocation unsupported');
    err.code = 0;
    throw err;
  }

  const pos = await captureBestPosition({
    timeoutMs: options.timeoutMs ?? 15000,
    minSamples: options.minSamples ?? 2,
    targetAccuracyM: options.targetAccuracyM ?? 80
  });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const accuracyM = Math.round(pos.coords.accuracy || 0);

  if (accuracyM > 5000) {
    const err = new Error('GPS fix too coarse');
    err.code = 'coarse';
    err.accuracyM = accuracyM;
    throw err;
  }

  const res = await reverseGeocode(lat, lng);
  const geo = res?.data || res || {};
  const pincode = isValidIndianPin(geo.pincode) ? geo.pincode : '';

  if (!pincode) {
    const err = new Error('Could not resolve pincode from GPS');
    err.code = 'no_pin';
    throw err;
  }

  return {
    pincode,
    area: geo.area || geo.displayName?.split(',')[0] || 'Current GPS location',
    city: geo.city || '',
    state: geo.state || '',
    displayName: geo.displayName || '',
    lat,
    lng,
    radiusKm: 5,
    accuracyM,
    pinConfidence: geo.pinConfidence || 'medium',
    alternates: geo.alternates || [],
    distanceKm: geo.distanceKm,
    source: 'gps'
  };
}

export { EMPTY_LOCATION };
