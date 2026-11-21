// HyperLocal Rider & Delivery Partner Controller Engine
// Seamlessly synced with CentralStore, Customer Tracking & Merchant Queue

class DriverPortalEngine {
  constructor() {
    this.currentTab = 'dispatches'; // 'dispatches' | 'active_run' | 'history' | 'radar'
    this.audioContext = null;
    this.activeRadarMap = null;
    this.init();
  }

  init() {
    // Subscribe to reactive central store updates
    window.centralStore.subscribe(() => {
      this.updateHeaderStats();
      this.render();
    });

    // Setup OTP Auto-focus logic
    this.setupOtpInputEvents();

    // Initial render
    this.updateHeaderStats();
    this.render();
  }

  // --- Audio Synthesis for Driver Alerts ---
  playAudioChime(type = 'success') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioContext) this.audioContext = new AudioContext();

      const ctx = this.audioContext;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'new_order') {
        // High alert double-beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1100, now + 0.12);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'success') {
        // Cash register chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'error') {
        // Low error buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(160, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      console.warn('Audio feedback notice:', e);
    }
  }

  // --- Duty Status Toggle ---
  toggleDutyStatus() {
    const profile = window.centralStore.getDriverProfile();
    const newStatus = !profile.isOnline;
    window.centralStore.setDriverDutyStatus(newStatus);
    
    if (newStatus) {
      this.playAudioChime('new_order');
      if (window.notify) window.notify.success('You are now ON DUTY. Live dispatch radar active!', 'Rider Online');
    } else {
      if (window.notify) window.notify.info('You are now OFF DUTY. Dispatches paused.', 'Rider Offline');
    }

    this.updateHeaderStats();
    this.render();
  }

  updateHeaderStats() {
    const profile = window.centralStore.getDriverProfile();
    const activeRun = window.centralStore.getActiveDriverRun();
    const dispatches = window.centralStore.getOrdersForDispatch();
    const registeredDrivers = window.centralStore.getRegisteredDrivers();

    // Driver Profile Info
    const hName = document.getElementById('driverHeaderName');
    const hRating = document.getElementById('driverHeaderRating');
    const hPlate = document.getElementById('driverHeaderPlate');
    const dropdown = document.getElementById('riderSelectDropdown');

    if (hName) hName.textContent = profile.name;
    if (hRating) hRating.textContent = `★ ${profile.rating || '5.0'}`;
    if (hPlate) hPlate.textContent = profile.plateNumber;

    if (dropdown && registeredDrivers.length > 0) {
      dropdown.innerHTML = registeredDrivers.map(d => `
        <option value="${d.id}" ${d.name === profile.name || d.id === profile.id ? 'selected' : ''}>
          ${d.name} (${d.vehicleType.split(' ')[0]})
        </option>
      `).join('');
    }

    // Duty button & dot
    const dutyBtn = document.getElementById('dutyStatusBtn');
    const dutyText = document.getElementById('dutyStatusText');
    const dutyDot = document.getElementById('dutyIndicatorDot');

    if (dutyBtn && dutyText && dutyDot) {
      if (profile.isOnline) {
        dutyBtn.className = 'px-3.5 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition shadow-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer';
        dutyText.textContent = 'ON DUTY';
        dutyDot.className = 'absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse';
      } else {
        dutyBtn.className = 'px-3.5 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition shadow-md bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer';
        dutyText.textContent = 'OFF DUTY';
        dutyDot.className = 'absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-950';
      }
    }

    // Stat numbers
    const elEarnings = document.getElementById('statTodayEarnings');
    const elCompleted = document.getElementById('statCompletedTrips');
    const elRun = document.getElementById('statCurrentRun');
    const badgeDispatch = document.getElementById('badgeDispatchCount');
    const badgeActiveDot = document.getElementById('badgeActiveRunStatus');

    if (elEarnings) elEarnings.textContent = `₹${profile.todayEarnings || 0}`;
    if (elCompleted) elCompleted.textContent = `${profile.completedDeliveries || 0}`;
    if (elRun) elRun.textContent = activeRun ? `${activeRun.orderNumber} • ${activeRun.status.toUpperCase()}` : 'Idle • Ready';
    if (badgeDispatch) badgeDispatch.textContent = dispatches.length;
    if (badgeActiveDot) {
      badgeActiveDot.className = activeRun ? 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping' : 'w-2 h-2 rounded-full bg-slate-600';
    }
  }

  handleRiderSwitch(driverId) {
    const p = window.centralStore.switchActiveDriver(driverId);
    if (p) {
      this.playAudioChime('new_order');
      if (window.notify) {
        window.notify.success(`Logged in as rider "${p.name}" (${p.plateNumber})`, 'Rider Switched');
      }
      this.updateHeaderStats();
      this.render();
    }
  }

  // --- Tab Navigation ---
  setTab(tabKey) {
    this.currentTab = tabKey;

    ['dispatches', 'active_run', 'history', 'radar'].forEach(key => {
      const btn = document.getElementById(`tabBtn_${key}`);
      if (btn) {
        if (key === tabKey) {
          btn.className = 'flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-xs transition bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
        } else {
          btn.className = 'flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-xs transition bg-slate-800 hover:bg-slate-700 text-slate-300';
        }
      }
    });

    this.render();
  }

  // --- Main View Renderer ---
  render() {
    const container = document.getElementById('driverTabContent');
    if (!container) return;

    if (this.currentTab === 'dispatches') {
      this.renderDispatchesTab(container);
    } else if (this.currentTab === 'active_run') {
      this.renderActiveRunTab(container);
    } else if (this.currentTab === 'history') {
      this.renderHistoryTab(container);
    } else if (this.currentTab === 'radar') {
      this.renderRadarTab(container);
    }
  }

  // ================= 1. DISPATCHES QUEUE =================
  renderDispatchesTab(container) {
    const profile = window.centralStore.getDriverProfile();
    const dispatches = window.centralStore.getOrdersForDispatch();
    const activeRun = window.centralStore.getActiveDriverRun();

    if (!profile.isOnline) {
      container.innerHTML = `
        <div class="bg-slate-800/60 border border-slate-700 rounded-3xl p-8 text-center space-y-3">
          <div class="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-3xl mx-auto">
            😴
          </div>
          <h3 class="text-base font-black text-white">You are Currently OFF DUTY</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">Go ON DUTY using the toggle button above to receive live customer delivery requests.</p>
          <button onclick="window.driverPortal.toggleDutyStatus()" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition">
            🟢 Go ON DUTY Now
          </button>
        </div>
      `;
      return;
    }

    if (activeRun) {
      container.innerHTML = `
        <div class="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-amber-500/20">
              🛵
            </div>
            <div>
              <span class="text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">Run In Progress</span>
              <h4 class="text-sm font-black text-white mt-1">${activeRun.orderNumber} • ${activeRun.storeName}</h4>
              <p class="text-xs text-slate-400">${activeRun.deliveryAddress}</p>
            </div>
          </div>

          <button onclick="window.driverPortal.setTab('active_run')" class="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition">
            Continue Active Run ➔
          </button>
        </div>
      `;
    }

    if (dispatches.length === 0) {
      container.innerHTML += `
        <div class="bg-slate-800/40 border border-dashed border-slate-700 rounded-3xl p-10 text-center space-y-3">
          <div class="relative w-16 h-16 mx-auto">
            <div class="absolute inset-0 rounded-full bg-indigo-600/20 radar-pulse"></div>
            <div class="w-16 h-16 rounded-full bg-slate-800 border border-indigo-500/30 flex items-center justify-center text-2xl">
              📡
            </div>
          </div>
          <h3 class="text-sm font-black text-white">Scanning ${window.centralStore?.state?.selectedLocation?.area || 'Local Area'} Radar for Orders...</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">Orders will pop up here instantly as soon as customers place them. Or generate a demo order below.</p>
          <button onclick="window.driverPortal.triggerDemoOrder()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow">
            + Generate Customer Demo Order
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML += `
      <div class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-400">Available Dispatches Nearby (${dispatches.length})</h3>
          <span class="text-[11px] text-emerald-400 font-bold">⚡ Payout: ₹45 - ₹70 per delivery</span>
        </div>

        ${dispatches.map(order => {
          const estimatedPayout = Math.floor(45 + (order.deliveryFee || 15) * 1.5);
          const storeAddr = window.centralStore?.getStores()?.find(s => s.id === order.storeId)?.address || 'Local Market';
          return `
            <div class="bg-slate-800/90 border border-slate-700/80 hover:border-indigo-500/50 rounded-3xl p-4 sm:p-5 shadow-lg transition space-y-4">
              
              <!-- Card Header -->
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-lg font-bold">
                    📦
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="font-black text-white text-sm">${order.orderNumber}</h4>
                      <span class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono font-bold">${order.placedAt}</span>
                    </div>
                    <p class="text-xs text-indigo-300 font-medium">Store: <strong>${order.storeName}</strong></p>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-[10px] font-bold text-slate-400 block uppercase">Est. Payout</span>
                  <span class="text-base font-black text-emerald-400">₹${estimatedPayout}</span>
                </div>
              </div>

              <!-- Route Details (Pickup -> Drop) -->
              <div class="bg-slate-900/60 rounded-2xl p-3 border border-slate-800 space-y-2 text-xs">
                <div class="flex items-start gap-2">
                  <span class="text-emerald-400 font-bold">📍 Pick:</span>
                  <span class="text-slate-300 truncate">${order.storeName} • ${storeAddr}</span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="text-rose-400 font-bold">🏠 Drop:</span>
                  <span class="text-slate-200 font-semibold truncate">${order.deliveryAddress} (${order.customerName})</span>
                </div>
              </div>

              <!-- Items & Actions -->
              <div class="flex items-center justify-between pt-1">
                <div class="text-xs text-slate-400">
                  <span>${order.items.length} Item(s) • COD: <strong class="text-white">₹${order.grandTotal}</strong></span>
                </div>

                <button onclick="window.driverPortal.acceptOrder('${order.id}')"
                  class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5">
                  <span>Accept Order ➔</span>
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ================= 2. ACTIVE DELIVERY RUN WORKFLOW =================
  renderActiveRunTab(container) {
    const order = window.centralStore.getActiveDriverRun();

    if (!order) {
      container.innerHTML = `
        <div class="bg-slate-800/40 border border-slate-700 rounded-3xl p-10 text-center space-y-3">
          <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-3xl mx-auto">
            🛵
          </div>
          <h3 class="text-base font-black text-white">No Active Delivery Run</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">You don't have any ongoing deliveries. Accept an order from Available Dispatches.</p>
          <button onclick="window.driverPortal.setTab('dispatches')" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition">
            View Available Dispatches ➔
          </button>
        </div>
      `;
      return;
    }

    const currentStatus = order.status; // 'driver_assigned' | 'at_store' | 'picked_up' | 'at_doorstep'

    // Status step flags
    const isStep1Done = ['at_store', 'picked_up', 'out_for_delivery', 'at_doorstep'].includes(currentStatus);
    const isStep2Done = ['picked_up', 'out_for_delivery', 'at_doorstep'].includes(currentStatus);
    const isStep3Done = ['at_doorstep'].includes(currentStatus);

    container.innerHTML = `
      <div class="space-y-4">
        
        <!-- Live Run Header Banner -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/40 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span class="text-xs font-black text-emerald-400 uppercase tracking-wider">Live Active Run</span>
              <span class="text-xs bg-indigo-500/20 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">${order.orderNumber}</span>
            </div>
            <h2 class="text-lg md:text-xl font-black text-white mt-1">Fulfilling for: ${order.customerName}</h2>
            <p class="text-xs text-slate-400">Time Slot: ${order.timeSlot}</p>
          </div>

          <div class="flex items-center gap-3">
            <div class="text-right">
              <span class="text-[10px] text-slate-400 uppercase font-bold block">Cash to Collect</span>
              <span class="text-lg font-black text-amber-400">${order.paymentMode === 'COD' ? `₹${order.grandTotal} COD` : '✅ Paid Online'}</span>
            </div>
          </div>
        </div>

        <!-- 4-STEP INTERACTIVE WORKFLOW CARD -->
        <div class="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 md:p-6 shadow-xl space-y-6">
          
          <!-- STEP 1: Head to Store -->
          <div class="flex items-start gap-4 pb-4 border-b border-slate-700/60 ${isStep1Done ? 'opacity-70' : ''}">
            <div class="w-9 h-9 rounded-2xl ${isStep1Done ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white animate-pulse'} flex items-center justify-center font-bold text-sm flex-shrink-0">
              ${isStep1Done ? '✓' : '1'}
            </div>
            <div class="flex-grow space-y-1">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-white">1. Reach Store: ${order.storeName}</h4>
                ${isStep1Done ? '<span class="text-[10px] text-emerald-400 font-bold">Completed</span>' : ''}
              </div>
              <p class="text-xs text-slate-400">${window.centralStore?.getStores()?.find(s => s.id === order.storeId)?.address || 'Local Market'} (${order.distanceKm || 0.8} km)</p>
              
              ${!isStep1Done ? `
                <div class="pt-2 flex items-center gap-2">
                  <button onclick="window.driverPortal.updateStatus('${order.id}', 'at_store')" 
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition">
                    📍 I Have Arrived at Store
                  </button>
                  <a href="https://maps.google.com/?q=${encodeURIComponent(order.storeName + ' ' + (window.centralStore?.getStores()?.find(s => s.id === order.storeId)?.address || ''))}" target="_blank"
                    class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-bold text-xs transition">
                    🧭 Map Navigation
                  </a>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- STEP 2: Pick Up Order -->
          <div class="flex items-start gap-4 pb-4 border-b border-slate-700/60 ${!isStep1Done ? 'opacity-40' : (isStep2Done ? 'opacity-70' : '')}">
            <div class="w-9 h-9 rounded-2xl ${isStep2Done ? 'bg-emerald-600 text-white' : (isStep1Done ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400')} flex items-center justify-center font-bold text-sm flex-shrink-0">
              ${isStep2Done ? '✓' : '2'}
            </div>
            <div class="flex-grow space-y-1">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-white">2. Collect & Inspect Package</h4>
                ${isStep2Done ? '<span class="text-[10px] text-emerald-400 font-bold">Collected</span>' : ''}
              </div>
              
              <!-- Items Checklist -->
              <div class="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                ${order.items.map(item => `
                  <div class="flex items-center justify-between text-slate-300">
                    <span>• ${item.productName || item.name}</span>
                    <span class="font-mono font-bold text-white">x${item.quantity}</span>
                  </div>
                `).join('')}
              </div>

              ${isStep1Done && !isStep2Done ? `
                <div class="pt-2">
                  <button onclick="window.driverPortal.updateStatus('${order.id}', 'picked_up')" 
                    class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2">
                    <span>📦 Confirm & Pick Up Package</span>
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- STEP 3: Deliver to Customer -->
          <div class="flex items-start gap-4 pb-4 border-b border-slate-700/60 ${!isStep2Done ? 'opacity-40' : (isStep3Done ? 'opacity-70' : '')}">
            <div class="w-9 h-9 rounded-2xl ${isStep3Done ? 'bg-emerald-600 text-white' : (isStep2Done ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400')} flex items-center justify-center font-bold text-sm flex-shrink-0">
              ${isStep3Done ? '✓' : '3'}
            </div>
            <div class="flex-grow space-y-1">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-white">3. Reach Customer Doorstep</h4>
                ${isStep3Done ? '<span class="text-[10px] text-emerald-400 font-bold">At Doorstep</span>' : ''}
              </div>
              <p class="text-xs text-slate-300 font-semibold">📍 ${order.deliveryAddress}</p>
              <p class="text-xs text-slate-400">Customer: ${order.customerName} • Ph: ${order.customerPhone}</p>

              ${isStep2Done && !isStep3Done ? `
                <div class="pt-2 flex items-center gap-2">
                  <button onclick="window.driverPortal.updateStatus('${order.id}', 'at_doorstep')" 
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition">
                    🔔 I am at Customer Doorstep
                  </button>
                  <button onclick="alert('📞 Calling customer: ' + '${order.customerPhone}')"
                    class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition">
                    📞 Call Customer
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- STEP 4: Secure Delivery OTP Verification -->
          <div class="flex items-start gap-4 ${!isStep3Done ? 'opacity-40' : ''}">
            <div class="w-9 h-9 rounded-2xl ${isStep3Done ? 'bg-emerald-500 text-slate-950 font-black animate-bounce' : 'bg-slate-700 text-slate-400'} flex items-center justify-center text-sm flex-shrink-0">
              🔒
            </div>
            <div class="flex-grow space-y-2">
              <div>
                <h4 class="text-sm font-black text-white">4. Customer OTP Verification</h4>
                <p class="text-xs text-slate-400">Ask the customer for the 4-digit code to complete the delivery.</p>
              </div>

              ${isStep3Done ? `
                <button onclick="window.driverPortal.openOtpModal('${order.id}')"
                  class="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/30 transition flex items-center justify-center gap-2">
                  <span>🔒 Enter OTP to Complete Delivery ➔</span>
                </button>
              ` : ''}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // ================= 3. COMPLETED RUNS HISTORY =================
  renderHistoryTab(container) {
    const history = window.centralStore.getCompletedDriverOrders();

    if (history.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-800/40 border border-slate-700 rounded-3xl p-10 text-center space-y-3">
          <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-3xl mx-auto">
            📜
          </div>
          <h3 class="text-base font-black text-white">No Completed Runs Today</h3>
          <p class="text-xs text-slate-400">Your completed delivery runs and trip earnings will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-400">Completed Deliveries (${history.length})</h3>
          <span class="text-xs text-emerald-400 font-bold">100% On-Time Record</span>
        </div>

        ${history.map(order => `
          <div class="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl font-bold">
                ✓
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="font-black text-white text-sm">${order.orderNumber}</h4>
                  <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Delivered</span>
                </div>
                <p class="text-xs text-slate-400">${order.storeName} ➔ ${order.customerName}</p>
                <p class="text-[11px] text-slate-500 font-mono">Delivered at ${order.deliveredAt || 'Recently'}</p>
              </div>
            </div>

            <div class="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700">
              <span class="text-[10px] text-slate-400 font-bold uppercase">Earned</span>
              <span class="text-base font-black text-emerald-400">+₹${order.driverEarning || 55}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ================= 4. LIVE GPS RADAR TAB =================
  renderRadarTab(container) {
    const activeLoc = window.centralStore?.state?.selectedLocation || { area: 'Local Area', lat: 28.6280, lng: 77.3649 };
    const pLat = activeLoc.lat ? Number(activeLoc.lat).toFixed(4) : '28.6280';
    const pLng = activeLoc.lng ? Number(activeLoc.lng).toFixed(4) : '77.3649';

    container.innerHTML = `
      <div class="bg-slate-800/90 border border-slate-700 rounded-3xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-black text-white flex items-center gap-2">
              <span>🗺️ ${activeLoc.area} Fleet Live Radar</span>
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </h3>
            <p class="text-xs text-slate-400">Live GPS tracking and store route simulator</p>
          </div>
          <span class="text-xs bg-slate-900 text-amber-400 font-mono font-bold px-3 py-1 rounded-xl border border-slate-700">
            GPS: ${pLat}° N, ${pLng}° E
          </span>
        </div>

        <div id="driverRadarMapContainer" class="w-full h-80 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 relative">
          <!-- Leaflet renders here -->
        </div>
      </div>
    `;

    setTimeout(() => {
      if (window.LiveMapTracker) {
        if (!this.activeRadarMap) {
          this.activeRadarMap = new window.LiveMapTracker('driverRadarMapContainer');
        }
        this.activeRadarMap.initMap();
        this.activeRadarMap.startLiveMovement();
      }
    }, 100);
  }

  // --- ACTIONS & WORKFLOW HANDLERS ---
  acceptOrder(orderId) {
    const accepted = window.centralStore.acceptOrderAsDriver(orderId);
    if (accepted) {
      this.playAudioChime('new_order');
      if (window.notify) {
        window.notify.success(`Accepted ${accepted.orderNumber}! Please head to ${accepted.storeName}.`, 'Order Accepted');
      }
      this.setTab('active_run');
    }
  }

  updateStatus(orderId, nextStatus) {
    const updated = window.centralStore.updateOrderStatus(orderId, nextStatus);
    if (updated) {
      this.playAudioChime('new_order');
      if (window.notify) {
        const labels = {
          'at_store': 'Status updated: Arrived at Store',
          'picked_up': 'Package Picked Up! Head to Customer doorstep.',
          'at_doorstep': 'At Customer Doorstep. Request Delivery OTP.'
        };
        window.notify.info(labels[nextStatus] || `Status updated to ${nextStatus}`, 'Live Status');
      }
      this.render();
    }
  }

  // --- OTP Verification Modal Engine ---
  openOtpModal(orderId) {
    this.pendingOrderId = orderId;
    const modal = document.getElementById('otpVerificationModal');

    // Reset inputs
    for (let i = 1; i <= 4; i++) {
      const input = document.getElementById(`otpDigit_${i}`);
      if (input) input.value = '';
    }

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => document.getElementById('otpDigit_1')?.focus(), 100);
    }
  }

  closeOtpModal() {
    const modal = document.getElementById('otpVerificationModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  setupOtpInputEvents() {
    for (let i = 1; i <= 4; i++) {
      const input = document.getElementById(`otpDigit_${i}`);
      if (!input) continue;

      input.addEventListener('input', (e) => {
        if (e.target.value && i < 4) {
          document.getElementById(`otpDigit_${i + 1}`)?.focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 1) {
          document.getElementById(`otpDigit_${i - 1}`)?.focus();
        }
        if (e.key === 'Enter') {
          this.submitOtpVerification();
        }
      });
    }
  }

  submitOtpVerification() {
    let enteredOtp = '';
    for (let i = 1; i <= 4; i++) {
      enteredOtp += document.getElementById(`otpDigit_${i}`)?.value || '';
    }

    if (enteredOtp.length !== 4) {
      this.playAudioChime('error');
      if (window.notify) window.notify.warning('Please enter the complete 4-digit OTP', 'Incomplete OTP');
      return;
    }

    const result = window.centralStore.verifyOrderDeliveryOtp(this.pendingOrderId, enteredOtp);
    if (result.success) {
      this.playAudioChime('success');
      this.closeOtpModal();
      if (window.notify) {
        window.notify.success(`🎉 Delivery Completed! You earned +₹${result.tripEarning} on this run.`, 'Handover Success');
      }
      this.setTab('history');
    } else {
      this.playAudioChime('error');
      if (window.notify) {
        window.notify.error(result.message, 'Invalid OTP');
      }
    }
  }

  // --- Driver Onboarding & Registration Modal ---
  openRegistrationModal() {
    const modal = document.getElementById('driverRegistrationModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeRegistrationModal() {
    const modal = document.getElementById('driverRegistrationModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('regRiderName')?.value;
    const phone = document.getElementById('regRiderPhone')?.value;
    const city = document.getElementById('regRiderCity')?.value;
    const vehicleType = document.getElementById('regRiderVehicleType')?.value;
    const plateNumber = document.getElementById('regRiderPlate')?.value;
    const licenseNo = document.getElementById('regRiderLicense')?.value;
    const aadhaarNo = document.getElementById('regRiderAadhaar')?.value;
    const upiId = document.getElementById('regRiderUpi')?.value;

    const kyc = window.centralStore.submitDriverKYC({
      name,
      phone,
      city,
      vehicleType,
      plateNumber,
      licenseNo,
      aadhaarNo,
      upiId
    });

    this.closeRegistrationModal();
    document.getElementById('riderRegistrationForm')?.reset();
    this.playAudioChime('success');

    if (window.notify) {
      window.notify.success(`🎉 Application submitted for ${kyc.name}! Fleet Admin will review your KYC at admin.html within 15-30 minutes.`, 'Application Received');
    }
  }

  // --- Demo Order Trigger ---
  triggerDemoOrder() {
    const order = window.centralStore.generateDemoOrder();
    this.playAudioChime('new_order');
    if (window.notify) {
      window.notify.success(`New Dispatch Alert: ${order.orderNumber} placed for ${order.storeName}!`, 'New Dispatch');
    }
    this.setTab('dispatches');
  }
}

// Global Singleton
window.addEventListener('DOMContentLoaded', () => {
  window.driverPortal = new DriverPortalEngine();
});
