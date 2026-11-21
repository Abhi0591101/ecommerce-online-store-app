import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '../services/api';


const GPS_ERRORS = {
  1: 'Location permission denied. Allow location access in your browser settings, then try again.',
  2: 'GPS unavailable. Turn on device location / Wi‑Fi, or enter a pincode.',
  3: 'GPS timed out. Move near a window or outdoors and try again, or enter a pincode.'
};

const isValidIndianPin = (pin) => /^[1-9]\d{5}$/.test(String(pin || ''));

async function lookupPincode(pin) {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  if (!res.ok) throw new Error('Pincode lookup failed');
  const data = await res.json();
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry || entry.Status !== 'Success' || !entry.PostOffice?.length) {
    throw new Error('No area found for this pincode');
  }
  const office = entry.PostOffice[0];
  return {
    pincode: pin,
    area: office.Name || office.Block || office.District,
    city: office.District || office.Block || office.State,
    state: office.State || ''
  };
}

/**
 * Collect several GPS samples and keep the most accurate one.
 * Desktop browsers often return a coarse IP location first — we wait for a better fix.
 */
function captureBestPosition({ timeoutMs = 12000, minSamples = 2 } = {}) {
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
      // Good enough for delivery (~street level)
      if (pos.coords.accuracy > 0 && pos.coords.accuracy <= 80 && samples >= 1) {
        finish();
      } else if (samples >= minSamples && best && best.coords.accuracy <= 150) {
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

    // Also kick an immediate reading
    navigator.geolocation.getCurrentPosition(consider, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: timeoutMs
    });

    const timer = setTimeout(() => finish(), timeoutMs);
  });
}

