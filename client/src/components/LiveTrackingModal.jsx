import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { trackDelivery } from '../services/api';
import { getSocket, joinOrderRoom, leaveOrderRoom } from '../services/socket';

const STEP_MS = 3000;

export default function LiveTrackingModal({ open, order, onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const bikeMarker = useRef(null);
  const animationRef = useRef(null);
  const liveOverride = useRef(false);
  const completedRef = useRef(false);
  const [etaMins, setEtaMins] = useState(8);
  const [etaStatus, setEtaStatus] = useState('Rider Rahul Sharma is on the way');
  const [otpCode, setOtpCode] = useState(order?.otpCode || order?.otp || '4821');
  const [driverName, setDriverName] = useState('Rahul Sharma');
  const [driverPlate, setDriverPlate] = useState('Hero Splendor (DL 3S AB 1234)');
  const [storeName, setStoreName] = useState(order?.storeName || 'Local Store');
  const [completed, setCompleted] = useState(false);
  const [simMode, setSimMode] = useState(true);

  useEffect(() => {
    if (!open || !order) return undefined;

    setOtpCode(order.otpCode || order.otp || '4821');
    setStoreName(order.storeName || 'Local Store');
    setCompleted(false);
    completedRef.current = false;
    setSimMode(true);
    liveOverride.current = false;
    setEtaMins(8);

    let cancelled = false;
    const orderRoomId = order.id || order._id || order.orderNumber;
    joinOrderRoom(orderRoomId);
    if (order.orderNumber && order.orderNumber !== orderRoomId) {
      joinOrderRoom(order.orderNumber);
    }

    const socket = getSocket();

    const onDriverLocation = (payload) => {
      if (!payload?.lat || !payload?.lng) return;
      liveOverride.current = true;
      setSimMode(false);
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      if (bikeMarker.current) {
        bikeMarker.current.setLatLng([payload.lat, payload.lng]);
        mapInstance.current?.panTo([payload.lat, payload.lng], { animate: true });
      }
      if (payload.etaMins != null) {
        setEtaMins(payload.etaMins);
        setEtaStatus(`Rider ${driverName} is on the way (${payload.etaMins} mins away)`);
      }
    };

    const onCompleted = () => {
      completedRef.current = true;
      setCompleted(true);
      setEtaMins(0);
      setEtaStatus('Order delivered successfully! 🎉');
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };

    socket.on('driver:location', onDriverLocation);
    socket.on('delivery:location', onDriverLocation);
    socket.on('order:completed', onCompleted);
    socket.on('delivery:completed', onCompleted);

    const hydrateFromApi = async () => {
      try {
        const res = await trackDelivery(order.orderNumber);
        const data = res?.data;
        if (!cancelled && data) {
          setOtpCode(data.otpCode || order.otpCode || order.otp || '4821');
          setDriverName(data.delivery?.driverName || 'Rahul Sharma');
          setDriverPlate(data.delivery?.driverVehicle || 'Hero Splendor (DL 3S AB 1234)');
          setStoreName(data.store?.name || order.storeName);
          const mins = data.delivery?.etaMins || 8;
          setEtaMins(mins);
          setEtaStatus(
            `Rider ${data.delivery?.driverName || 'Rahul Sharma'} is on the way (${mins} mins away)`
          );
          if (data.delivery?.currentLat && data.delivery?.currentLng && bikeMarker.current) {
            bikeMarker.current.setLatLng([data.delivery.currentLat, data.delivery.currentLng]);
          }
        }
      } catch {
        /* keep local order data + simulation */
      }
    };

    hydrateFromApi();

    const storeLat = order.storeLat || 28.6280;
    const storeLng = order.storeLng || 77.3649;
    const customerLat = order.customerLat || storeLat - 0.0035;
    const customerLng = order.customerLng || storeLng + 0.0025;

    const timer = setTimeout(() => {
      if (!mapRef.current || cancelled) return;

      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([storeLat, storeLng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      const storeIcon = L.divIcon({
        className: 'store-custom-pin',
        html: `<div class="relative flex items-center justify-center">
          <div class="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-emerald-500/20 text-lg">🏬</div>
          <span class="absolute -bottom-5 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">STORE</span>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const customerIcon = L.divIcon({
        className: 'customer-custom-pin',
        html: `<div class="relative flex items-center justify-center">
          <div class="w-10 h-10 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-rose-500/20 animate-bounce text-lg">🏠</div>
          <span class="absolute -bottom-5 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">YOUR HOME</span>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const bikeIcon = L.divIcon({
        className: 'bike-marker-icon',
        html: `<div class="w-12 h-12 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center shadow-2xl border-2 border-white ring-4 ring-amber-400/40 text-xl">🛵</div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });

      const waypoints = [];
      const steps = 8;
      waypoints.push([storeLat, storeLng]);
      for (let i = 1; i < steps; i += 1) {
        const frac = i / steps;
        const wiggleLat = i % 2 === 1 ? 0.00025 : -0.00025;
        const wiggleLng = i % 2 === 1 ? -0.00025 : 0.00025;
        waypoints.push([
          storeLat + (customerLat - storeLat) * frac + wiggleLat,
          storeLng + (customerLng - storeLng) * frac + wiggleLng
        ]);
      }
      waypoints.push([customerLat, customerLng]);

      L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(map);
      L.marker([customerLat, customerLng], { icon: customerIcon }).addTo(map);
      const route = L.polyline(waypoints, {
        color: '#059669',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8'
      }).addTo(map);
      map.fitBounds(route.getBounds(), { padding: [40, 40] });

      bikeMarker.current = L.marker(waypoints[0], { icon: bikeIcon }).addTo(map);
      mapInstance.current = map;

      // Simulated rider movement every 3s when no live rider socket pings
      let waypointIndex = 0;
      const totalLegs = waypoints.length - 1;

      const tick = () => {
        if (cancelled || liveOverride.current || completedRef.current) return;
        if (waypointIndex >= totalLegs) {
          setEtaMins(0);
          setEtaStatus('Rider has Arrived at your Doorstep! 🎉');
          clearInterval(animationRef.current);
          animationRef.current = null;
          return;
        }
        waypointIndex += 1;
        const next = waypoints[waypointIndex];
        bikeMarker.current?.setLatLng(next);
        map.panTo(next, { animate: true, duration: 1.2 });

        const remaining = totalLegs - waypointIndex;
        const mins = Math.max(1, Math.ceil(remaining * 0.75));
        setEtaMins(mins);
        setEtaStatus(`Rider ${driverName} is on the way (${mins} mins away)`);
      };

      animationRef.current = setInterval(tick, STEP_MS);
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (animationRef.current) clearInterval(animationRef.current);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      socket.off('driver:location', onDriverLocation);
      socket.off('delivery:location', onDriverLocation);
      socket.off('order:completed', onCompleted);
      socket.off('delivery:completed', onCompleted);
      leaveOrderRoom(orderRoomId);
      if (order.orderNumber && order.orderNumber !== orderRoomId) {
        leaveOrderRoom(order.orderNumber);
      }
    };
  }, [open, order, driverName]);

  if (!open || !order) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[92vh] max-h-[800px]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm md:text-base">Live Order & Rider GPS Tracking</h3>
                <span className={`w-2 h-2 rounded-full ${completed ? 'bg-emerald-400' : 'bg-emerald-400 animate-ping'}`} />
              </div>
              <p className="text-xs text-slate-400">
                Order:{' '}
                <span className="font-mono font-bold text-white">{order.orderNumber}</span>
                {simMode && !completed && (
                  <span className="ml-2 text-amber-400 font-bold">• Simulated movement</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className={`${completed ? 'bg-emerald-400' : 'bg-amber-400'} text-slate-950 p-3 px-4 flex items-center justify-between font-bold text-xs md:text-sm gap-3`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{completed ? '✅' : '⚡'}</span>
            <span className="truncate">{etaStatus}</span>
            {!completed && (
              <span className="hidden sm:inline text-[10px] font-black bg-slate-950/10 px-2 py-0.5 rounded-lg">
                ETA {etaMins}m
              </span>
            )}
          </div>
          <div className="bg-slate-950 text-white text-xs px-3 py-1.5 rounded-xl shrink-0 shadow">
            OTP:{' '}
            <span className="font-mono font-black text-amber-400 text-sm tracking-[0.2em]">
              {otpCode}
            </span>
          </div>
        </div>

        <div ref={mapRef} className="w-full flex-grow relative bg-slate-100 min-h-[280px]" />

        <div className="p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
              className="w-12 h-12 rounded-2xl object-cover border"
              alt="Driver"
            />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">{driverName}</h4>
                <span className="badge-rating">★ 4.9</span>
              </div>
              <p className="text-xs text-slate-500 font-mono">{driverPlate}</p>
              <p className="text-[11px] text-indigo-700 font-medium">
                Fulfilling Store: <strong>{storeName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                window.location.href = 'tel:9811009988';
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              📞 Call Rider
            </button>
            <button
              type="button"
              onClick={() => {
                window.open(
                  'https://wa.me/919811009988?text=Hi%20Rider%2C%20tracking%20my%20HyperLocal%20order',
                  '_blank'
                );
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
