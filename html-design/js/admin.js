// Admin Portal, Management Hub & Dynamic Creator Studio
// 100% Connected with MariaDB/MySQL (Port 3307) & PHP REST API Backend

class AdminPortal {
  constructor() {
    this.currentTab = 'creator_studio'; // 'creator_studio' | 'manage_stores' | 'manage_products' | 'manage_services' | 'manage_categories' | 'merchant_orders'
    this.activeStudioForm = 'product'; // 'store' | 'product' | 'category' | 'service'
    this.activeEditItem = null;
    this.activeEditType = null;
    this.init();
  }

  toggleAllStores(checked, prefix = 'chkStore_') {
    const stores = window.centralStore.getStores();
    stores.forEach(s => {
      const chk = document.getElementById(`${prefix}${s.id}`);
      if (chk) chk.checked = checked;
    });
  }

  init() {
    window.centralStore.subscribe(() => {
      this.render();
    });
    this.render();

    // Fetch live products, categories & stores dynamically from MariaDB / MySQL (Port 3307)
    window.centralStore.syncFromDatabase();
  }

  setTab(tab) {
    this.currentTab = tab;
    this.render();
  }

  setStudioForm(formType) {
    this.activeStudioForm = formType;
    this.render();
  }

  updateTabBadges() {
    const stores = window.centralStore.getStores();
    const products = window.centralStore.getProducts();
    const services = window.centralStore.getServices();
    const categories = window.centralStore.getCategories();
    const drivers = window.centralStore.getRegisteredDrivers();
    const pendingDrivers = window.centralStore.getPendingDriverKYCs();
    const pendingStores = window.centralStore.state.pendingStoreApprovals || [];
    const pendingServices = window.centralStore.state.pendingServiceKYCs || [];

    const totalPending = pendingDrivers.length + pendingStores.length + pendingServices.length;

    const storesEl = document.getElementById('storesCountBadge');
    if (storesEl) storesEl.innerText = stores.length;

    const prodsEl = document.getElementById('productsCountBadge');
    if (prodsEl) prodsEl.innerText = products.length;

    const srvsEl = document.getElementById('servicesCountBadge');
    if (srvsEl) srvsEl.innerText = services.length;

    const catsEl = document.getElementById('categoriesCountBadge');
    if (catsEl) catsEl.innerText = categories.length;

    const driversEl = document.getElementById('driversCountBadge');
    if (driversEl) driversEl.innerText = drivers.length;

    const approvalsEl = document.getElementById('approvalsCountBadge');
    if (approvalsEl) approvalsEl.innerText = totalPending;
  }

  render() {
    this.updateTabBadges();

    const container = document.getElementById('adminTabContent');
    if (!container) return;

    // Update active tab button styles
    ['creator_studio', 'manage_stores', 'manage_products', 'manage_services', 'manage_categories', 'merchant_orders', 'manage_drivers', 'superadmin_approvals'].forEach(tabName => {
      const btn = document.getElementById(`tabBtn_${tabName}`);
      if (btn) {
        const isCurrent = tabName === this.currentTab;
        btn.className = `px-4 py-2 rounded-2xl font-bold text-xs transition ${
          isCurrent 
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
        }`;
      }
    });

    if (this.currentTab === 'creator_studio') {
      this.renderCreatorStudio(container);
    } else if (this.currentTab === 'manage_stores') {
      this.renderManageStores(container);
    } else if (this.currentTab === 'manage_products') {
      this.renderManageProducts(container);
    } else if (this.currentTab === 'manage_services') {
      this.renderManageServices(container);
    } else if (this.currentTab === 'manage_categories') {
      this.renderManageCategories(container);
    } else if (this.currentTab === 'merchant_orders') {
      this.renderMerchantOrders(container);
    } else if (this.currentTab === 'manage_drivers') {
      this.renderManageDrivers(container);
    } else if (this.currentTab === 'superadmin_approvals') {
      this.renderSuperadminApprovals(container);
    }
  }

