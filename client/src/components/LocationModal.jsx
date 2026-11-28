import { useEffect, useRef, useState } from 'react';
import { checkServiceability } from '../services/api';
import {
  detectCurrentDeliveryLocation,
  isValidIndianPin
} from '../utils/detectLocation';

const GPS_ERRORS = {
  0: 'This browser does not support GPS. Enter a pincode instead.',
  1: 'Location permission denied. Allow location access in your browser settings, then try again.',
  2: 'GPS unavailable. Turn on device location / Wi‑Fi, or enter a pincode.',
  3: 'GPS timed out. Move near a window or outdoors and try again, or enter a pincode.',
  insecure: 'GPS needs HTTPS (or localhost). Use pincode instead.',
  coarse: 'Could not get a precise GPS fix. Enable device location, or enter your pincode.',
  no_pin: 'Location found but pincode could not be matched. Enter PIN manually.'
};

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

export default function LocationModal({ open, location, onSelect, onClose, autoDetect = false }) {
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsMessage, setGpsMessage] = useState('');
  const [pincode, setPincode] = useState('');
  const [pinStatus, setPinStatus] = useState('idle');
  const [pinMessage, setPinMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const cancelledRef = useRef(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      autoStartedRef.current = false;
      return undefined;
    }
    cancelledRef.current = false;
    setGpsStatus('idle');
    setGpsMessage('');
    setPinStatus('idle');
    setPinMessage('');
    setPreview(null);
    setPincode(isValidIndianPin(location?.pincode) ? location.pincode : '');
    return () => {
      cancelledRef.current = true;
    };
  }, [open, location?.pincode]);

  useEffect(() => {
    if (!open || !autoDetect || autoStartedRef.current) return;
    autoStartedRef.current = true;
    detectGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoDetect]);

  if (!open) return null;

  const confirm = async (payload) => {
    if (!isValidIndianPin(payload.pincode)) return;
    let serviceable = null;
    try {
      const res = await checkServiceability(payload.pincode);
      serviceable = res?.data?.serviceable ?? res?.serviceable ?? null;
    } catch {
      serviceable = null;
    }
    onSelect({
      pincode: payload.pincode,
      area: payload.area,
      city: payload.city,
      state: payload.state || '',
      lat: Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : null,
      lng: Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : null,
      radiusKm: 5,
      accuracyM: payload.accuracyM,
      source: payload.source || 'manual',
      confirmedAt: Date.now(),
      detecting: false,
      serviceable
    });
    onClose();
  };

  const detectGps = async () => {
    setGpsStatus('loading');
    setGpsMessage('Getting a precise GPS fix…');
    setPreview(null);

    try {
      const next = await detectCurrentDeliveryLocation();
      if (cancelledRef.current) return;

      setPreview(next);
      setPincode(next.pincode || '');
      setGpsStatus('success');
      if (!next.pincode) {
        setGpsMessage('Location found, but PIN was unclear. Enter your 6-digit pincode below.');
      } else if (next.accuracyM > 150) {
        setGpsMessage(
          `Detected PIN ${next.pincode} (±${next.accuracyM}m). Confirm or pick a nearby PIN if this looks wrong.`
        );
      } else {
        setGpsMessage(
          next.distanceKm != null
            ? `Matched India Post PIN ${next.pincode} (~${next.distanceKm} km from postal centroid).`
            : `Detected PIN ${next.pincode}.`
        );
      }
    } catch (err) {
      if (cancelledRef.current) return;
      setGpsStatus('error');
      const msg = String(err?.message || '');
      const timedOut = /timeout/i.test(msg);
      setGpsMessage(
        GPS_ERRORS[err?.code] ||
          (timedOut
            ? 'Request timed out. Check that the API is running, then try Get My Pincode again.'
            : msg || 'Could not get GPS location.')
      );
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
        lat: keepGps
          ? preview.lat
          : Number.isFinite(Number(location?.lat))
            ? Number(location.lat)
            : null,
        lng: keepGps
          ? preview.lng
          : Number.isFinite(Number(location?.lng))
            ? Number(location.lng)
            : null,
        accuracyM: keepGps ? preview.accuracyM : undefined,
        pinConfidence: 'high',
        alternates: [],
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

  const pickAlternate = async (pin) => {
    setPincode(pin);
    setPinStatus('loading');
    try {
      const found = await lookupPincode(pin);
      setPreview((prev) => ({
        ...(prev || {}),
        ...found,
        pincode: pin,
        lat: prev?.lat ?? location?.lat,
        lng: prev?.lng ?? location?.lng,
        accuracyM: prev?.accuracyM,
        alternates: (prev?.alternates || []).filter((a) => a.pincode !== pin),
        pinConfidence: 'medium',
        source: prev?.source === 'gps' ? 'gps' : 'pincode'
      }));
      setPinStatus('success');
      setPinMessage(`Switched to nearby PIN ${pin}. Confirm below.`);
    } catch (err) {
      setPinStatus('error');
      setPinMessage(err.message || 'Could not switch PIN');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Delivery location</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Get My Pincode from GPS (India Post match), or enter PIN
            </p>
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
                <span>Detecting your pincode</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-bounce" />
                </span>
              </span>
            ) : (
              'Get My Pincode'
            )}
          </button>

          {gpsMessage && gpsStatus !== 'loading' ? (
            <p
              className={`text-[11px] font-semibold rounded-xl px-3 py-2 border ${
                gpsStatus === 'error'
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
                placeholder="6-digit PIN"
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
                  {preview.accuracyM ? (
                    <span className="ml-2 font-semibold text-slate-400">
                      · GPS ±{preview.accuracyM}m
                    </span>
                  ) : null}
                </p>
              </div>

              {Array.isArray(preview.alternates) && preview.alternates.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                    Nearby PINs (if yours looks wrong)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {preview.alternates.map((a) => (
                      <button
                        key={a.pincode}
                        type="button"
                        onClick={() => pickAlternate(a.pincode)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
                      >
                        {a.pincode}
                        {a.distanceKm != null ? (
                          <span className="ml-1 font-semibold text-slate-400">
                            {a.distanceKm}km
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

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
