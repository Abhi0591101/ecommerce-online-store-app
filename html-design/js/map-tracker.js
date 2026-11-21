// Live Map Tracking Engine with Animated Moving Bike Marker (Leaflet.js)
// Rapido/Zomato-Style Realtime Driver Route Simulation

class LiveMapTracker {
  constructor(mapContainerId) {
    this.containerId = mapContainerId;
    this.map = null;
    this.bikeMarker = null;
    this.routePolyline = null;
    this.animationInterval = null;
    this.currentWaypointIndex = 0;
    this.waypoints = [];
  }

  generateWaypoints(sLat, sLng, cLat, cLng) {
    sLat = parseFloat(sLat) || 28.6280;
    sLng = parseFloat(sLng) || 77.3649;
    cLat = parseFloat(cLat) || 28.6275;
    cLng = parseFloat(cLng) || 77.3650;

    // If identical or too close, ensure a small realistic route
    if (Math.abs(sLat - cLat) < 0.0005 && Math.abs(sLng - cLng) < 0.0005) {
      cLat = sLat - 0.0035;
      cLng = sLng + 0.0025;
    }

    const points = [[sLat, sLng]];
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const frac = i / steps;
      // Realistic street curve offset
      const wiggleLat = (i % 2 === 1 ? 0.0003 : -0.0003);
      const wiggleLng = (i % 2 === 1 ? -0.0003 : 0.0003);
      points.push([
        parseFloat((sLat + (cLat - sLat) * frac + wiggleLat).toFixed(6)),
        parseFloat((sLng + (cLng - sLng) * frac + wiggleLng).toFixed(6))
      ]);
    }
    points.push([cLat, cLng]);
    return points;
  }

  initMap(storeLat = 28.6280, storeLng = 77.3649, customerLat = 28.6275, customerLng = 77.3650) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Generate dynamic route waypoints based on actual coordinates
    this.waypoints = this.generateWaypoints(storeLat, storeLng, customerLat, customerLng);

    // Initialize Leaflet Map
    this.map = L.map(this.containerId, {
      zoomControl: false,
      attributionControl: false
    }).setView([storeLat, storeLng], 15);

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    // Custom Store Pin Marker
    const storeIcon = L.divIcon({
      className: 'store-custom-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-emerald-500/20">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <span class="absolute -bottom-5 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">STORE</span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([storeLat, storeLng], { icon: storeIcon }).addTo(this.map);

    // Custom Customer Destination Marker
    const customerIcon = L.divIcon({
      className: 'customer-custom-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-rose-500/20 animate-bounce">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          </div>
          <span class="absolute -bottom-5 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">YOUR HOME</span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([customerLat, customerLng], { icon: customerIcon }).addTo(this.map);

    // Draw glowing route path
    this.routePolyline = L.polyline(this.waypoints, {
      color: '#059669',
      weight: 5,
      opacity: 0.85,
      dashArray: '8, 8',
      lineCap: 'round'
    }).addTo(this.map);

    // Fit map bounds
    this.map.fitBounds(this.routePolyline.getBounds(), { padding: [40, 40] });

    // Create Animated Moving Bike Marker
    const bikeIcon = L.divIcon({
      className: 'bike-marker-icon',
      html: `
        <div class="w-12 h-12 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center shadow-2xl border-2 border-white ring-4 ring-amber-400/40 beacon-online">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm14-8.5c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm-8.2-7.5l2.2-3.8c.3-.5.8-.8 1.4-.8h3.6v2h-3.1l-1.5 2.6 1.8 1.8c.4.4.9.7 1.4.7h2.4v2h-2.4c-.9 0-1.8-.4-2.4-1l-1.9-1.9-2.1 3.5h-2.4l3.1-5.1z"/>
          </svg>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    this.bikeMarker = L.marker(this.waypoints[0], { icon: bikeIcon }).addTo(this.map);
  }

  startLiveMovement(onEtaUpdate) {
    if (this.animationInterval) clearInterval(this.animationInterval);
    this.currentWaypointIndex = 0;

    let subStep = 0;
    const totalSubSteps = 30; // Smooth intermediate interpolation

    this.animationInterval = setInterval(() => {
      if (this.currentWaypointIndex >= this.waypoints.length - 1) {
        // Reached destination
        if (onEtaUpdate) onEtaUpdate({ etaMins: 0, distanceMeters: 0, status: 'Rider has Arrived at your Doorstep! 🎉' });
        clearInterval(this.animationInterval);
        return;
      }

      const p1 = this.waypoints[this.currentWaypointIndex];
      const p2 = this.waypoints[this.currentWaypointIndex + 1];

      subStep++;
      const fraction = subStep / totalSubSteps;

      const currentLat = p1[0] + (p2[0] - p1[0]) * fraction;
      const currentLng = p1[1] + (p2[1] - p1[1]) * fraction;

      if (this.bikeMarker) {
        this.bikeMarker.setLatLng([currentLat, currentLng]);
      }

      // Calculate remaining ETA
      const totalRemainingSteps = (this.waypoints.length - 1 - this.currentWaypointIndex) * totalSubSteps - subStep;
      const remainingMins = Math.max(1, Math.ceil(totalRemainingSteps / 15));
      const remainingMeters = Math.max(20, totalRemainingSteps * 25);

      if (onEtaUpdate) {
        onEtaUpdate({
          etaMins: remainingMins,
          distanceMeters: remainingMeters,
          status: `Rider is ${remainingMins} min away (${remainingMeters}m)`
        });
      }

      if (subStep >= totalSubSteps) {
        subStep = 0;
        this.currentWaypointIndex++;
      }
    }, 400);
  }

  stopLiveMovement() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }
}

window.LiveMapTracker = LiveMapTracker;