  // ================= FLEET & RIDERS DIRECTORY =================
  renderManageDrivers(container) {
    const drivers = window.centralStore.getRegisteredDrivers();

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h3 class="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
              <span>🛵 HyperLocal Delivery Fleet Directory</span>
              <span class="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">${drivers.length} Active Riders</span>
            </h3>
            <p class="text-xs text-slate-500">Manage active delivery partners, on-duty dispatches, vehicles & daily earnings</p>
          </div>

          <button onclick="window.adminPortal.openAddRiderModal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 self-start sm:self-auto">
            <span>+ Add Delivery Rider Directly</span>
          </button>
        </div>

        <!-- Riders Grid -->
        ${drivers.length === 0 ? `
          <div class="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-3">
            <span class="text-4xl">🛵</span>
            <h4 class="font-bold text-slate-800 text-sm">No Delivery Riders Found</h4>
            <p class="text-xs">Add a rider directly or approve pending onboarding applications.</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${drivers.map(driver => `
              <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-indigo-300 transition space-y-4 flex flex-col justify-between">
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-3">
                      <div class="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl font-bold border border-amber-500/20">
                        🛵
                      </div>
                      <div>
                        <h4 class="font-black text-slate-900 text-sm">${driver.name}</h4>
                        <p class="text-[11px] text-slate-400 font-mono">📞 ${driver.phone}</p>
                      </div>
                    </div>
                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${driver.isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                      ${driver.isOnline ? '● ON DUTY' : '○ OFF DUTY'}
                    </span>
                  </div>

                  <!-- Vehicle & Rating Details -->
                  <div class="mt-3.5 bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs">
                    <div class="flex items-center justify-between text-slate-600">
                      <span>Vehicle:</span>
                      <strong class="text-slate-900">${driver.vehicleType}</strong>
                    </div>
                    <div class="flex items-center justify-between text-slate-600">
                      <span>Plate Number:</span>
                      <strong class="font-mono text-indigo-600 font-black">${driver.plateNumber}</strong>
                    </div>
                    <div class="flex items-center justify-between text-slate-600">
                      <span>Customer Rating:</span>
                      <span class="font-bold text-amber-500">★ ${driver.rating}</span>
                    </div>
                  </div>

                  <!-- Stats -->
                  <div class="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                    <div class="bg-indigo-50/60 p-2 rounded-xl border border-indigo-100">
                      <span class="text-[10px] text-slate-500 font-bold block uppercase">Today's Pay</span>
                      <strong class="text-indigo-700 text-sm font-black">₹${driver.todayEarnings || 0}</strong>
                    </div>
                    <div class="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                      <span class="text-[10px] text-slate-500 font-bold block uppercase">Trips Done</span>
                      <strong class="text-emerald-700 text-sm font-black">${driver.completedDeliveries || 0}</strong>
                    </div>
                  </div>
                </div>

                <!-- Footer Actions -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button onclick="window.adminPortal.toggleDriverDuty('${driver.id}')"
                    class="px-3 py-1.5 rounded-xl font-bold text-xs transition ${driver.isOnline ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}">
                    ${driver.isOnline ? 'Set Off Duty' : 'Set On Duty'}
                  </button>

                  <button onclick="window.adminPortal.deleteDriver('${driver.id}', '${driver.name}')"
                    class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ================= 7. KYC & ONBOARDING APPROVALS HUB =================
  renderSuperadminApprovals(container) {
    const pendingDrivers = window.centralStore.getPendingDriverKYCs();
    const pendingStores = window.centralStore.state.pendingStoreApprovals || [];
    const pendingServices = window.centralStore.state.pendingServiceKYCs || [];

    const totalPending = pendingDrivers.length + pendingStores.length + pendingServices.length;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h3 class="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
              <span>👑 SuperAdmin KYC & Onboarding Approvals</span>
              <span class="text-xs ${totalPending > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} font-bold px-2 py-0.5 rounded-full border">
                ${totalPending} Pending
              </span>
            </h3>
            <p class="text-xs text-slate-500">Review official identity proof, driving licenses, vehicle numbers, and verify merchants & riders</p>
          </div>
        </div>

        <!-- 1. PENDING RIDER KYCs -->
        <div class="space-y-3">
          <h4 class="font-black text-slate-900 text-sm flex items-center gap-2">
            <span>🛵 Delivery Partner Onboarding Queue</span>
            <span class="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">${pendingDrivers.length} Applications</span>
          </h4>

          ${pendingDrivers.length === 0 ? `
            <div class="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-400 text-xs">
              ✓ No pending delivery rider applications. All riders verified!
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${pendingDrivers.map(app => `
                <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-3">
                      <div class="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center text-xl font-bold border border-amber-500/30">
                        🛵
                      </div>
                      <div>
                        <h4 class="font-black text-slate-900 text-sm">${app.name}</h4>
                        <p class="text-[11px] text-slate-400 font-mono">📞 ${app.phone} • ${app.city || 'Sector 62, Noida'}</p>
                      </div>
                    </div>
                    <span class="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Pending KYC</span>
                  </div>

                  <!-- KYC Document Info Box -->
                  <div class="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1.5 text-xs">
                    <div class="flex justify-between">
                      <span class="text-slate-500">Vehicle:</span>
                      <strong class="text-slate-900">${app.vehicleType}</strong>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-500">Plate Number:</span>
                      <strong class="font-mono text-indigo-600">${app.plateNumber}</strong>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-500">Driving License:</span>
                      <strong class="font-mono text-slate-900">${app.licenseNo}</strong>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-500">Aadhaar:</span>
                      <strong class="font-mono text-slate-900">${app.aadhaarNo}</strong>
                    </div>
                    <div class="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                      <span>Submitted:</span>
                      <span>${app.submittedAt}</span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-2 pt-2">
                    <button onclick="window.adminPortal.approveDriverKYC('${app.id}')"
                      class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5">
                      <span>✓ Approve & Onboard Rider</span>
                    </button>
                    <button onclick="window.adminPortal.rejectDriverKYC('${app.id}')"
                      class="px-4 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl font-bold text-xs transition">
                      ✗ Reject
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 2. PENDING STORE MERCHANT KYCs -->
        <div class="space-y-3 pt-4 border-t border-slate-200">
          <h4 class="font-black text-slate-900 text-sm flex items-center gap-2">
            <span>🏬 Store Merchant Applications</span>
            <span class="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">${pendingStores.length} Applications</span>
          </h4>

          ${pendingStores.length === 0 ? `
            <div class="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-400 text-xs">
              ✓ No pending merchant store applications.
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${pendingStores.map(store => `
                <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h4 class="font-black text-slate-900 text-sm">${store.name}</h4>
                      <p class="text-xs text-slate-500">Owner: ${store.ownerName} • 📞 ${store.phone}</p>
                    </div>
                    <span class="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Pending</span>
                  </div>

                  <div class="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1 text-xs text-slate-600">
                    <p>📍 ${store.address} (${store.pincode})</p>
                    <p class="font-mono text-[11px]">GSTIN: ${store.gstin} • FSSAI: ${store.fssai}</p>
                  </div>

                  <div class="flex items-center gap-2 pt-2">
                    <button onclick="window.adminPortal.approveStoreKYC('${store.id}')"
                      class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm transition">
                      ✓ Approve Store
                    </button>
                    <button onclick="window.adminPortal.rejectStoreKYC('${store.id}')"
                      class="px-4 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl font-bold text-xs transition">
                      ✗ Reject
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  }

  // ================= DRIVER ACTIONS =================
  openAddRiderModal() {
    const modal = document.getElementById('addRiderModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeAddRiderModal() {
    const modal = document.getElementById('addRiderModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  handleAddRiderSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('adminRiderName')?.value;
    const phone = document.getElementById('adminRiderPhone')?.value;
    const rating = document.getElementById('adminRiderRating')?.value || 5.0;
    const vehicleType = document.getElementById('adminRiderVehicle')?.value;
    const plateNumber = document.getElementById('adminRiderPlate')?.value;
    const licenseNo = document.getElementById('adminRiderLicense')?.value;

    const rider = window.centralStore.createDriverDirectly({
      name,
      phone,
      rating,
      vehicleType,
      plateNumber,
      licenseNo
    });

    this.closeAddRiderModal();
    window.notify.success(`Rider "${rider.name}" successfully added to active fleet!`, 'Rider Activated');
  }

  approveDriverKYC(kycId) {
    const res = window.centralStore.approveDriverKYC(kycId);
    if (res.success) {
      window.notify.success(`🎉 Rider "${res.driver.name}" approved and onboarded to active fleet!`, 'KYC Approved');
      this.render();
    }
  }

  rejectDriverKYC(kycId) {
    window.centralStore.rejectDriverKYC(kycId);
    window.notify.info('Driver application rejected.');
    this.render();
  }

  toggleDriverDuty(driverId) {
    const d = window.centralStore.getRegisteredDrivers().find(dr => dr.id === driverId);
    if (d) {
      d.isOnline = !d.isOnline;
      window.centralStore.saveState();
      window.notify.info(`${d.name} is now ${d.isOnline ? 'ON DUTY' : 'OFF DUTY'}`, 'Duty Status');
    }
  }

  deleteDriver(driverId, name) {
    window.notify.confirm({
      title: 'Remove Rider from Fleet?',
      message: `Are you sure you want to remove "${name}" from the active delivery fleet?`,
      confirmText: 'Remove Rider',
      isDanger: true,
      onConfirm: () => {
        if (window.centralStore.state.registeredDrivers) {
          window.centralStore.state.registeredDrivers = window.centralStore.state.registeredDrivers.filter(dr => dr.id !== driverId);
          window.centralStore.saveState();
          window.notify.success(`Rider "${name}" removed from fleet.`);
        }
      }
    });
  }

  approveStoreKYC(storeId) {
    window.centralStore.state.pendingStoreApprovals = (window.centralStore.state.pendingStoreApprovals || []).filter(s => s.id !== storeId);
    window.centralStore.saveState();
    window.notify.success('Store KYC approved and activated!');
    this.render();
  }

  rejectStoreKYC(storeId) {
    window.centralStore.state.pendingStoreApprovals = (window.centralStore.state.pendingStoreApprovals || []).filter(s => s.id !== storeId);
    window.centralStore.saveState();
    window.notify.info('Store application rejected.');
    this.render();
  }

  // 1. DYNAMIC CREATOR STUDIO
  renderCreatorStudio(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Sub-Navigation for Creator Studio Forms -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 class="font-black text-slate-900 text-lg sm:text-xl flex items-center gap-2">
              <span>🚀 Dynamic Creator Studio</span>
              <span class="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase">Instant Launch</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Add unlimited Stores, Products, Categories & Services on the fly</p>
          </div>

          <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button onclick="window.adminPortal.setStudioForm('store')" class="px-3 py-1.5 rounded-xl font-bold text-xs transition ${this.activeStudioForm === 'store' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}">
              🏬 + Store
            </button>
            <button onclick="window.adminPortal.setStudioForm('product')" class="px-3 py-1.5 rounded-xl font-bold text-xs transition ${this.activeStudioForm === 'product' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}">
              📦 + Product
            </button>
            <button onclick="window.adminPortal.setStudioForm('category')" class="px-3 py-1.5 rounded-xl font-bold text-xs transition ${this.activeStudioForm === 'category' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}">
              🗂️ + Category
            </button>
            <button onclick="window.adminPortal.setStudioForm('service')" class="px-3 py-1.5 rounded-xl font-bold text-xs transition ${this.activeStudioForm === 'service' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}">
              🛠️ + Service
            </button>
          </div>
        </div>

        <!-- Render Specific Active Creation Form -->
        <div class="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm">
          ${this.renderActiveCreationForm()}
        </div>
      </div>
    `;
  }

  renderActiveCreationForm() {
    const categories = window.centralStore.getCategories();
    const stores = window.centralStore.getStores();

    if (this.activeStudioForm === 'store') {
      return `
        <form onsubmit="window.adminPortal.handleCreateStore(event)" class="space-y-4 max-w-2xl mx-auto text-xs">
          <div class="border-b border-slate-100 pb-3">
            <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
              <span>🏬 Register & Launch a New Store</span>
              <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Rapido Online Ready</span>
            </h3>
            <p class="text-slate-400 mt-0.5">This store will immediately appear on the map and become eligible for multi-store price comparisons.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Store / Shop Name *</label>
              <input type="text" id="newStoreName" required placeholder="e.g. Verma Hardware & Sanitary / Royal Furniture" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Primary Category *</label>
              <select id="newStoreCategory" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none capitalize">
                ${categories.filter(c => c.slug !== 'all').map(c => `<option value="${c.slug}">${c.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Owner / Merchant Name *</label>
              <input type="text" id="newStoreOwner" required placeholder="e.g. Rajesh Verma" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Phone Number (For Order Alerts) *</label>
              <input type="tel" id="newStorePhone" required placeholder="e.g. 9811223344" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Delivery Fee (₹)</label>
              <input type="number" id="newStoreDelFee" value="15" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Free Delivery Above (₹)</label>
              <input type="number" id="newStoreFreeAbove" value="300" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Est. Delivery Time (Mins)</label>
              <input type="number" id="newStoreEstMins" value="20" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Store Address & Market *</label>
            <input type="text" id="newStoreAddress" required placeholder="e.g. Shop 15, Sector 62 Main Market, Noida" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Store Front Photo & Banner</label>
            ${window.imageStudio ? window.imageStudio.renderDropzone('newStorePhoto', 'stores') : ''}
            <input type="text" id="newStorePhoto" placeholder="Or paste image URL (https://...)" class="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>

          <button type="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/30 transition">
            🎉 Create & Launch Store Instantly
          </button>
        </form>
      `;
    }

    if (this.activeStudioForm === 'product') {
      return `
        <form onsubmit="window.adminPortal.handleCreateProduct(event)" class="space-y-4 max-w-2xl mx-auto text-xs">
          <div class="border-b border-slate-100 pb-3">
            <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
              <span>📦 Add Product with Multi-Store Pricing</span>
              <span class="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">Comparison Enabled</span>
            </h3>
            <p class="text-slate-400 mt-0.5">Define MRP and assign selling prices across multiple nearby stores.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Product Title *</label>
              <input type="text" id="newProdName" required placeholder="e.g. Bosch Drill / Ergonomic Chair / Maybelline Lipstick" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Category *</label>
              <select id="newProdCategory" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none capitalize">
                ${categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Brand</label>
              <input type="text" id="newProdBrand" placeholder="e.g. Bosch / Nilkamal / Lakme" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">MRP Price (₹) *</label>
              <input type="number" id="newProdMrp" required placeholder="e.g. 500" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Unit / Pack Size *</label>
              <input type="text" id="newProdUnit" required placeholder="e.g. 1 Piece / 500g / 1 Litre" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Description</label>
            <textarea id="newProdDesc" rows="2" placeholder="Quality product description, key features, and specifications..." class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"></textarea>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Product Images (Upload Multiple Photos)</label>
            ${window.imageStudio ? window.imageStudio.renderDropzone('newProdPhoto', 'products') : ''}
            <input type="text" id="newProdPhoto" placeholder="Or paste image URL (https://...)" class="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>

          <!-- Multi-Store Price Mapping -->
          <div class="pt-3 border-t border-slate-100">
            <div class="flex items-center justify-between mb-1.5">
              <label class="font-bold text-slate-900">Assign Selling Price to Stores:</label>
              <div class="flex items-center gap-2 text-[11px]">
                <button type="button" onclick="window.adminPortal.toggleAllStores(true, 'chkStore_')" class="text-indigo-600 font-bold hover:underline">✓ Check All</button>
                <span class="text-slate-300">•</span>
                <button type="button" onclick="window.adminPortal.toggleAllStores(false, 'chkStore_')" class="text-slate-500 font-bold hover:underline">✗ Uncheck All</button>
              </div>
            </div>
            <div class="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
              ${stores.map((s, idx) => `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 gap-2 hover:border-slate-300 transition">
                  <label for="chkStore_${s.id}" class="flex items-center gap-2 cursor-pointer select-none flex-grow">
                    <input type="checkbox" id="chkStore_${s.id}" checked class="text-indigo-600 focus:ring-indigo-500 rounded">
                    <span class="font-bold text-slate-800 text-[11px] hover:text-indigo-600">${s.name}</span>
                  </label>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span class="text-slate-400 text-[10px]">Price: ₹</span>
                    <input type="number" id="priceStore_${s.id}" placeholder="Sell Price" class="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:ring-2 focus:ring-indigo-600 focus:outline-none">
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <button type="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/30 transition">
            📦 Save Product & Assign to Stores
          </button>
        </form>
      `;
    }

    if (this.activeStudioForm === 'category') {
      return `
        <form onsubmit="window.adminPortal.handleCreateCategory(event)" class="space-y-4 max-w-md mx-auto text-xs">
          <div class="border-b border-slate-100 pb-3">
            <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
              <span>🗂️ Create a New Category</span>
              <span class="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">Universal</span>
            </h3>
            <p class="text-slate-400 mt-0.5">Add Hardware, Chair, Footwear, Electronics or any custom category.</p>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Category Name *</label>
            <input type="text" id="newCatName" required placeholder="e.g. Hardware & Tools / Footwear / Electronics" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Icon Emoji</label>
              <input type="text" id="newCatIcon" value="📦" placeholder="e.g. 🔧 / 🪑 / 💄 / 👟" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">URL Slug</label>
              <input type="text" id="newCatSlug" placeholder="e.g. hardware" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Category Image & Icon</label>
            ${window.imageStudio ? window.imageStudio.renderDropzone('newCatPhoto', 'categories') : ''}
            <input type="text" id="newCatPhoto" placeholder="Or paste image URL (https://...)" class="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>

          <button type="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/30 transition">
            🎉 Create & Add Category to App
          </button>
        </form>
      `;
    }

    if (this.activeStudioForm === 'service') {
      return `
        <form onsubmit="window.adminPortal.handleCreateService(event)" class="space-y-4 max-w-md mx-auto text-xs">
          <div class="border-b border-slate-100 pb-3">
            <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
              <span>🛠️ Create a New Hyperlocal Service</span>
              <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">On-Demand</span>
            </h3>
            <p class="text-slate-400 mt-0.5">Add Carpenter, Beautician, Painter, AC Repair, Electrician, Plumber, etc.</p>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Service Title *</label>
            <input type="text" id="newSrvName" required placeholder="e.g. Professional AC Gas Refill & Service" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Category</label>
              <input type="text" id="newSrvCategory" value="ac-repair" placeholder="e.g. carpentry / beauty / plumbing" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Visiting Charge (₹) *</label>
              <input type="number" id="newSrvCharge" value="199" required class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-slate-700 block mb-1">Technician / Partner Name</label>
              <input type="text" id="newSrvTechName" placeholder="e.g. Sunil Verma" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>

            <div>
              <label class="font-bold text-slate-700 block mb-1">Experience (Years)</label>
              <input type="number" id="newSrvExp" value="5" class="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
            </div>
          </div>

          <div>
            <label class="font-bold text-slate-700 block mb-1">Service Photo & Banner</label>
            ${window.imageStudio ? window.imageStudio.renderDropzone('newSrvPhoto', 'services') : ''}
            <input type="text" id="newSrvPhoto" placeholder="Or paste image URL (https://...)" class="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>

          <button type="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/30 transition">
            🛠️ Publish Service to App
          </button>
        </form>
      `;
    }
  }

  // --- Handlers for Creation Forms (100% MySQL Database Persistence) ---
  async handleCreateStore(e) {
    e.preventDefault();
    const name = document.getElementById('newStoreName')?.value;
    const category = document.getElementById('newStoreCategory')?.value;
    const ownerName = document.getElementById('newStoreOwner')?.value;
    const phone = document.getElementById('newStorePhone')?.value;
    const deliveryFee = parseFloat(document.getElementById('newStoreDelFee')?.value) || 0;
    const freeDeliveryAbove = parseFloat(document.getElementById('newStoreFreeAbove')?.value) || 300;
    const estDeliveryMins = parseInt(document.getElementById('newStoreEstMins')?.value) || 20;
    const address = document.getElementById('newStoreAddress')?.value;
    
    let storeGallery = window.imageStudio?.galleries['newStorePhoto'] || [];
    const textUrl = document.getElementById('newStorePhoto')?.value?.trim();
    if (textUrl && !storeGallery.includes(textUrl)) {
      storeGallery.push(textUrl);
    }
    const photoUrl = storeGallery[0] || 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=500&auto=format&fit=crop&q=80';
    const bannerUrl = storeGallery[1] || photoUrl;

    const storePayload = {
      name, category, owner_name: ownerName, phone,
      delivery_fee: deliveryFee, free_delivery_above: freeDeliveryAbove,
      est_delivery_mins: estDeliveryMins, address, pincode: '201301', 
      photo_url: photoUrl, banner_url: bannerUrl,
      photos: storeGallery.length > 0 ? storeGallery : [photoUrl]
    };

    if (window.apiService) {
      await window.apiService.createStore(storePayload);
    }
    window.centralStore.createStore({
      ...storePayload,
      photoUrl,
      bannerUrl,
      photos: storeGallery.length > 0 ? storeGallery : [photoUrl]
    });
    await window.centralStore.syncFromDatabase();

    window.notify.success(`Store "${name}" launched online with ${storeGallery.length || 1} photo(s)!`, 'Store Created');
    this.setTab('manage_stores');
  }

  async handleCreateProduct(e) {
    e.preventDefault();
    const name = document.getElementById('newProdName')?.value;
    const category = document.getElementById('newProdCategory')?.value;
    const brand = document.getElementById('newProdBrand')?.value || 'Local Brand';
    const mrp = parseFloat(document.getElementById('newProdMrp')?.value) || 100;
    const unit = document.getElementById('newProdUnit')?.value || '1 Unit';
    const description = document.getElementById('newProdDesc')?.value || '';
    
    let prodGallery = window.imageStudio?.galleries['newProdPhoto'] || [];
    const textUrl = document.getElementById('newProdPhoto')?.value?.trim();
    if (textUrl && !prodGallery.includes(textUrl)) {
      prodGallery.push(textUrl);
    }
    const photoUrl = prodGallery[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80';

    const stores = window.centralStore.getStores();
    const storePricing = [];
    const apiStores = [];

    stores.forEach(s => {
      const chk = document.getElementById(`chkStore_${s.id}`);
      const priceInput = document.getElementById(`priceStore_${s.id}`);
      if (chk && chk.checked) {
        const price = parseFloat(priceInput?.value) || mrp;
        const dbStoreId = s.dbId || parseInt(s.id.replace('store-', '')) || 1;
        
        storePricing.push({ storeId: s.id, price, stock: 25, inStock: true });
        apiStores.push({ store_id: dbStoreId, price, stock: 25 });
      }
    });

    const productPayload = {
      name, category, brand, mrp, unit, description, 
      photo_url: photoUrl, 
      photos: prodGallery.length > 0 ? prodGallery : [photoUrl],
      stores: apiStores
    };

    if (window.apiService) {
      await window.apiService.createProduct(productPayload);
    }
    window.centralStore.createProduct({
      ...productPayload,
      photoUrl,
      photos: prodGallery.length > 0 ? prodGallery : [photoUrl],
      stores: storePricing
    });
    await window.centralStore.syncFromDatabase();

    window.notify.success(`Product "${name}" saved to MySQL with ${prodGallery.length || 1} photo(s)!`, 'Product Created');
    this.setTab('manage_products');
  }

  async handleCreateCategory(e) {
    e.preventDefault();
    const name = document.getElementById('newCatName')?.value;
    const icon = document.getElementById('newCatIcon')?.value || '📦';
    const slug = document.getElementById('newCatSlug')?.value || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const photoUrl = document.getElementById('newCatPhoto')?.value || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80';

    const catPayload = { name, slug, icon_emoji: icon, photo_url: photoUrl };

    if (window.apiService) {
      await window.apiService.createCategory(catPayload);
    }
    window.centralStore.createCategory(catPayload);
    await window.centralStore.syncFromDatabase();

    window.notify.success(`Category "${name}" added to the platform!`, 'Category Created');
    this.setTab('manage_categories');
  }

  async handleCreateService(e) {
    e.preventDefault();
    const name = document.getElementById('newSrvName')?.value;
    const category = document.getElementById('newSrvCategory')?.value || 'general';
    const visitCharge = parseFloat(document.getElementById('newSrvCharge')?.value) || 149;
    const providerName = document.getElementById('newSrvTechName')?.value || 'Certified Technician';
    const experienceYears = parseInt(document.getElementById('newSrvExp')?.value) || 5;
    const photoUrl = document.getElementById('newSrvPhoto')?.value || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80';

    const srvPayload = {
      name, category, visit_charge: visitCharge, provider_name: providerName,
      experience_years: experienceYears, photo_url: photoUrl
    };

    if (window.apiService) {
      await window.apiService.createService(srvPayload);
    }
    window.centralStore.createService(srvPayload);
    await window.centralStore.syncFromDatabase();

    window.notify.success(`Service "${name}" saved to MySQL and published!`, 'Service Published');
    this.setTab('manage_services');
  }

  // 2. MANAGE STORES DIRECTORY (With Edit & Delete)
  renderManageStores(container) {
    const stores = window.centralStore.getStores();

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-black text-slate-900 text-lg">🏬 All Stores Directory (${stores.length})</h3>
          <button onclick="window.adminPortal.setStudioForm('store'); window.adminPortal.setTab('creator_studio')" class="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-sm">
            + Add New Store
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${stores.map(s => {
            const isOnline = window.centralStore.isStoreOnline(s.id);
            return `
              <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex items-center gap-3">
                    <img src="${s.photoUrl}" class="w-14 h-14 rounded-xl object-cover border flex-shrink-0" alt="${s.name}">
                    <div>
                      <h4 class="font-bold text-slate-900 text-sm">${s.name}</h4>
                      <p class="text-[11px] text-slate-400 uppercase font-semibold">${s.category} • PIN: ${s.pincode}</p>
                      <p class="text-xs text-slate-600 mt-0.5">👤 ${s.ownerName} (${s.phone})</p>
                    </div>
                  </div>

                  <div class="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                    <p>📍 <strong>Address:</strong> ${s.address}</p>
                    <p>🚚 <strong>Delivery Fee:</strong> ₹${s.deliveryFee} (Free above ₹${s.freeDeliveryAbove})</p>
                    <p>🕒 <strong>Hours:</strong> ${s.openingTime}</p>
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button onclick="window.adminPortal.toggleStoreOnline('${s.id}')"
                    class="px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition ${
                      isOnline ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                    }">
                    ${isOnline ? '🟢 Online' : '🔴 Offline'}
                  </button>

                  <div class="flex items-center gap-2">
                    <button onclick="window.adminPortal.openEditStoreModal('${s.id}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded-xl font-bold text-[11px] transition">
                      ✏️ Edit
                    </button>
                    <button onclick="window.adminPortal.deleteStore('${s.id}', '${s.name.replace(/'/g, "\\'")}')" class="px-2 py-1.5 text-rose-600 hover:text-rose-800 font-bold text-[11px]">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 3. MANAGE PRODUCTS MATRIX (With Edit & Delete)
  renderManageProducts(container) {
    const products = window.centralStore.getProducts();

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-black text-slate-900 text-lg">📦 Products Catalog Matrix (${products.length})</h3>
          <button onclick="window.adminPortal.setStudioForm('product'); window.adminPortal.setTab('creator_studio')" class="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-sm">
            + Add New Product
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${products.map(p => `
            <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div class="flex gap-3">
                <img src="${p.photoUrl}" class="w-16 h-16 rounded-xl object-cover border flex-shrink-0" alt="${p.name}">
                <div>
                  <span class="text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">${p.category}</span>
                  <h4 class="font-bold text-slate-900 text-xs md:text-sm mt-1 line-clamp-2">${p.name}</h4>
                  <p class="text-xs text-slate-500 font-bold mt-1">MRP: ₹${p.mrp} • ${p.unit}</p>
                </div>
              </div>

              <div class="mt-3 pt-2 border-t border-slate-100 text-xs flex items-center justify-between">
                <span class="text-emerald-700 font-bold">In ${p.stores?.length || 0} Stores</span>
                
                <div class="flex items-center gap-2">
                  <button onclick="window.adminPortal.openEditProductModal('${p.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded-lg font-bold text-xs transition">
                    ✏️ Edit
                  </button>
                  <button onclick="window.adminPortal.deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 4. MANAGE SERVICES HUB (With Edit & Delete)
  renderManageServices(container) {
    const services = window.centralStore.getServices();

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-black text-slate-900 text-lg">🛠️ Services Hub (${services.length})</h3>
          <button onclick="window.adminPortal.setStudioForm('service'); window.adminPortal.setTab('creator_studio')" class="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-sm">
            + Add New Service
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${services.map(s => `
            <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div class="flex gap-3">
                <img src="${s.photoUrl}" class="w-16 h-16 rounded-xl object-cover border flex-shrink-0" alt="${s.name}">
                <div>
                  <span class="text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md">${s.category}</span>
                  <h4 class="font-bold text-slate-900 text-xs md:text-sm mt-1">${s.name}</h4>
                  <p class="text-xs text-slate-500 mt-1">👤 ${s.provider?.name || 'Technician'} • ₹${s.visitCharge} Visit</p>
                </div>
              </div>

              <div class="mt-3 pt-2 border-t border-slate-100 text-xs flex justify-end gap-2">
                <button onclick="window.adminPortal.openEditServiceModal('${s.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded-lg font-bold text-xs transition">
                  ✏️ Edit
                </button>
                <button onclick="window.adminPortal.deleteService('${s.id}', '${s.name.replace(/'/g, "\\'")}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs">
                  🗑️ Delete
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 5. MANAGE CATEGORIES (With Edit & Delete)
  renderManageCategories(container) {
    const categories = window.centralStore.getCategories();

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-black text-slate-900 text-lg">🗂️ Categories Management (${categories.length})</h3>
          <button onclick="window.adminPortal.setStudioForm('category'); window.adminPortal.setTab('creator_studio')" class="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-sm">
            + Add New Category
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          ${categories.map(c => `
            <div class="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <img src="${c.photoUrl || ''}" class="w-10 h-10 rounded-full object-cover border flex-shrink-0" alt="${c.name}">
                <div>
                  <h4 class="font-bold text-slate-900 text-xs">${c.name}</h4>
                  <p class="text-[10px] text-slate-400 font-mono">${c.slug}</p>
                </div>
              </div>
              
              <div class="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                <button onclick="window.adminPortal.openEditCategoryModal('${c.slug}')" class="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded-md font-bold text-[10px]">
                  ✏️ Edit
                </button>
                ${c.slug !== 'all' ? `
                  <button onclick="window.adminPortal.deleteCategory('${c.slug}', '${c.name.replace(/'/g, "\\'")}')" class="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- EDIT MODAL OPENERS (With Interactive Dropzone Uploader & Pre-filled Thumbnails) ---
  openEditStoreModal(storeId) {
    const store = window.centralStore.getStores().find(s => s.id === storeId);
    if (!store) return;

    this.showEditModal(`
      <form onsubmit="window.adminPortal.handleUpdateStore(event, '${storeId}')" class="space-y-4 text-xs">
        <div class="border-b border-slate-100 pb-3">
          <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
            <span>✏️ Edit Store:</span>
            <span class="text-indigo-600">${store.name}</span>
          </h3>
          <p class="text-slate-400 mt-0.5">Update store branding, contact, delivery charges, and photo</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Store Name *</label>
            <input type="text" id="editStoreName" value="${store.name}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Owner Name *</label>
            <input type="text" id="editStoreOwner" value="${store.ownerName || ''}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Phone *</label>
            <input type="tel" id="editStorePhone" value="${store.phone || ''}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Delivery Fee (₹)</label>
            <input type="number" id="editStoreDelFee" value="${store.deliveryFee || 15}" class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Free Above (₹)</label>
            <input type="number" id="editStoreFreeAbove" value="${store.freeDeliveryAbove || 300}" class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Store Address *</label>
          <input type="text" id="editStoreAddress" value="${store.address || ''}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Store Photo & Banner (Drag / Upload New Photo)</label>
          ${window.imageStudio ? window.imageStudio.renderDropzone('editStorePhoto', 'stores') : ''}
          <input type="hidden" id="editStorePhoto" value="${store.photoUrl || ''}">
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="window.adminPortal.closeEditModal()" class="px-4 py-2 bg-slate-100 rounded-xl font-bold">Cancel</button>
          <button type="submit" class="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md">Save Changes</button>
        </div>
      </form>
    `);

    setTimeout(() => {
      if (window.imageStudio) {
        const storePhotos = store.photos && store.photos.length > 0 
          ? store.photos 
          : [store.photoUrl, store.bannerUrl].filter(Boolean);
        window.imageStudio.setInitialGallery('editStorePhoto', storePhotos);
      }
    }, 50);
  }

  openEditProductModal(productId) {
    const p = window.centralStore.getProducts().find(pr => pr.id === productId);
    if (!p) return;
    const categories = window.centralStore.getCategories();

    this.showEditModal(`
      <form onsubmit="window.adminPortal.handleUpdateProduct(event, '${productId}')" class="space-y-4 text-xs">
        <div class="border-b border-slate-100 pb-3">
          <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
            <span>✏️ Edit Product:</span>
            <span class="text-indigo-600">${p.name}</span>
          </h3>
          <p class="text-slate-400 mt-0.5">Edit catalog details, pricing, unit, and photos</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Product Title *</label>
            <input type="text" id="editProdName" value="${p.name}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Category *</label>
            <select id="editProdCategory" class="w-full border border-slate-200 rounded-xl px-3 py-2 capitalize">
              ${categories.map(c => `<option value="${c.slug}" ${c.slug === p.category ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Brand</label>
            <input type="text" id="editProdBrand" value="${p.brand || ''}" class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">MRP (₹) *</label>
            <input type="number" id="editProdMrp" value="${p.mrp}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Unit / Size *</label>
            <input type="text" id="editProdUnit" value="${p.unit || ''}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Description</label>
          <textarea id="editProdDesc" rows="2" class="w-full border border-slate-200 rounded-xl px-3 py-2">${p.description || ''}</textarea>
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Product Images (Upload / Crop / Replace)</label>
          ${window.imageStudio ? window.imageStudio.renderDropzone('editProdPhoto', 'products') : ''}
          <input type="hidden" id="editProdPhoto" value="${p.photoUrl || ''}">
        </div>

        <!-- Multi-Store Price Mapping in Edit Modal -->
        <div class="pt-3 border-t border-slate-100">
          <div class="flex items-center justify-between mb-1.5">
            <label class="font-bold text-slate-900">Assign Selling Price to Stores:</label>
            <div class="flex items-center gap-2 text-[11px]">
              <button type="button" onclick="window.adminPortal.toggleAllStores(true, 'editChkStore_')" class="text-indigo-600 font-bold hover:underline">✓ Check All</button>
              <span class="text-slate-300">•</span>
              <button type="button" onclick="window.adminPortal.toggleAllStores(false, 'editChkStore_')" class="text-slate-500 font-bold hover:underline">✗ Uncheck All</button>
            </div>
          </div>
          <div class="space-y-2 max-h-44 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
            ${window.centralStore.getStores().map((s) => {
              const assigned = (p.stores || []).find(st => st.storeId === s.id || st.storeId === 'store-' + s.id || st.store_id == s.dbId);
              const isChecked = !!assigned;
              const sellPrice = assigned ? (assigned.price || assigned.item_price) : p.mrp;

              return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 gap-2 hover:border-slate-300 transition">
                  <label for="editChkStore_${s.id}" class="flex items-center gap-2 cursor-pointer select-none flex-grow">
                    <input type="checkbox" id="editChkStore_${s.id}" ${isChecked ? 'checked' : ''} class="text-indigo-600 focus:ring-indigo-500 rounded">
                    <span class="font-bold text-slate-800 text-[11px] hover:text-indigo-600">${s.name}</span>
                  </label>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span class="text-slate-400 text-[10px]">Price: ₹</span>
                    <input type="number" id="editPriceStore_${s.id}" value="${sellPrice}" placeholder="Sell Price" class="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:ring-2 focus:ring-indigo-600 focus:outline-none">
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="window.adminPortal.closeEditModal()" class="px-4 py-2 bg-slate-100 rounded-xl font-bold">Cancel</button>
          <button type="submit" class="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md">Save Changes</button>
        </div>
      </form>
    `);

    setTimeout(() => {
      if (window.imageStudio) {
        const photoList = p.photos && p.photos.length > 0 ? p.photos : (p.photoUrl ? [p.photoUrl] : []);
        window.imageStudio.setInitialGallery('editProdPhoto', photoList);
      }
    }, 50);
  }

  openEditCategoryModal(slug) {
    const c = window.centralStore.getCategories().find(cat => cat.slug === slug);
    if (!c) return;

    this.showEditModal(`
      <form onsubmit="window.adminPortal.handleUpdateCategory(event, '${slug}')" class="space-y-4 text-xs">
        <div class="border-b border-slate-100 pb-3">
          <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
            <span>✏️ Edit Category:</span>
            <span class="text-indigo-600">${c.name}</span>
          </h3>
          <p class="text-slate-400 mt-0.5">Update category branding, icon, and photo</p>
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Category Name *</label>
          <input type="text" id="editCatName" value="${c.name}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Icon Emoji</label>
            <input type="text" id="editCatIcon" value="${c.icon || '📦'}" class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Slug</label>
            <input type="text" id="editCatSlug" value="${c.slug}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Category Image & Icon (Upload / Crop / Replace)</label>
          ${window.imageStudio ? window.imageStudio.renderDropzone('editCatPhoto', 'categories') : ''}
          <input type="hidden" id="editCatPhoto" value="${c.photoUrl || ''}">
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="window.adminPortal.closeEditModal()" class="px-4 py-2 bg-slate-100 rounded-xl font-bold">Cancel</button>
          <button type="submit" class="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md">Save Changes</button>
        </div>
      </form>
    `);

    setTimeout(() => {
      if (c.photoUrl && window.imageStudio) {
        window.imageStudio.setInitialImage('editCatPhoto', c.photoUrl);
      }
    }, 50);
  }

  openEditServiceModal(serviceId) {
    const s = window.centralStore.getServices().find(sr => sr.id === serviceId);
    if (!s) return;

    this.showEditModal(`
      <form onsubmit="window.adminPortal.handleUpdateService(event, '${serviceId}')" class="space-y-4 text-xs">
        <div class="border-b border-slate-100 pb-3">
          <h3 class="font-black text-slate-900 text-base flex items-center gap-2">
            <span>✏️ Edit Service:</span>
            <span class="text-indigo-600">${s.name}</span>
          </h3>
          <p class="text-slate-400 mt-0.5">Update service details, visiting fees, technician, and photo</p>
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Service Title *</label>
          <input type="text" id="editSrvName" value="${s.name}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Category Slug</label>
            <input type="text" id="editSrvCategory" value="${s.category || 'general'}" class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Visiting Charge (₹) *</label>
            <input type="number" id="editSrvCharge" value="${s.visitCharge}" required class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-bold text-slate-700 block mb-1">Technician / Partner</label>
            <input type="text" id="editSrvTech" value="${s.provider?.name || ''}" class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
          <div>
            <label class="font-bold text-slate-700 block mb-1">Experience (Years)</label>
            <input type="number" id="editSrvExp" value="${s.provider?.experienceYears || 5}" class="w-full border border-slate-200 rounded-xl px-3 py-2">
          </div>
        </div>

        <div>
          <label class="font-bold text-slate-700 block mb-1">Service Photo & Banner (Upload / Crop / Replace)</label>
          ${window.imageStudio ? window.imageStudio.renderDropzone('editSrvPhoto', 'services') : ''}
          <input type="hidden" id="editSrvPhoto" value="${s.photoUrl || ''}">
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="window.adminPortal.closeEditModal()" class="px-4 py-2 bg-slate-100 rounded-xl font-bold">Cancel</button>
          <button type="submit" class="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md">Save Changes</button>
        </div>
      </form>
    `);

    setTimeout(() => {
      if (s.photoUrl && window.imageStudio) {
        window.imageStudio.setInitialImage('editSrvPhoto', s.photoUrl);
      }
    }, 50);
  }

  showEditModal(innerHtml) {
    let modal = document.getElementById('adminUniversalEditModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminUniversalEditModal';
      modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="bg-white rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden my-auto">
        <div class="p-5 sm:p-6 overflow-y-auto flex-grow">
          ${innerHtml}
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeEditModal() {
    const modal = document.getElementById('adminUniversalEditModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  // --- UPDATE HANDLERS (PUT via MySQL REST API) ---
  async handleUpdateStore(e, storeId) {
    e.preventDefault();
    const s = window.centralStore.getStores().find(st => st.id === storeId);
    const dbId = s?.dbId || parseInt(storeId.replace('store-', '')) || 1;

    const storeGallery = window.imageStudio?.galleries['editStorePhoto'] || [];
    const photoUrl = storeGallery[0] || document.getElementById('editStorePhoto')?.value || s?.photoUrl || '';
    const bannerUrl = storeGallery[1] || photoUrl;

    const payload = {
      name: document.getElementById('editStoreName')?.value,
      owner_name: document.getElementById('editStoreOwner')?.value,
      phone: document.getElementById('editStorePhone')?.value,
      delivery_fee: parseFloat(document.getElementById('editStoreDelFee')?.value) || 15,
      free_delivery_above: parseFloat(document.getElementById('editStoreFreeAbove')?.value) || 300,
      est_delivery_mins: 20,
      address: document.getElementById('editStoreAddress')?.value,
      photo_url: photoUrl,
      banner_url: bannerUrl,
      photos: storeGallery.length > 0 ? storeGallery : [photoUrl]
    };

    if (window.apiService && dbId) {
      await window.apiService.request(`stores/${dbId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }

    window.centralStore.updateStore(storeId, {
      ...payload,
      photoUrl,
      bannerUrl,
      photos: storeGallery.length > 0 ? storeGallery : [photoUrl]
    });
    await window.centralStore.syncFromDatabase();
    this.closeEditModal();
    window.notify.success(`Store "${payload.name}" updated with ${storeGallery.length || 1} photo(s)!`, 'Store Updated');
  }

  async handleUpdateProduct(e, productId) {
    e.preventDefault();
    const p = window.centralStore.getProducts().find(pr => pr.id === productId);
    const dbId = p?.dbId || parseInt(productId.replace('prod-', '')) || 1;

    const prodGallery = window.imageStudio?.galleries['editProdPhoto'] || [];
    const photoUrl = prodGallery[0] || document.getElementById('editProdPhoto')?.value || p?.photoUrl || '';
    const mrp = parseFloat(document.getElementById('editProdMrp')?.value) || 100;

    const stores = window.centralStore.getStores();
    const storePricing = [];
    const apiStores = [];

    stores.forEach(s => {
      const chk = document.getElementById(`editChkStore_${s.id}`);
      const priceInput = document.getElementById(`editPriceStore_${s.id}`);
      if (chk && chk.checked) {
        const price = parseFloat(priceInput?.value) || mrp;
        const dbStoreId = s.dbId || parseInt(s.id.replace('store-', '')) || 1;
        
        storePricing.push({ storeId: s.id, price, stock: 25, inStock: true });
        apiStores.push({ store_id: dbStoreId, price, stock: 25 });
      }
    });

    const payload = {
      name: document.getElementById('editProdName')?.value,
      category: document.getElementById('editProdCategory')?.value,
      brand: document.getElementById('editProdBrand')?.value,
      mrp: mrp,
      unit: document.getElementById('editProdUnit')?.value,
      description: document.getElementById('editProdDesc')?.value,
      photo_url: photoUrl,
      photos: prodGallery.length > 0 ? prodGallery : [photoUrl],
      stores: apiStores
    };

    if (window.apiService && dbId) {
      await window.apiService.request(`products/${dbId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }

    window.centralStore.updateProduct(productId, {
      ...payload,
      photoUrl,
      photos: prodGallery.length > 0 ? prodGallery : [photoUrl],
      stores: storePricing
    });
    await window.centralStore.syncFromDatabase();
    this.closeEditModal();
    window.notify.success(`Product "${payload.name}" updated with ${apiStores.length} store price(s)!`, 'Product Updated');
  }

  async handleUpdateCategory(e, slug) {
    e.preventDefault();
    const c = window.centralStore.getCategories().find(cat => cat.slug === slug);
    const dbId = c?.dbId || parseInt(c?.id?.replace('cat-', '')) || 1;

    const payload = {
      name: document.getElementById('editCatName')?.value,
      slug: document.getElementById('editCatSlug')?.value,
      icon_emoji: document.getElementById('editCatIcon')?.value || '📦',
      photo_url: document.getElementById('editCatPhoto')?.value
    };

    if (window.apiService && dbId) {
      await window.apiService.request(`categories/${dbId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }

    await window.centralStore.syncFromDatabase();
    this.closeEditModal();
    window.notify.success(`Category "${payload.name}" updated successfully!`, 'Category Updated');
  }

  async handleUpdateService(e, serviceId) {
    e.preventDefault();
    const s = window.centralStore.getServices().find(sr => sr.id === serviceId);
    const dbId = s?.dbId || parseInt(serviceId.replace('srv-', '')) || 1;

    const payload = {
      name: document.getElementById('editSrvName')?.value,
      category: document.getElementById('editSrvCategory')?.value,
      visit_charge: parseFloat(document.getElementById('editSrvCharge')?.value) || 149,
      provider_name: document.getElementById('editSrvTech')?.value,
      experience_years: parseInt(document.getElementById('editSrvExp')?.value) || 5,
      photo_url: document.getElementById('editSrvPhoto')?.value
    };

    if (window.apiService && dbId) {
      await window.apiService.request(`services/${dbId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }

    await window.centralStore.syncFromDatabase();
    this.closeEditModal();
    window.notify.success(`Service "${payload.name}" updated successfully!`, 'Service Updated');
  }

  // --- Delete & Action Handlers (With Custom Pop-up Confirmation) ---
  async toggleStoreOnline(storeId) {
    const s = window.centralStore.getStores().find(st => st.id === storeId);
    const dbStoreId = s?.dbId || parseInt(storeId.replace('store-', '')) || 1;

    if (window.apiService) {
      await window.apiService.toggleStoreStatus(dbStoreId);
    }
    window.centralStore.toggleStoreOnline(storeId);
    await window.centralStore.syncFromDatabase();
    const isOnline = window.centralStore.isStoreOnline(storeId);
    window.notify.info(`Store is now ${isOnline ? 'Online (Open)' : 'Offline (Closed)'}`, s?.name || 'Store Status');
  }

  deleteStore(storeId, storeName) {
    window.notify.confirm({
      title: 'Delete Store?',
      message: `Are you sure you want to permanently delete "${storeName}" from MySQL database?`,
      confirmText: 'Delete Store',
      isDanger: true,
      onConfirm: async () => {
        const s = window.centralStore.getStores().find(st => st.id === storeId);
        const dbStoreId = s?.dbId || parseInt(storeId.replace('store-', ''));

        if (window.apiService && dbStoreId) {
          await window.apiService.request(`stores/${dbStoreId}`, { method: 'DELETE' });
        }
        window.centralStore.deleteStore(storeId);
        await window.centralStore.syncFromDatabase();
        window.notify.success(`Store "${storeName}" deleted successfully!`);
      }
    });
  }

  deleteProduct(productId, prodName) {
    window.notify.confirm({
      title: 'Delete Product?',
      message: `Are you sure you want to permanently delete "${prodName}" from database?`,
      confirmText: 'Delete Product',
      isDanger: true,
      onConfirm: async () => {
        const p = window.centralStore.getProducts().find(pr => pr.id === productId);
        const dbProdId = p?.dbId || parseInt(productId.replace('prod-', ''));

        if (window.apiService && dbProdId) {
          await window.apiService.request(`products/${dbProdId}`, { method: 'DELETE' });
        }
        window.centralStore.deleteProduct(productId);
        await window.centralStore.syncFromDatabase();
        window.notify.success(`Product "${prodName}" deleted successfully!`);
      }
    });
  }

  deleteService(serviceId, srvName) {
    window.notify.confirm({
      title: 'Delete Service?',
      message: `Are you sure you want to delete "${srvName}"?`,
      confirmText: 'Delete Service',
      isDanger: true,
      onConfirm: async () => {
        const s = window.centralStore.getServices().find(sr => sr.id === serviceId);
        const dbSrvId = s?.dbId || parseInt(serviceId.replace('srv-', ''));

        if (window.apiService && dbSrvId) {
          await window.apiService.request(`services/${dbSrvId}`, { method: 'DELETE' });
        }
        window.centralStore.deleteService(serviceId);
        await window.centralStore.syncFromDatabase();
        window.notify.success(`Service "${srvName}" deleted successfully!`);
      }
    });
  }

  deleteCategory(slug, catName) {
    window.notify.confirm({
      title: 'Delete Category?',
      message: `Are you sure you want to delete category "${catName}"?`,
      confirmText: 'Delete Category',
      isDanger: true,
      onConfirm: async () => {
        if (window.apiService && slug) {
          await window.apiService.request(`categories/${slug}`, { method: 'DELETE' });
        }
        window.centralStore.deleteCategory(slug);
        await window.centralStore.syncFromDatabase();
        window.notify.success(`Category "${catName}" deleted successfully!`);
      }
    });
  }

  // 6. MERCHANT ORDERS QUEUE
  renderMerchantOrders(container) {
    const orders = window.centralStore.state.activeOrders;

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-black text-slate-900 text-lg">📦 Live Orders Dispatch Queue (${orders.length})</h3>
          <span class="text-xs text-slate-500">Auto-refreshing live state</span>
        </div>

        ${orders.length === 0 ? `
          <div class="bg-white rounded-3xl p-12 text-center border border-slate-200">
            <span class="text-4xl">📬</span>
            <p class="font-black text-slate-800 text-sm mt-3">No Active Orders in Queue</p>
            <p class="text-xs text-slate-400 mt-1">Place an order from customer frontend to see it live here!</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${orders.map(o => `
              <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">${o.orderNumber}</span>
                    <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      o.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }">${o.status}</span>
                  </div>

                  <div class="mt-3">
                    <h4 class="font-black text-slate-900 text-sm">${o.storeName}</h4>
                    <p class="text-xs text-slate-500 mt-0.5">👤 ${o.customer?.name} • 📞 ${o.customer?.phone}</p>
                    <p class="text-xs text-slate-500 mt-0.5">📍 ${o.customer?.address}</p>
                  </div>

                  <div class="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
                    ${o.items.map(it => `
                      <div class="flex items-center justify-between text-slate-700">
                        <span>${it.quantity}x ${it.name} (${it.unit})</span>
                        <span class="font-bold">₹${it.price * it.quantity}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p class="text-[10px] text-slate-400 uppercase font-bold">Total (${o.paymentMode})</p>
                    <p class="font-black text-slate-900 text-sm text-emerald-700">₹${o.grandTotal}</p>
                  </div>

                  <div class="flex items-center gap-1.5">
                    ${o.status === 'placed' ? `
                      <button onclick="window.centralStore.updateOrderStatus('${o.orderNumber}', 'packing'); window.notify.success('Order moved to packing state!');" class="px-3 py-1.5 bg-amber-500 text-white rounded-xl font-bold text-xs shadow-sm">
                        Accept & Pack
                      </button>
                    ` : o.status === 'packing' ? `
                      <button onclick="window.centralStore.updateOrderStatus('${o.orderNumber}', 'out_for_delivery'); window.notify.success('Rider dispatched!');" class="px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-sm">
                        Dispatch Rider
                      </button>
                    ` : o.status === 'out_for_delivery' ? `
                      <button onclick="window.centralStore.updateOrderStatus('${o.orderNumber}', 'completed'); window.notify.success('Order marked completed!');" class="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-sm">
                        Mark Delivered
                      </button>
                    ` : `
                      <span class="text-xs text-emerald-700 font-bold">✅ Completed</span>
                    `}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }
}

window.adminPortal = new AdminPortal();
