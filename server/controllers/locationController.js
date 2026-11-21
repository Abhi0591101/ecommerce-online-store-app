const ServiceArea = require('../models/ServiceArea');
const pinGeo = require('@devzoy/indian-pincode-geo');

const isValidIndianPin = (pin) => /^[1-9]\d{5}$/.test(String(pin || ''));

const normalizePin = (raw) => {
  if (!raw) return '';
  const matches = String(raw).match(/\d{6}/g) || [];
  return matches.find(isValidIndianPin) || '';
};

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'HyperLocalGroceryApp/1.0 (local-dev; reverse-geocode)',
      ...headers
    }
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  return res.json();
}

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

/** India Post official geo dataset — nearest pincode to GPS (offline) */
function indiaPostReverse(lat, lng) {
  const nearest = pinGeo.reverseLookup(lat, lng);
  if (!nearest?.pincode || !isValidIndianPin(nearest.pincode)) {
    return null;
  }

  // Reject if nearest pin centroid is unreasonably far (bad GPS / outside coverage)
  if (typeof nearest.distanceKm === 'number' && nearest.distanceKm > 12) {
    return null;
  }

  const nearby = pinGeo.findNearby(lat, lng, { radiusKm: 3, limit: 5 }) || [];
  const closestOffice = nearby[0];
  const offices = pinGeo.lookup(nearest.pincode) || [];
  const office = closestOffice || offices[0];

  return {
    provider: 'india-post-geo',
    displayName: office
      ? `${office.officeName || ''}, ${office.district || ''}, ${office.state || ''} ${nearest.pincode}`
          .replace(/\s+/g, ' ')
          .trim()
      : `PIN ${nearest.pincode}`,
    area: office?.officeName || `PIN ${nearest.pincode}`,
    city: office?.district || '',
    state: office?.state || '',
    pincode: String(nearest.pincode),
    pinConfidence: nearest.distanceKm != null && nearest.distanceKm <= 2 ? 'high' : 'medium',
    distanceKm: nearest.distanceKm
  };
}

/** Street/locality label from OSM (pincode often wrong — used only for area name) */
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
      osmPin: normalizePin(a.postcode)
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
 * 1) Google Geocoding (if GOOGLE_MAPS_API_KEY set) — same as Google Maps
 * 2) Else India Post official geo reverseLookup for correct Indian PIN
 * 3) OSM for street/locality label only
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

    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
    let resolved = null;

    if (googleKey) {
      try {
        resolved = await googleReverse(lat, lng, googleKey);
      } catch (err) {
        console.warn('[reverse] Google geocode failed:', err.message);
      }
    }

    // Authoritative Indian PIN from official postal geo dataset
    const indiaPin = indiaPostReverse(lat, lng);
    const osm = await nominatimLabel(lat, lng);

    if (!resolved) {
      resolved = {
        provider: indiaPin?.provider || 'fallback',
        displayName: osm?.displayName || indiaPin?.displayName || '',
        area: osm?.area || indiaPin?.area || 'Current GPS location',
        city: osm?.city || indiaPin?.city || '',
        state: osm?.state || indiaPin?.state || '',
        pincode: indiaPin?.pincode || '',
        pinConfidence: indiaPin?.pinConfidence || 'none'
      };
    } else {
      // If Google missed PIN (rare), fill from India Post geo
      if (!isValidIndianPin(resolved.pincode) && indiaPin?.pincode) {
        resolved.pincode = indiaPin.pincode;
        resolved.pinConfidence = indiaPin.pinConfidence;
        resolved.provider = `${resolved.provider}+india-post-geo`;
      }
      // Prefer local street label from OSM/Google area; enrich city/state from India Post if empty
      if (!resolved.city && indiaPin?.city) resolved.city = indiaPin.city;
      if (!resolved.state && indiaPin?.state) resolved.state = indiaPin.state;
    }

    // Enrich names from live India Post API when we have a PIN
    if (isValidIndianPin(resolved.pincode)) {
      const office = await indiaPostOfficeNames(resolved.pincode);
      if (office) {
        if (!resolved.city) resolved.city = office.city;
        if (!resolved.state) resolved.state = office.state;
        // Keep more specific locality/street as area when we have it
        if (!resolved.area || resolved.area === 'Current GPS location') {
          resolved.area = office.area;
        }
      }
    }

    res.json({
      success: true,
      data: {
        area: resolved.area || 'Current GPS location',
        city: resolved.city || '',
        state: resolved.state || '',
        pincode: isValidIndianPin(resolved.pincode) ? resolved.pincode : '',
        displayName: resolved.displayName || '',
        lat,
        lng,
        pinConfidence: isValidIndianPin(resolved.pincode)
          ? resolved.pinConfidence || 'medium'
          : 'none',
        provider: resolved.provider,
        usedGoogle: Boolean(googleKey && String(resolved.provider).includes('google'))
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