export default function LocationModal({ open, location, onSelect, onClose }) {
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsMessage, setGpsMessage] = useState('');
  const [pincode, setPincode] = useState('');
  const [pinStatus, setPinStatus] = useState('idle');
  const [pinMessage, setPinMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    cancelledRef.current = false;
    setGpsStatus('idle');
    setGpsMessage('');
    setPinStatus('idle');
    setPinMessage('');
    setPreview(null);
    setPincode('');
    return () => {
      cancelledRef.current = true;
    };
  }, [open]);

  if (!open) return null;

  const confirm = (payload) => {
    if (!isValidIndianPin(payload.pincode)) return;
    onSelect({
      pincode: payload.pincode,
      area: payload.area,
      city: payload.city,
      state: payload.state || '',
      lat: Number(payload.lat),
      lng: Number(payload.lng),
      radiusKm: 5,
      source: payload.source
    });
    onClose();
  };

  const detectGps = async () => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setGpsStatus('error');
      setGpsMessage('GPS needs HTTPS (or localhost). Use pincode instead.');
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      setGpsMessage('This browser does not support GPS. Enter a pincode instead.');
      return;
    }

    setGpsStatus('loading');
    setGpsMessage('');
    setPreview(null);

    try {
      const pos = await captureBestPosition({ timeoutMs: 14000, minSamples: 2 });
      if (cancelledRef.current) return;

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracyM = Math.round(pos.coords.accuracy || 0);

      // Coarse network/IP location — do not trust for delivery pin
      if (accuracyM > 2500) {
        setGpsStatus('error');
        setGpsMessage('Could not get a precise GPS fix. Enable device location, or enter your pincode.');
        return;
      }

      const res = await reverseGeocode(lat, lng);
      if (cancelledRef.current) return;
      const geo = res.data || {};

      const next = {
        area: geo.area || geo.displayName?.split(',')[0] || 'Current GPS location',
        city: geo.city || '',
        state: geo.state || '',
        pincode: isValidIndianPin(geo.pincode) ? geo.pincode : '',
        displayName: geo.displayName || '',
        lat,
        lng,
        accuracyM,
        pinConfidence: geo.pinConfidence || 'none',
        source: 'gps'
      };

      setPreview(next);
      setPincode(next.pincode);
      setGpsStatus('success');
      setGpsMessage(
        !next.pincode ? 'Enter your pincode below to continue.' : ''
      );
    } catch (err) {
      if (cancelledRef.current) return;
      setGpsStatus('error');
      setGpsMessage(GPS_ERRORS[err?.code] || err?.message || 'Could not get GPS location.');
    }
  };

  const applyPincode = async () => {
    const pin = pincode.trim();
    if (!isValidIndianPin(pin)) {
      setPinStatus('error');
      setPinMessage('Enter a valid 6-digit Indian pincode.');
      return;
    }
    setPinStatus('loading');
    setPinMessage('Looking up pincode…');
    try {
      const found = await lookupPincode(pin);
      const keepGps =
        preview?.source === 'gps' &&
        Number.isFinite(Number(preview.lat)) &&
        Number.isFinite(Number(preview.lng));

      const next = {
        area: keepGps && preview.area ? preview.area : found.area,
        city: keepGps && preview.city ? preview.city : found.city,
        state: keepGps && preview.state ? preview.state : found.state,
        pincode: pin,
        displayName: keepGps ? preview.displayName : '',
        // Always keep real GPS coordinates when available
        lat: keepGps ? preview.lat : location?.lat ?? 28.628,
        lng: keepGps ? preview.lng : location?.lng ?? 77.3649,
        accuracyM: keepGps ? preview.accuracyM : undefined,
        pinConfidence: 'high',
        source: keepGps ? 'gps' : 'pincode'
      };
      setPreview(next);
      setPinStatus('success');
      setPinMessage('Pincode verified. Confirm below.');
    } catch (err) {
      setPinStatus('error');
      setPinMessage(err.message || 'Pincode not found.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Delivery location</h3>
            <p className="text-xs text-slate-500 mt-0.5">Precise GPS, then confirm your pincode</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          <button
            type="button"
            onClick={detectGps}
            disabled={gpsStatus === 'loading'}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white text-sm font-bold transition"
            aria-live="polite"
          >
            {gpsStatus === 'loading' ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span>Detecting the location</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce" />
                </span>
              </span>
            ) : (
              'Use current location'
            )}
          </button>

          {gpsMessage && gpsStatus !== 'loading' ? (
            <p
              className={`text-[11px] font-semibold rounded-xl px-3 py-2 border ${
                gpsStatus === 'error' || gpsStatus === 'unsupported'
                  ? 'text-rose-700 bg-rose-50 border-rose-100'
                  : 'text-slate-600 bg-slate-50 border-slate-100'
              }`}
            >
              {gpsMessage}
            </p>
          ) : null}

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Pincode
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={pincode}
                onChange={(e) => {
                  setPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setPinStatus('idle');
                  setPinMessage('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPincode();
                  }
                }}
                placeholder="e.g. 201301"
                inputMode="numeric"
                maxLength={6}
                className="flex-1 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <button
                type="button"
                onClick={applyPincode}
                disabled={pinStatus === 'loading'}
                className="px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-70 text-white text-sm font-bold"
              >
                {pinStatus === 'loading' ? '…' : 'Find'}
              </button>
            </div>
            {pinMessage ? (
              <p
                className={`mt-2 text-[11px] font-semibold px-3 py-2 rounded-xl border ${
                  pinStatus === 'error'
                    ? 'text-rose-600 bg-rose-50 border-rose-100'
                    : 'text-slate-600 bg-slate-50 border-slate-100'
                }`}
              >
                {pinMessage}
              </p>
            ) : null}
          </div>

          {preview ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Detected location
                </p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{preview.area}</p>
                {preview.displayName ? (
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{preview.displayName}</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[preview.city, preview.state].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-[11px] font-bold text-slate-700 mt-2">
                  PIN {preview.pincode || '— not detected'}
                </p>
              </div>

              {!isValidIndianPin(preview.pincode) ? (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 font-semibold">
                  Enter the correct 6-digit pincode above and tap Find before confirming.
                </p>
              ) : null}

              <button
                type="button"
                disabled={!isValidIndianPin(preview.pincode)}
                onClick={() => confirm(preview)}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold"
              >
                {isValidIndianPin(preview.pincode) ? 'Deliver here' : 'Add pincode to continue'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
