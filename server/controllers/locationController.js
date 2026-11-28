const ServiceArea = require('../models/ServiceArea');
const {
  isValidIndianPin,
  normalizePin,
  resolvePinFromGps
} = require('../utils/pinFromGps');

async function fetchJson(url, headers = {}, timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HyperLocalGroceryApp/1.0 (local-dev; reverse-geocode)',
        ...headers
      }
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve settled promise value or null */
const settledValue = (result) =>
  result?.status === 'fulfilled' ? result.value : null;

/** Google Geocoding — same quality as Google Maps when API key is set */
async function googleReverse(lat, lng, apiKey) {
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat},${lng}&language=en&region=in&key=${apiKey}`;
  const data = await fetchJson(url);
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.error_message || data.status || 'Google geocode failed');
  }

  // Prefer a result that includes postal_code
  const ranked = [...data.results].sort((a, b) => {
    const aPin = a.address_components?.some((c) => c.types.includes('postal_code')) ? 1 : 0;
    const bPin = b.address_components?.some((c) => c.types.includes('postal_code')) ? 1 : 0;
    return bPin - aPin;
  });

  const result = ranked[0];
  const comps = result.address_components || [];
  const get = (...types) => {
    const hit = comps.find((c) => types.some((t) => c.types.includes(t)));
    return hit?.long_name || '';
  };

  return {
    provider: 'google',
    displayName: result.formatted_address || '',
    area:
      get('sublocality_level_1', 'sublocality', 'neighborhood', 'route') ||
      get('locality') ||
      '',
    city: get('locality', 'administrative_area_level_3', 'administrative_area_level_2') || '',
    state: get('administrative_area_level_1') || '',
    pincode: normalizePin(get('postal_code')),
    pinConfidence: normalizePin(get('postal_code')) ? 'high' : 'none'
  };
}

/** Street/locality label from OSM (postcode is only a soft candidate) */
async function nominatimLabel(lat, lng) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&countrycodes=in`;
    const data = await fetchJson(url);
    const a = data.address || {};
    return {
      area:
        a.suburb ||
        a.neighbourhood ||
        a.residential ||
        a.quarter ||
        a.city_district ||
        a.road ||
        data.name ||
        '',
      city: a.city || a.town || a.village || a.municipality || a.state_district || '',
      state: a.state || '',
      displayName: data.display_name || '',
      postcode: normalizePin(a.postcode)
    };
  } catch {
    return null;
  }
}

/** Free browser-friendly reverse geocode (postcode as soft candidate only) */
async function bigDataCloudLabel(lat, lng) {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const data = await fetchJson(url);
    return {
      area: data.locality || data.city || data.principalSubdivision || '',
      city: data.city || data.locality || '',
      state: data.principalSubdivision || '',
      displayName: [data.locality, data.city, data.principalSubdivision, data.countryName]
        .filter(Boolean)
        .join(', '),
      postcode: normalizePin(data.postcode)
    };
  } catch {
    return null;
  }
}

async function indiaPostOfficeNames(pin) {
  try {
    const data = await fetchJson(`https://api.postalpincode.in/pincode/${pin}`);
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry || entry.Status !== 'Success' || !entry.PostOffice?.length) return null;
    const office = entry.PostOffice[0];
    return {
      area: office.Name || office.Block || office.District,
      city: office.District || office.Block || office.State,
      state: office.State || ''
    };
  } catch {
    return null;
  }
}

const getLocations = async (req, res, next) => {
  try {
    const { city, q } = req.query;
    const filter = { isActive: true };
    if (city) filter.city = new RegExp(`^${city}$`, 'i');
    if (q) {
      filter.$or = [
        { area: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
        { pincode: new RegExp(q, 'i') },
        { state: new RegExp(q, 'i') }
      ];
    }

    const locations = await ServiceArea.find(filter).sort({ displayOrder: 1, city: 1 });
    const defaultLoc = locations.find((l) => l.isDefault) || locations[0] || null;

    res.json({
      success: true,
      data: locations,
      defaultLocation: defaultLoc
        ? {
            pincode: defaultLoc.pincode,
            area: defaultLoc.area,
            city: defaultLoc.city,
            lat: defaultLoc.lat,
            lng: defaultLoc.lng,
            radiusKm: 5,
            state: defaultLoc.state
          }
        : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/locations/reverse?lat=&lng=
 * Fast path: offline India Post PIN (instant). Labels from OSM/BDC are best-effort
 * with a short timeout so the client never hits axios 12s timeout.
 */
const reverseGeocode = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng required' });
    }
    if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      return res.status(422).json({
        success: false,
        message: 'Coordinates are outside India. Enable device GPS or enter pincode manually.'
      });
    }

    // 1) Instant PIN from nearest India Post office (local dataset)
    let pinHit = resolvePinFromGps(lat, lng, []);

    // 2) Soft labels / optional pin hints — never block more than ~2.2s total
    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
    const labelJobs = [
      nominatimLabel(lat, lng),
      bigDataCloudLabel(lat, lng)
    ];
    if (googleKey) {
      labelJobs.push(
        googleReverse(lat, lng, googleKey).catch((err) => {
          console.warn('[reverse] Google geocode failed:', err.message);
          return null;
        })
      );
    }

    const settled = await Promise.allSettled(labelJobs);
    const osm = settledValue(settled[0]);
    const bdc = settledValue(settled[1]);
    const google = settledValue(settled[2]) || null;

    const providerPins = [
      google?.pincode,
      osm?.postcode,
      bdc?.postcode
    ].filter(Boolean);

    // Re-score with soft provider hints (still offline / fast)
    if (providerPins.length) {
      pinHit = resolvePinFromGps(lat, lng, providerPins) || pinHit;
    }

    // Prefer nearest India Post office label for area (matches PIN selection)
    let area =
      pinHit?.officeName ||
      google?.area ||
      osm?.area ||
      bdc?.area ||
      'Current GPS location';
    let city =
      pinHit?.district ||
      google?.city ||
      osm?.city ||
      bdc?.city ||
      '';
    let state =
      pinHit?.state ||
      google?.state ||
      osm?.state ||
      bdc?.state ||
      '';
    let displayName = pinHit
      ? `${pinHit.officeName || area}, ${pinHit.district || city}, ${pinHit.state || state} ${pinHit.pincode}`
          .replace(/\s+/g, ' ')
          .trim()
      : google?.displayName || osm?.displayName || bdc?.displayName || '';

    const pincode = pinHit?.pincode || '';

    // Optional live office name — short timeout, ignore failures
    if (isValidIndianPin(pincode) && (!city || !state || area === pinHit?.officeName)) {
      const office = await indiaPostOfficeNames(pincode).catch(() => null);
      if (office) {
        if (!city) city = office.city;
        if (!state) state = office.state;
        if (!area || area === 'Current GPS location') area = office.area;
      }
    }

    res.json({
      success: true,
      data: {
        area: area || 'Current GPS location',
        city: city || '',
        state: state || '',
        pincode: isValidIndianPin(pincode) ? pincode : '',
        displayName: displayName || '',
        lat,
        lng,
        pinConfidence: isValidIndianPin(pincode) ? pinHit?.pinConfidence || 'medium' : 'none',
        distanceKm: pinHit?.distanceKm,
        alternates: pinHit?.alternates || [],
        provider: pinHit
          ? pinHit.sources?.[0] || 'india-post-nearest-office'
          : 'none',
        usedGoogle: Boolean(google),
        sources: pinHit?.sources || []
      }
    });
  } catch (error) {
    next(error);
  }
};

const createLocation = async (req, res, next) => {
  try {
    const { pincode, area, city, state, lat, lng, tag, isDefault, displayOrder } = req.body;
    if (!pincode || !area || !city || !state || lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: 'pincode, area, city, state, lat, lng required'
      });
    }

    if (isDefault) {
      await ServiceArea.updateMany({}, { isDefault: false });
    }

    const loc = await ServiceArea.create({
      pincode,
      area,
      city,
      state,
      lat: Number(lat),
      lng: Number(lng),
      tag: tag || '',
      isDefault: !!isDefault,
      displayOrder: displayOrder != null ? Number(displayOrder) : 0,
      isActive: true
    });

    res.status(201).json({ success: true, data: loc });
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    if (req.body.isDefault) {
      await ServiceArea.updateMany({}, { isDefault: false });
    }
    const loc = await ServiceArea.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!loc) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }
    res.json({ success: true, data: loc });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLocations, reverseGeocode, createLocation, updateLocation };
