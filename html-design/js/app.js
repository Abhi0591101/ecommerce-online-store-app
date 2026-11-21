// Main Customer App Controller - Fully Dynamic Multi-Store Architecture
// Hyperlocal Multi-Store Ecommerce Platform

class CustomerApp {
  constructor() {
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.selectedOrderType = 'delivery'; // 'delivery' | 'pickup'
    this.selectedTimeSlot = '⚡ Express Delivery (15-25 Mins)';
    this.activeTrackingOrder = null;
    this.mapTracker = null;
    this.activeCompareProductId = null;
    
    // Global Sorting & Filtering
    this.globalSort = 'lowest_total'; // 'lowest_total' | 'lowest_price' | 'fastest_time' | 'nearest'
    this.globalFilters = {
      freeDelivery: false,
      inStock: true,
      pickupAvailable: false
    };
    this.expandedStoreCards = {};

    this.init();
  }

  init() {
    // Subscribe to state updates (re-renders automatically on any CRUD addition or cart change!)
    window.centralStore.subscribe(() => {
      this.updateNavbarBadges();
      this.renderCategoryBubbles();
      this.renderCurrentView();
      this.renderCartDrawer();
      if (this.activeTrackingOrder) {
        const fresh = window.centralStore.getOrderById(this.activeTrackingOrder.id);
        if (fresh) this.updateLiveTrackingUI(fresh);
      }
    });

    // Initial Renders
    this.renderCategoryBubbles();
    this.renderCurrentView();
    this.updateNavbarBadges();
    this.renderCartDrawer();

    // Fetch live products, categories & stores dynamically from MariaDB / MySQL (Port 3307)
    window.centralStore.syncFromDatabase();
  }

  // --- Cart Helpers & Actions ---
  addProductToCart(productId, storeId, price) {
    window.compareEngine.selectStoreAndAddToCart(storeId, price, productId);
  }

  clearCart() {
    window.centralStore.clearCart();
    this.renderCartDrawer();
    this.updateNavbarBadges();
    if (window.notify) {
      window.notify.info('Cart cleared successfully', 'Cart Empty');
    }
  }

  updateCartQty(productId, delta) {
    window.centralStore.updateCartQty(productId, delta);
    this.renderCartDrawer();
    this.updateNavbarBadges();
  }

  // --- Category, Main Tab & Search ---
  setMainTab(tab) {
    this.activeCompareProductId = null;
    if (tab === 'services') {
      this.setCategory('services');
    } else if (tab === 'shops') {
      this.setCategory('shops');
    } else {
      this.setCategory('all');
    }
  }

  setCategory(catId) {
    this.activeCompareProductId = null;
    this.currentCategory = catId;
    this.renderCategoryBubbles();
    this.renderCurrentView();
  }

  setSearchQuery(q) {
    this.searchQuery = q.toLowerCase().trim();
    this.renderCurrentView();
  }

  setGlobalSort(sortKey) {
    this.globalSort = sortKey;
    this.renderCurrentView();
  }

  toggleGlobalFilter(filterKey) {
    this.globalFilters[filterKey] = !this.globalFilters[filterKey];
    this.renderCurrentView();
  }

  toggleExpandStores(productId) {
    this.expandedStoreCards[productId] = !this.expandedStoreCards[productId];
    this.renderCurrentView();
  }

  // --- Category Slider Engine (Smooth Sliding, Drag-to-Scroll & Navigation Arrows) ---
  slideCategories(direction) {
    const container = document.getElementById('categoryPills');
    if (!container) return;
    const scrollAmount = 300 * direction;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    setTimeout(() => this.checkCategorySliderArrows(), 350);
  }

  checkCategorySliderArrows() {
    const container = document.getElementById('categoryPills');
    const btnLeft = document.getElementById('btnSlideCatLeft');
    const btnRight = document.getElementById('btnSlideCatRight');
    if (!container || !btnLeft || !btnRight) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    btnLeft.style.display = container.scrollLeft > 15 ? 'flex' : 'none';
    btnRight.style.display = container.scrollLeft < maxScrollLeft - 15 ? 'flex' : 'none';
  }

  initCategoryDragToScroll() {
    const container = document.getElementById('categoryPills');
    if (!container || !container.dataset || container.dataset.dragInit) return;
    container.dataset.dragInit = 'true';

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    container.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
      container.classList.add('cursor-grabbing');
    });

    container.addEventListener('mouseleave', () => {
      isDown = false;
      container.classList.remove('cursor-grabbing');
    });

    container.addEventListener('mouseup', () => {
      isDown = false;
      container.classList.remove('cursor-grabbing');
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5;
      container.scrollLeft = scrollLeft - walk;
      this.checkCategorySliderArrows();
    });
  }

  // Dynamic Story Category Bubbles (Renders All Newly Created Categories + Services & Shops)
  renderCategoryBubbles() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    const categories = window.centralStore.getCategories();

    container.innerHTML = categories.map(cat => {
      const active = this.currentCategory === cat.slug;
      const defaultImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80';
      const img = cat.photoUrl || defaultImg;

      return `
        <button onclick="window.app.setCategory('${cat.slug}')"
          class="category-story-bubble flex flex-col items-center gap-1.5 focus:outline-none flex-shrink-0 cursor-pointer ${active ? 'active' : ''}">
          <div class="bubble-avatar w-14 h-14 md:w-16 md:h-16 rounded-full p-0.5 border-2 ${active ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200'} bg-white overflow-hidden shadow-xs hover:shadow-md transition">
            <img src="${img}" onerror="this.onerror=null; this.src='${defaultImg}';" class="w-full h-full object-cover rounded-full pointer-events-none" alt="${cat.name}">
          </div>
          <span class="bubble-text text-[11px] md:text-xs font-semibold ${active ? 'text-indigo-600 font-bold' : 'text-slate-700'} whitespace-nowrap">
            ${cat.name}
          </span>
        </button>
      `;
    }).join('');

    this.initCategoryDragToScroll();
    setTimeout(() => this.checkCategorySliderArrows(), 100);
  }

  updateMainTabStyles() {
    const isServices = this.currentCategory === 'services';
    const isShops = this.currentCategory === 'shops';
    const isProducts = !isServices && !isShops;

    const btnProd = document.getElementById('tabBtn_products');
    const btnServ = document.getElementById('tabBtn_services');
    const btnShop = document.getElementById('tabBtn_shops');

    if (btnProd) {
      btnProd.className = `flex-1 py-2 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${isProducts ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-600'}`;
    }
    if (btnServ) {
      btnServ.className = `flex-1 py-2 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${isServices ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-600'}`;
    }
    if (btnShop) {
      btnShop.className = `flex-1 py-2 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${isShops ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-600'}`;
    }

    const titleElem = document.getElementById('viewHeaderTitle');
    if (titleElem) {
      if (isServices) {
        titleElem.innerHTML = `<span>🛠️ Home & Repair Services</span> <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Doorstep Within 45 Mins</span>`;
      } else if (isShops) {
        titleElem.innerHTML = `<span>🏬 Verified Local Stores Nearby</span> <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Live Status</span>`;
      } else {
        titleElem.innerHTML = `<span>Products In Your Area</span> <span class="text-xs font-bold text-[#038d63] bg-[#f2f9f6] px-2 py-0.5 rounded">Lowest Price Guaranteed</span>`;
      }
    }

    const prodsCount = window.centralStore.getProducts().length;
    const servCount = window.centralStore.getServices().length;
    const storeCount = window.centralStore.getStores().length;

    const elP = document.getElementById('tabCountProds');
    const elS = document.getElementById('tabCountServices');
    const elSt = document.getElementById('tabCountStores');
    if (elP) elP.innerText = prodsCount;
    if (elS) elS.innerText = servCount;
    if (elSt) elSt.innerText = storeCount;
  }

  // --- View Rendering Engine ---
  renderCurrentView() {
    this.updateMainTabStyles();

    const mainContainer = document.getElementById('mainContentArea');
    if (!mainContainer) return;

    // Check if an in-page product single view is explicitly opened
    if (this.activeCompareProductId) {
      window.compareEngine.renderInPageView(mainContainer);
      return;
    }

    if (this.currentCategory === 'services') {
      this.renderServicesView(mainContainer);
    } else if (this.currentCategory === 'shops') {
      this.renderShopsView(mainContainer);
    } else {
      this.renderProductsView(mainContainer);
    }
  }

  // Process & Sort store offers for a product (Hyperlocal & Regional Store Engine)
  getSortedStoreOffersForProduct(product) {
    if (!product) return [];

    const allStores = window.centralStore.getStores();
    const activeLoc = window.centralStore.state.selectedLocation;
    const activeCity = activeLoc?.city?.toLowerCase();

    // 1. Filter to stores relevant to the active location (distance <= 40 km or same city)
    let localStores = allStores.filter(s => {
      if (s.distanceKm !== undefined && s.distanceKm <= 40) return true;
      if (activeCity && s.city && s.city.toLowerCase() === activeCity) return true;
      return false;
    });
    if (localStores.length === 0) localStores = allStores;

    // 2. Build offers for these local stores
    const offers = [];
    const baseMrp = product.mrp || 20;

    localStores.forEach((store, idx) => {
      const explicitOffer = product.stores?.find(s => s.storeId === store.id);
      const isCategoryMatch = store.category === 'all' || 
                             store.category === product.category ||
                             (store.category === 'grocery' && ['grocery', 'vegetables'].includes(product.category));

      if (explicitOffer || isCategoryMatch) {
        let price;
        let stock = 50;

        if (explicitOffer) {
          price = explicitOffer.price;
          stock = explicitOffer.stock || 50;
        } else {
          // Dynamic realistic offer based on store rating and variance
          const discountFactor = 0.88 + ((idx % 3) * 0.04);
          price = Math.max(1, Math.round(baseMrp * discountFactor));
          stock = 35 + (idx * 10);
        }

        const isOnline = window.centralStore.isStoreOnline(store.id);
        const deliveryFee = store.deliveryFee === 0 || price >= (store.freeDeliveryAbove || 500) ? 0 : store.deliveryFee;
        const totalCost = price + deliveryFee;

        offers.push({
          store,
          price: price,
          deliveryFee: deliveryFee,
          totalCost: totalCost,
          stock: stock,
          inStock: stock > 0,
          estDeliveryMins: store.estDeliveryMins || 20,
          distanceKm: store.distanceKm || 1.0,
          rating: store.rating || 4.8,
          reviewsCount: store.reviewsCount || 100,
          isOnline: isOnline,
          pickupAvailable: store.pickupAvailable !== false
        });
      }
    });

    // Fallback: If no local store matched the category, provide offers from any online store
    if (offers.length === 0 && product.stores) {
      product.stores.forEach(storeOffer => {
        const store = allStores.find(s => s.id === storeOffer.storeId);
        if (!store) return;
        const isOnline = window.centralStore.isStoreOnline(store.id);
        const deliveryFee = store.deliveryFee === 0 || storeOffer.price >= (store.freeDeliveryAbove || 500) ? 0 : store.deliveryFee;
        offers.push({
          store,
          price: storeOffer.price,
          deliveryFee: deliveryFee,
          totalCost: storeOffer.price + deliveryFee,
          stock: storeOffer.stock || 50,
          inStock: storeOffer.inStock !== false && (storeOffer.stock || 1) > 0,
          estDeliveryMins: store.estDeliveryMins || 20,
          distanceKm: store.distanceKm || 1.0,
          rating: store.rating || 4.8,
          reviewsCount: store.reviewsCount || 100,
          isOnline: isOnline,
          pickupAvailable: store.pickupAvailable
        });
      });
    }

    // Strictly include ONLY ONLINE stores (Offline stores are completely hidden)
    const onlineOffers = offers.filter(offer => offer.isOnline);

    // Apply Global Filters
    return onlineOffers.filter(offer => {
      if (this.globalFilters.freeDelivery && offer.deliveryFee > 0) return false;
      if (this.globalFilters.inStock && !offer.inStock) return false;
      if (this.globalFilters.pickupAvailable && !offer.pickupAvailable) return false;
      return true;
    }).sort((a, b) => {
      if (this.globalSort === 'lowest_price') return a.price - b.price;
      if (this.globalSort === 'lowest_total') return a.totalCost - b.totalCost;
      if (this.globalSort === 'fastest_time') return a.estDeliveryMins - b.estDeliveryMins;
      if (this.globalSort === 'nearest') return a.distanceKm - b.distanceKm;
      if (this.globalSort === 'rating') return b.rating - a.rating;
      return 0;
    });
  }

  // 1. Clean 2-Column Mobile / 4-Column Desktop Product Grid
  renderProductsView(container) {
    let prods = window.centralStore.getProducts();

    if (this.currentCategory !== 'all') {
      prods = prods.filter(p => p.category === this.currentCategory);
    }

    if (this.searchQuery) {
      prods = prods.filter(p => p.name.toLowerCase().includes(this.searchQuery) || (p.brand && p.brand.toLowerCase().includes(this.searchQuery)));
    }

    if (prods.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-slate-500 col-span-full bg-white rounded-3xl p-8 border border-slate-100">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <p class="font-bold text-slate-800 text-lg">No products found in this category</p>
          <p class="text-sm text-slate-400 mt-1">You can add products dynamically anytime from the Store/Admin Portal.</p>
          <a href="admin.html" class="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md">
            + Add Products in Portal ➔
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-4">
        
        <!-- Filter & Sort Bar -->
        <div class="bg-white rounded-2xl p-3 md:p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex items-center gap-2 overflow-x-auto text-xs">
            <span class="text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap">Filter:</span>
            
            <button onclick="window.app.toggleGlobalFilter('freeDelivery')" 
              class="px-3 py-1 rounded-full font-semibold border transition-all flex items-center gap-1 whitespace-nowrap ${this.globalFilters.freeDelivery ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'}">
              🚚 Free Delivery ${this.globalFilters.freeDelivery ? '✓' : ''}
            </button>

            <button onclick="window.app.toggleGlobalFilter('inStock')" 
              class="px-3 py-1 rounded-full font-semibold border transition-all flex items-center gap-1 whitespace-nowrap ${this.globalFilters.inStock ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'}">
              📦 In Stock ${this.globalFilters.inStock ? '✓' : ''}
            </button>

            <button onclick="window.app.toggleGlobalFilter('pickupAvailable')" 
              class="px-3 py-1 rounded-full font-semibold border transition-all flex items-center gap-1 whitespace-nowrap ${this.globalFilters.pickupAvailable ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'}">
              🏬 Store Pickup ${this.globalFilters.pickupAvailable ? '✓' : ''}
            </button>
          </div>

          <!-- Sort Dropdown/Pills -->
          <div class="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span class="text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap">Sort:</span>
            <button onclick="window.app.setGlobalSort('lowest_total')" 
              class="px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${this.globalSort === 'lowest_total' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
              🏷️ Lowest Total
            </button>
            <button onclick="window.app.setGlobalSort('lowest_price')" 
              class="px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${this.globalSort === 'lowest_price' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
              💰 Lowest Price
            </button>
            <button onclick="window.app.setGlobalSort('fastest_time')" 
              class="px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${this.globalSort === 'fastest_time' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
              ⚡ Fastest
            </button>
          </div>
        </div>

        <!-- 2-Column Mobile / 4-Column Desktop Grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          ${prods.map(p => {
            const offers = this.getSortedStoreOffersForProduct(p);
            const bestOffer = offers[0] || null;
            const minPrice = bestOffer ? bestOffer.price : p.mrp;
            const discountPct = Math.round(((p.mrp - minPrice) / p.mrp) * 100);
            const isExpanded = !!this.expandedStoreCards[p.id];
            const hasFreeDelivery = offers.some(o => o.deliveryFee === 0);

            return `
              <div class="product-card flex flex-col justify-between overflow-hidden relative group">
                
                <!-- Top Wishlist Heart Icon -->
                <button onclick="alert('❤️ Added ${p.name} to Wishlist!')" class="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 backdrop-blur text-slate-400 hover:text-rose-600 flex items-center justify-center shadow transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                </button>

                <!-- Product Photo (Click opens full Product Detail & Multi-Store View) -->
                <div class="relative overflow-hidden bg-slate-50 aspect-square cursor-pointer" onclick="window.compareEngine.openComparisonPage('${p.id}')">
                  <img src="${p.photoUrl}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                  ${discountPct > 0 ? `
                    <span class="absolute bottom-2 left-2 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow tracking-wider uppercase">
                      ${discountPct}% OFF
                    </span>
                  ` : ''}
                </div>

                <!-- Product Details -->
                <div class="p-3 flex flex-col justify-between flex-grow">
                  <div>
                    <!-- Product Title (Click opens full Product Detail & Multi-Store View) -->
                    <h3 class="text-xs md:text-sm font-semibold text-slate-800 line-clamp-2 leading-snug cursor-pointer hover:text-indigo-600" onclick="window.compareEngine.openComparisonPage('${p.id}')">
                      ${p.name}
                    </h3>
                    <p class="text-[11px] text-slate-400 mt-0.5">${p.unit}</p>

                    <!-- Price Row -->
                    <div class="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
                      <span class="price-onwards text-sm md:text-base">₹${minPrice}</span>
                      <span class="text-[10px] text-slate-400 font-semibold">onwards</span>
                      <span class="price-mrp text-[11px]">₹${p.mrp}</span>
                      ${discountPct > 0 ? `<span class="discount-text text-[11px]">${discountPct}% off</span>` : ''}
                    </div>

                    <!-- Free Delivery Tag -->
                    <div class="mt-1 flex items-center gap-1.5">
                      <span class="badge-free-delivery">${hasFreeDelivery ? 'Free Delivery' : (offers.length > 0 ? `Delivery from ₹${offers[0]?.deliveryFee || 10}` : 'Delivery Available')}</span>
                    </div>

                    <!-- Rating Capsule -->
                    <div class="flex items-center gap-1.5 mt-2">
                      <span class="badge-rating">
                        ${p.rating} ★
                      </span>
                      <span class="text-[11px] text-slate-400">
                        (${p.reviews} Reviews)
                      </span>
                    </div>
                  </div>

                  <!-- Store Comparison Toggle Drawer -->
                  <div class="mt-3 pt-2 border-t border-slate-100">
                    
                    ${offers.length > 0 ? `
                      <button onclick="window.app.toggleExpandStores('${p.id}')"
                        class="w-full py-1.5 px-2 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition flex items-center justify-between">
                        <span class="flex items-center gap-1">
                          <span>🏬</span>
                          <span>${offers.length} Online Stores from <strong>₹${minPrice}</strong></span>
                        </span>
                        <span class="text-xs">${isExpanded ? '▲ Close' : '▼ Compare'}</span>
                      </button>

                      <!-- Expanded Stores Table (Strictly Online Stores Only) -->
                      ${isExpanded ? `
                        <div class="mt-2 space-y-1.5 animate-in fade-in duration-200">
                          ${offers.map((offer, idx) => `
                            <div class="p-2 rounded-xl border ${idx === 0 ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-100 bg-slate-50'} text-[11px] flex items-center justify-between gap-1">
                              <div class="truncate max-w-[100px]">
                                <p class="font-bold text-slate-800 truncate">${offer.store.name}</p>
                                <p class="text-[10px] text-slate-400">📍 ${offer.distanceKm}km • ~${offer.estDeliveryMins}m</p>
                              </div>

                              <div class="text-right">
                                <span class="font-extrabold text-slate-900 block">₹${offer.price}</span>
                                <span class="text-[9px] text-slate-400">${offer.deliveryFee === 0 ? 'FREE Del' : `+₹${offer.deliveryFee}`}</span>
                              </div>

                              <button onclick="window.app.addProductToCart('${p.id}', '${offer.store.id}', ${offer.price})"
                                class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] shadow-sm flex-shrink-0">
                                + Add
                              </button>
                            </div>
                          `).join('')}
                        </div>
                      ` : ''}

                      <!-- Single Direct Add to Cart for Best Online Store -->
                      ${!isExpanded && bestOffer ? `
                        <button onclick="window.app.addProductToCart('${p.id}', '${bestOffer.store.id}', ${bestOffer.price})"
                          class="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                          <span>Add from ${bestOffer.store.name.split(' ')[0]}</span>
                        </button>
                      ` : ''}
                    ` : `
                      <div class="py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-[11px] text-slate-400 font-semibold">
                        ❌ All nearby stores currently offline
                      </div>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        <!-- Verified Local Services Showcase (Featured on Home Page) -->
        ${this.currentCategory === 'all' && !this.searchQuery ? `
          <div class="mt-8 pt-6 border-t border-slate-200">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>🛠️ Local Home Services & Repairs</span>
                  <span class="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">45 Mins Arrival</span>
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">AC Repair, Electricians, Carpenters & Salon Experts at your doorstep in Noida</p>
              </div>
              <button onclick="window.app.setMainTab('services')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl transition">
                <span>View All (${window.centralStore.getServices().length})</span>
                <span>➔</span>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              ${window.centralStore.getServices().slice(0, 3).map(s => `
                <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3 hover:border-indigo-300 transition">
                  <img src="${s.photoUrl}" class="w-16 h-16 rounded-xl object-cover border flex-shrink-0" alt="${s.name}">
                  <div class="flex-grow min-w-0">
                    <span class="text-[9px] font-extrabold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">${s.category}</span>
                    <h4 class="font-bold text-xs text-slate-900 truncate mt-1">${s.name}</h4>
                    <p class="text-[11px] text-slate-500 font-semibold mt-0.5">₹${s.visitCharge} visit charge • ⭐ ${s.rating}</p>
                  </div>
                  <button onclick="window.app.bookService('${s.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm flex-shrink-0">
                    Book ➔
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 2. Nearby Shops Directory (Strictly Online Shops in Active Location)
  renderShopsView(container) {
    const activeLoc = window.centralStore.state.selectedLocation || { area: 'Local Area', city: 'City' };
    const onlineShops = window.centralStore.getStoresForActiveLocation(40).filter(s => window.centralStore.isStoreOnline(s.id));

    if (onlineShops.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-slate-500 col-span-full bg-white rounded-3xl p-8 border border-slate-100">
          <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3 text-rose-500">
            🏬
          </div>
          <p class="font-bold text-slate-800 text-lg">No nearby stores currently online near ${activeLoc.area}</p>
          <p class="text-sm text-slate-400 mt-1">Please select another delivery location or register a new store in Admin.</p>
          <button onclick="window.app.openLocationModal()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md">
            📍 Switch Location ➔
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-black text-slate-900">Verified Stores Serving ${activeLoc.area}</h2>
          <p class="text-xs text-slate-500 font-medium">All nearby stores within fast delivery distance</p>
        </div>
        <span class="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
          ${onlineShops.length} Online Stores
        </span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${onlineShops.map(s => `
          <div class="product-card p-4">
            <div class="flex gap-4">
              <img src="${s.photoUrl}" alt="${s.name}" class="w-20 h-20 rounded-2xl object-cover border">
              <div class="flex-grow">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-bold text-slate-900 text-sm md:text-base">${s.name}</h3>
                  <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> OPEN NOW
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">${s.address}</p>
                <div class="flex items-center gap-3 text-xs text-slate-500 mt-2">
                  <span class="badge-rating">${s.rating} ★</span>
                  <span class="text-slate-400">(${s.reviewsCount} reviews)</span>
                  <span>•</span>
                  <span class="font-bold text-indigo-600">📍 ${s.distanceKm || 1.0} km</span>
                  <span>•</span>
                  <span class="text-slate-600 font-bold">⚡ ${s.estDeliveryMins || 20}m</span>
                </div>
              </div>
            </div>

            <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="text-slate-500 font-medium">Delivery: <strong class="text-slate-900">${s.deliveryFee === 0 ? 'FREE' : `₹${s.deliveryFee}`}</strong></span>
              <button onclick="window.app.setCategory('${s.category || 'all'}')" class="text-indigo-600 font-bold hover:underline">
                Shop Catalog ➔
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 3. Hyperlocal Services (Dynamic Services)
  renderServicesView(container) {
    const services = window.centralStore.getServices();

    if (services.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-slate-500 col-span-full bg-white rounded-3xl p-8 border border-slate-100">
          <div class="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600 text-2xl">
            🛠️
          </div>
          <p class="font-bold text-slate-800 text-lg">No services registered yet</p>
          <p class="text-sm text-slate-400 mt-1">You can add AC technicians, electricians, plumbers from the Admin Portal.</p>
          <a href="admin.html" class="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md">
            + Add Services in Portal ➔
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Services Banner -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-800/50 shadow-md">
          <div>
            <span class="bg-indigo-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">🛠️ Verified Local Pros</span>
            <h3 class="text-lg md:text-xl font-black mt-1.5">Doorstep Home Services & Repairs in 45 Minutes</h3>
            <p class="text-xs text-slate-300 mt-0.5">Background-checked electricians, AC experts, carpenters & beauticians in Sector 62, Noida.</p>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <div class="bg-white/10 backdrop-blur px-3 py-2 rounded-xl text-center border border-white/10">
              <span class="text-xs font-bold text-amber-300 block">⚡ Instant Slot</span>
              <span class="text-sm font-black">Within 45m</span>
            </div>
            <div class="bg-white/10 backdrop-blur px-3 py-2 rounded-xl text-center border border-white/10">
              <span class="text-xs font-bold text-emerald-300 block">🛡️ Guarantee</span>
              <span class="text-sm font-black">100% Safe</span>
            </div>
          </div>
        </div>

        <!-- Grid of Services -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${services.map(s => `
            <div class="product-card overflow-hidden flex flex-col justify-between bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:border-indigo-300 transition">
              <div>
                <img src="${s.photoUrl}" alt="${s.name}" class="w-full h-44 object-cover">
                <div class="p-4">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      ${s.category}
                    </span>
                    <span class="badge-rating font-black text-xs text-amber-500">⭐ ${s.rating} <span class="text-slate-400 font-normal">(${s.reviews || 25})</span></span>
                  </div>
                  <h3 class="font-bold text-slate-900 text-sm md:text-base mt-2">${s.name}</h3>
                  <p class="text-xs text-slate-500 mt-1 line-clamp-2">${s.description}</p>

                  <!-- Technician Info -->
                  <div class="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      ${(s.provider?.name || 'T').charAt(0)}
                    </div>
                    <div class="text-xs">
                      <p class="font-bold text-slate-800">${s.provider?.name || 'Verified Technician'}</p>
                      <p class="text-slate-400 text-[10px]">${s.provider?.experienceYears || 5} yrs experience • Verified Pro</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-slate-400 uppercase font-bold block">Visiting Charge</span>
                  <span class="font-black text-lg text-slate-950">₹${s.visitCharge}</span>
                </div>
                <button onclick="window.app.bookService('${s.id}')"
                  class="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition">
                  Book Slot ➔
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // --- Cart Drawer & Zomato Checkout Flow ---
  openCart() {
    this.renderCartDrawer();
    const drawer = document.getElementById('cartDrawer');
    if (drawer) {
      drawer.classList.remove('translate-x-full');
    }
  }

  closeCart() {
    const drawer = document.getElementById('cartDrawer');
    if (drawer) {
      drawer.classList.add('translate-x-full');
    }
  }

  renderCartDrawer() {
    const container = document.getElementById('cartItemsContainer');
    const totalsContainer = document.getElementById('cartTotalsContainer');
    if (!container || !totalsContainer) return;

    const cart = window.centralStore.state.cart;
    const totals = window.centralStore.getCartTotals(this.selectedOrderType, this.selectedTimeSlot);

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-slate-400">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          </div>
          <p class="font-bold text-slate-700">Your cart is empty</p>
          <p class="text-xs text-slate-400 mt-1">Browse products and choose your nearby store!</p>
        </div>
      `;
      totalsContainer.innerHTML = '';
      return;
    }

    // Render Store Banner
    container.innerHTML = `
      <div class="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3 mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-xs">
            🏬
          </div>
          <div>
            <span class="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Fulfilling Store</span>
            <p class="font-bold text-slate-900 text-xs">${cart[0].storeName}</p>
          </div>
        </div>
        <button onclick="window.app.clearCart()" class="text-xs text-rose-600 font-bold hover:underline">Clear All</button>
      </div>

      <!-- Item List -->
      <div class="space-y-3">
        ${cart.map(item => `
          <div class="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100">
            <img src="${item.photoUrl}" class="w-12 h-12 rounded-xl object-cover border" alt="${item.name}">
            <div class="flex-grow">
              <h4 class="font-bold text-slate-900 text-xs line-clamp-1">${item.name}</h4>
              <p class="text-[11px] text-slate-400">${item.unit} • ₹${item.price} each</p>
            </div>

            <!-- Qty Counter -->
            <div class="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-xl">
              <button onclick="window.app.updateCartQty('${item.productId}', -1)" class="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:text-rose-600 text-sm">-</button>
              <span class="font-extrabold text-xs text-slate-900 w-4 text-center">${item.quantity}</span>
              <button onclick="window.app.updateCartQty('${item.productId}', 1)" class="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:text-emerald-600 text-sm">+</button>
            </div>

            <span class="font-extrabold text-xs text-slate-900">₹${item.price * item.quantity}</span>
          </div>
        `).join('')}
      </div>

      <!-- Zomato-Style Delivery vs Pickup Switcher -->
      <div class="mt-6 border-t border-slate-100 pt-4">
        <label class="text-xs font-bold text-slate-900 mb-2 block">Choose Fulfillment Mode:</label>
        <div class="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
          <button onclick="window.app.setOrderType('delivery')"
            class="py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${this.selectedOrderType === 'delivery' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-500/20' : 'text-slate-600'}">
            🛵 Doorstep Delivery
          </button>
          <button onclick="window.app.setOrderType('pickup')"
            class="py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${this.selectedOrderType === 'pickup' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-500/20' : 'text-slate-600'}">
            🏬 Store Pickup
          </button>
        </div>
      </div>

      <!-- Time Slot Selection -->
      <div class="mt-4">
        <label class="text-xs font-bold text-slate-900 mb-2 block">Choose Time Slot & Delivery Speed:</label>
        <div class="space-y-2">
          ${window.APP_DATA.TIME_SLOTS.filter(s => s.type === this.selectedOrderType).map(slot => {
            const isSelected = this.selectedTimeSlot === slot.label;
            return `
              <div onclick="window.app.setTimeSlot('${slot.label}')" 
                class="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-1 ring-indigo-500/30' : 'border-slate-200 hover:border-slate-300'}">
                <div class="flex items-center gap-2">
                  <input type="radio" name="timeSlot" value="${slot.label}" ${isSelected ? 'checked' : ''} onchange="window.app.setTimeSlot('${slot.label}')" class="text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                  <span class="text-xs font-bold text-slate-800">${slot.label}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <span class="text-[10px] font-black ${slot.fee === 0 ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-indigo-700 bg-indigo-50 border border-indigo-200'} px-2 py-0.5 rounded-md">
                    ${slot.feeLabel || (slot.fee === 0 ? 'FREE' : `+₹${slot.fee}`)}
                  </span>
                  <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${slot.badgeClass}">${slot.tag}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Totals Breakdown
    totalsContainer.innerHTML = `
      <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
        <div class="flex justify-between text-slate-600">
          <span>Items Total (${totals.itemsCount} items)</span>
          <span class="font-bold text-slate-900">₹${totals.itemsTotal}</span>
        </div>
        <div class="flex justify-between text-slate-600">
          <span>Delivery Fee (${this.selectedOrderType === 'pickup' ? 'Store Pickup' : (totals.deliveryFee === 0 ? 'Saver Slot' : 'Express/Slot Fee')})</span>
          <span class="font-bold ${totals.deliveryFee === 0 ? 'text-emerald-600' : 'text-slate-900'}">${totals.deliveryFee === 0 ? 'FREE' : `₹${totals.deliveryFee}`}</span>
        </div>
        ${totals.savings > 0 ? `
          <div class="flex justify-between text-emerald-700 font-semibold">
            <span>Total Savings</span>
            <span>-₹${totals.savings}</span>
          </div>
        ` : ''}
        <div class="border-t border-slate-200 pt-2 flex justify-between text-sm font-extrabold text-slate-950">
          <span>Grand Total</span>
          <span class="text-indigo-600 text-base">₹${totals.grandTotal}</span>
        </div>
      </div>

      <button onclick="window.app.proceedToCheckout()"
        class="w-full mt-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2">
        <span>Proceed to Checkout • ₹${totals.grandTotal}</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      </button>
    `;
  }

  setTimeSlot(slotLabel) {
    this.selectedTimeSlot = slotLabel;
    this.renderCartDrawer();
  }

  setOrderType(type) {
    this.selectedOrderType = type;
    this.selectedTimeSlot = type === 'delivery' 
      ? '⚡ Express Delivery (15-25 Mins)' 
      : '🏬 Instant Store Pickup (Ready in 15 mins)';
    this.renderCartDrawer();
  }

  // --- Guest Checkout & Order Placement ---
  proceedToCheckout() {
    this.closeCart();
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    const cart = window.centralStore.state.cart;
    if (cart.length === 0) return;

    const fulfillingStoreId = cart[0]?.storeId;
    const store = window.centralStore.getStores().find(s => s.id === fulfillingStoreId);
    const totals = window.centralStore.getCartTotals(this.selectedOrderType, this.selectedTimeSlot);

    const isPickup = this.selectedOrderType === 'pickup';
    const tagEl = document.getElementById('checkoutFulfillmentTag');
    const titleEl = document.getElementById('checkoutModalTitle');
    const addrContainer = document.getElementById('checkoutAddressSection');
    const btnText = document.getElementById('checkoutSubmitBtnText');

    if (tagEl) {
      tagEl.textContent = isPickup ? '🏬 Instant Store Pickup' : '⚡ Express Doorstep Delivery';
      tagEl.className = isPickup 
        ? 'text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full' 
        : 'text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full';
    }

    if (titleEl) {
      titleEl.textContent = isPickup ? 'Confirm Pickup & Payment' : 'Delivery Address & Payment';
    }

    if (addrContainer) {
      if (isPickup) {
        addrContainer.innerHTML = `
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1 text-xs">
            <div class="flex items-center justify-between">
              <strong class="text-amber-900 font-black text-sm">🏬 Store Pickup Location:</strong>
              <span class="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">Ready in 15 mins</span>
            </div>
            <p class="text-slate-800 font-bold text-xs">${store?.name || cart[0].storeName}</p>
            <p class="text-slate-600 text-[11px]">${store?.address || 'Local Market'} • PIN: ${store?.pincode || window.centralStore.state.selectedLocation?.pincode || '201301'}</p>
            <p class="text-emerald-700 font-semibold text-[11px] pt-1">✓ Zero Delivery Fee applied to this order.</p>
          </div>
          <div class="pt-1">
            <label class="font-bold text-slate-700 block mb-1">Pickup Notes / Person Name (Optional)</label>
            <input type="text" id="checkoutAddress" value="Self Pickup at Store Counter" class="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          </div>
        `;
      } else {
        const loc = window.centralStore.state.selectedLocation || { area: 'Current Area', city: 'City', pincode: '201301' };
        const defaultAddress = `Flat 402, Tower B, ${loc.area}, ${loc.city} - ${loc.pincode}`;
        addrContainer.innerHTML = `
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-bold text-slate-700 block">Delivery Address / Flat / Tower *</label>
              <span class="text-[10px] text-indigo-600 font-bold">📍 Synced with ${loc.city || 'Location'}</span>
            </div>
            <textarea id="checkoutAddress" rows="2" class="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none">${defaultAddress}</textarea>
          </div>
        `;
      }
    }

    if (btnText) {
      btnText.textContent = `Place Order • ₹${totals.grandTotal}`;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  confirmOrder() {
    const name = document.getElementById('checkoutName')?.value || 'Customer';
    const phone = document.getElementById('checkoutPhone')?.value || '9876543210';
    const loc = window.centralStore.state.selectedLocation || { area: 'Current Area', city: 'City', pincode: '201301', lat: 28.6280, lng: 77.3649 };
    const address = document.getElementById('checkoutAddress')?.value || `${loc.area}, ${loc.city}`;
    const payMode = document.querySelector('input[name="paymentMode"]:checked')?.value || 'COD';

    const cart = window.centralStore.state.cart;
    if (cart.length === 0) return;

    const store = window.centralStore.getStores().find(s => s.id === cart[0].storeId);

    const order = window.centralStore.placeOrder({
      storeId: cart[0].storeId,
      storeName: cart[0].storeName,
      orderType: this.selectedOrderType,
      timeSlot: this.selectedTimeSlot,
      customerName: name,
      customerPhone: phone,
      deliveryAddress: address,
      customerLat: loc.lat || 28.6280,
      customerLng: loc.lng || 77.3649,
      storeLat: store?.lat || 28.6280,
      storeLng: store?.lng || 77.3649,
      paymentMode: payMode
    });

    this.closeCheckoutModal();
    this.openLiveTracking(order);
  }

  // --- Live Map Tracking Screen ---
  openLiveTracking(order) {
    this.activeTrackingOrder = order;
    const trackingScreen = document.getElementById('liveTrackingModal');
    if (!trackingScreen) return;

    trackingScreen.classList.remove('hidden');
    trackingScreen.classList.add('flex');

    this.updateLiveTrackingUI(order);

    // Initialize Leaflet Map with actual store & customer doorstep coordinates
    const store = window.centralStore.getStores().find(s => s.id === order.storeId);
    const storeLat = order.storeLat || store?.lat || 28.6280;
    const storeLng = order.storeLng || store?.lng || 77.3649;
    const custLat = order.customerLat || window.centralStore.state.selectedLocation?.lat || (storeLat - 0.0035);
    const custLng = order.customerLng || window.centralStore.state.selectedLocation?.lng || (storeLng + 0.0025);

    if (!this.mapTracker) {
      this.mapTracker = new window.LiveMapTracker('leafletMapContainer');
    }
    this.mapTracker.initMap(storeLat, storeLng, custLat, custLng);

    const isPickup = order.orderType === 'pickup';
    const etaElem = document.getElementById('trackEtaStatus');
    if (!isPickup) {
      this.mapTracker.startLiveMovement((data) => {
        if (etaElem && order.driver) etaElem.textContent = data.status;
      });
    }
  }

  updateLiveTrackingUI(order) {
    const orderNum = document.getElementById('trackOrderNumber');
    const storeName = document.getElementById('trackStoreName');
    const otpCode = document.getElementById('trackOtpCode');
    const etaElem = document.getElementById('trackEtaStatus');
    const driverName = document.getElementById('trackDriverName');
    const driverPlate = document.getElementById('trackDriverPlate');

    if (orderNum) orderNum.textContent = order.orderNumber;
    if (storeName) storeName.textContent = order.storeName;
    if (otpCode) otpCode.textContent = order.otp;

    const isPickup = order.orderType === 'pickup';

    if (isPickup) {
      if (etaElem) etaElem.textContent = `🏬 Your order is being prepared for pickup at ${order.storeName}! Show OTP at counter.`;
      if (driverName) driverName.textContent = `Self-Pickup Order (${order.storeName})`;
      if (driverPlate) driverPlate.textContent = `Counter Pickup • Ready in 15 mins`;
    } else if (!order.driver) {
      if (driverName) driverName.textContent = '🛵 Finding Delivery Partner...';
      const locArea = window.centralStore.state.selectedLocation?.area || 'Local Area';
      if (driverPlate) driverPlate.textContent = `Connecting to nearest ${locArea} Fleet Rider`;
      if (etaElem) etaElem.textContent = 'Order Placed! Open driver.html to accept dispatch and start delivery run.';
    } else {
      if (driverName) driverName.textContent = order.driver.name;
      if (driverPlate) driverPlate.textContent = `${order.driver.plateNumber} (★ ${order.driver.rating || 5.0})`;
      if (etaElem) etaElem.textContent = `Rider ${order.driver.name} is on the way (3 mins away)`;
    }
  }

  callAssignedRider() {
    const driver = this.activeTrackingOrder?.driver;
    if (driver && driver.phone) {
      window.location.href = `tel:${driver.phone}`;
    } else {
      if (window.notify) window.notify.info('Connecting to active fleet delivery partner...', 'Calling Rider');
      else alert('📞 Connecting to delivery partner...');
    }
  }

  whatsappAssignedRider() {
    const driver = this.activeTrackingOrder?.driver;
    const phone = driver?.phone || '9822338877';
    const text = encodeURIComponent(`Hi ${driver?.name || 'Partner'}, regarding my HyperLocal order ${this.activeTrackingOrder?.orderNumber || ''}:`);
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
  }

  closeLiveTracking() {
    if (this.mapTracker) this.mapTracker.stopLiveMovement();
    const trackingScreen = document.getElementById('liveTrackingModal');
    if (trackingScreen) {
      trackingScreen.classList.add('hidden');
      trackingScreen.classList.remove('flex');
    }
  }

  // --- Booking Services ---
  bookService(serviceId) {
    const s = window.centralStore.getServices().find(srv => srv.id === serviceId);
    if (!s) return;

    if (window.notify) {
      window.notify.confirm({
        title: `Book ${s.name}?`,
        message: `Visiting Fee: ₹${s.visitCharge}\nTechnician: ${s.provider?.name || 'Verified Expert'}\nEstimated Arrival: Within 45 mins at your saved location.\n\nDo you want to confirm this doorstep appointment?`,
        confirmText: 'Confirm Booking',
        cancelText: 'Cancel',
        onConfirm: () => {
          window.notify.success(`🎉 Appointment confirmed for ${s.name}! Technician ${s.provider?.name || 'Expert'} will arrive within 45 mins.`, 'Service Booked');
        }
      });
    } else {
      alert(`🎉 Service Appointment Confirmed!\n\nService: ${s.name}\nTechnician: ${s.provider?.name || 'Technician'}\nVisiting Charge: ₹${s.visitCharge}\n\nOur verified professional will arrive at your address within 45 mins.`);
    }
  }

  // --- Role Switcher & Auth Helpers ---
  switchRole(role) {
    window.centralStore.switchRole(role);
    this.updateNavbarBadges();
    if (role === 'store_owner' || role === 'superadmin') {
      window.location.href = 'admin.html';
    } else {
      alert(`Switched to: ${role.toUpperCase()} mode.`);
    }
  }

  updateNavbarBadges() {
    const totals = window.centralStore.getCartTotals();
    const badge = document.getElementById('cartBadgeCount');
    if (badge) {
      badge.textContent = totals.itemsCount;
      badge.style.display = totals.itemsCount > 0 ? 'flex' : 'none';
    }

    const locText = document.getElementById('currentLocationText');
    const heroSub = document.getElementById('heroLocationSubtitle');
    if (window.centralStore.state.selectedLocation) {
      const loc = window.centralStore.state.selectedLocation;
      if (locText) locText.textContent = `${loc.area || loc.city} (${loc.pincode || '201301'})`;
      if (heroSub) heroSub.textContent = `Comparing real-time prices & 15-min delivery across verified merchant stores in ${loc.area || 'your area'}.`;
    }
  }

  // ================= REAL LOCATION & GPS ENGINE =================
  openLocationModal() {
    this.renderPopularLocations();
    const modal = document.getElementById('locationModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  renderPopularLocations(cityFilter = 'all') {
    const container = document.getElementById('popularLocationsList');
    if (!container) return;

    let list = window.APP_DATA?.POPULAR_LOCATIONS || [];
    if (cityFilter && cityFilter !== 'all') {
      list = list.filter(l => l.city?.toLowerCase() === cityFilter.toLowerCase() || (cityFilter === 'Noida' && l.city === 'Noida'));
    }

    const currentPin = window.centralStore.state.selectedLocation?.pincode;

    container.innerHTML = list.map(loc => {
      const isSelected = currentPin === loc.pincode && window.centralStore.state.selectedLocation?.area.includes(loc.area.split(',')[0]);
      return `
        <button onclick="window.app.selectLocation('${loc.pincode}', '${loc.area}', '${loc.city}', ${loc.lat}, ${loc.lng})"
          class="w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between group ${
            isSelected 
              ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
              : 'border-slate-200/80 bg-slate-50/60 hover:bg-indigo-50/30 hover:border-indigo-300'
          }">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200/70 text-slate-700'} flex items-center justify-center font-bold text-sm group-hover:bg-indigo-600 group-hover:text-white transition">
              📍
            </div>
            <div>
              <div class="flex items-center gap-2">
                <strong class="text-slate-900 block text-xs sm:text-sm font-black">${loc.area}</strong>
                ${loc.tag ? `<span class="bg-indigo-100 text-indigo-800 text-[9px] font-black px-1.5 py-0.2 rounded">${loc.tag}</span>` : ''}
              </div>
              <span class="text-slate-500 text-[11px]">PIN: <strong>${loc.pincode}</strong> • ${loc.city}, ${loc.state} • ${loc.storesCount} Stores</span>
            </div>
          </div>
          <span class="text-xs font-black ${isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'} transition">
            ${isSelected ? '✓ Active' : 'Select ➔'}
          </span>
        </button>
      `;
    }).join('');
  }

  filterPopularLocations(city) {
    document.querySelectorAll('.city-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-city') === city) {
        btn.className = 'city-tab-btn active px-3 py-1 rounded-full font-bold bg-slate-900 text-white';
      } else {
        btn.className = 'city-tab-btn px-3 py-1 rounded-full font-bold bg-slate-100 hover:bg-slate-200 text-slate-700';
      }
    });
    this.renderPopularLocations(city);
  }

  // --- Real Device GPS Auto-Detection (OpenStreetMap Reverse Geocoding) ---
  detectLiveGpsLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    const titleEl = document.getElementById('gpsDetectTitle');
    const subEl = document.getElementById('gpsDetectSubtitle');
    const btn = document.getElementById('btnDetectGps');

    if (titleEl) titleEl.textContent = '🛰️ Fetching Live Satellite Coordinates...';
    if (subEl) subEl.textContent = 'Requesting GPS sensor permission from your browser...';
    if (btn) btn.classList.add('animate-pulse');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (titleEl) titleEl.textContent = '📍 Resolving Street Address & Pincode...';

        try {
          // Free, high-accuracy reverse geocoding from OpenStreetMap Nominatim
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
          const data = await res.json();
          const addr = data.address || {};
          
          const area = addr.suburb || addr.neighbourhood || addr.road || addr.residential || addr.city_district || 'My Location';
          const city = addr.city || addr.town || addr.state_district || 'NCR';
          const pincode = addr.postcode || '201301';

          this.selectLocation(pincode, `${area}, ${city}`, city, lat, lng);
          if (window.notify) {
            window.notify.success(`📍 Live GPS Detected: ${area}, ${city} (${pincode})`, 'Location Updated');
          }
        } catch (e) {
          // Fallback with live coordinates
          this.selectLocation('201301', 'Current GPS Location', 'Local Area', lat, lng);
          if (window.notify) {
            window.notify.success(`📍 Live GPS set: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`, 'GPS Synced');
          }
        } finally {
          if (btn) btn.classList.remove('animate-pulse');
        }
      },
      (err) => {
        if (btn) btn.classList.remove('animate-pulse');
        if (titleEl) titleEl.textContent = 'Detect My Live GPS Location';
        if (subEl) subEl.textContent = 'Permission denied or unavailable. Please select from the list below.';
        alert('GPS Location access was denied or unavailable. Please search your pincode/area or select from popular hubs below.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // --- Real-time Pincode & City Search Engine ---
  handleLocationSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const resultsContainer = document.getElementById('locationSearchResults');
    if (!resultsContainer) return;

    if (!q) {
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      return;
    }

    resultsContainer.classList.remove('hidden');

    // 1. Search locally in built-in hubs
    const localMatches = (window.APP_DATA?.POPULAR_LOCATIONS || []).filter(l => 
      l.pincode.includes(q) || 
      l.area.toLowerCase().includes(q) || 
      l.city.toLowerCase().includes(q) || 
      l.state.toLowerCase().includes(q)
    );

    let html = `
      <div class="bg-indigo-50/50 p-2.5 rounded-2xl border border-indigo-100 mb-2">
        <span class="text-[10px] font-black text-indigo-700 uppercase">Search Matches for "${query}"</span>
      </div>
    `;

    if (localMatches.length > 0) {
      html += localMatches.map(loc => `
        <button onclick="window.app.selectLocation('${loc.pincode}', '${loc.area}', '${loc.city}', ${loc.lat}, ${loc.lng})"
          class="w-full text-left p-3 rounded-2xl border border-slate-200 bg-white hover:bg-indigo-50/40 hover:border-indigo-600 flex items-center justify-between transition">
          <div>
            <strong class="text-slate-900 block text-xs font-bold">📍 ${loc.area}</strong>
            <span class="text-slate-500 text-[11px]">PIN: <strong>${loc.pincode}</strong> • ${loc.city}, ${loc.state}</span>
          </div>
          <span class="text-xs font-black text-indigo-600">Select ➔</span>
        </button>
      `).join('');
    }

    // 2. Dynamic 6-digit Pincode / OpenStreetMap search
    if (/^\d{6}$/.test(q)) {
      html += `
        <button onclick="window.app.selectCustomPincode('${q}')"
          class="w-full text-left p-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white hover:border-indigo-600 flex items-center justify-between transition">
          <div>
            <strong class="text-indigo-900 block text-xs font-black">📍 Set Delivery Pincode: ${q}</strong>
            <span class="text-slate-500 text-[11px]">Auto-recalibrate store radius for PIN: ${q}</span>
          </div>
          <span class="text-xs font-black text-indigo-600 bg-white px-2 py-1 rounded-md border border-indigo-200">Set PIN ➔</span>
        </button>
      `;
    } else if (localMatches.length === 0) {
      html += `
        <button onclick="window.app.selectCustomArea('${query}')"
          class="w-full text-left p-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 hover:border-indigo-600 flex items-center justify-between transition">
          <div>
            <strong class="text-indigo-900 block text-xs font-black">📍 Deliver to "${query}"</strong>
            <span class="text-slate-500 text-[11px]">Set custom delivery destination</span>
          </div>
          <span class="text-xs font-black text-indigo-600">Apply ➔</span>
        </button>
      `;
    }

    resultsContainer.innerHTML = html;
  }

  selectCustomPincode(pincode) {
    this.selectLocation(pincode, `PIN: ${pincode}`, 'Local Hub', 28.6280, 77.3649);
  }

  selectCustomArea(areaName) {
    this.selectLocation('201301', areaName, 'Local Hub', 28.6280, 77.3649);
  }

  selectLocation(pincode, area, city, lat, lng) {
    window.centralStore.setLocation(pincode, area, city, lat, lng);
    this.closeLocationModal();
    this.updateNavbarBadges();
    this.renderCurrentView();

    if (window.notify) {
      window.notify.success(`Delivery location updated to: ${area} (${pincode})`, 'Location Set');
    }
  }

  // ================= CUSTOMER MY ORDERS & HISTORY =================
  openMyOrdersModal() {
    this.renderMyOrdersModal();
    const modal = document.getElementById('myOrdersModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeMyOrdersModal() {
    const modal = document.getElementById('myOrdersModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  renderMyOrdersModal() {
    const container = document.getElementById('myOrdersContainer');
    if (!container) return;

    const orders = window.centralStore.getCustomerOrders();

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-slate-400 space-y-3">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-3xl">
            📦
          </div>
          <h4 class="font-black text-slate-800 text-base">No Orders Placed Yet</h4>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">Your past delivery orders, dispatches and invoices will appear here.</p>
          <button onclick="window.app.closeMyOrdersModal()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition">
            Start Shopping ➔
          </button>
        </div>
      `;
      return;
    }

    const statusBadges = {
      'delivered': '<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">✓ Delivered</span>',
      'placed': '<span class="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span> Placed • Finding Rider</span>',
      'driver_assigned': '<span class="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">🛵 Rider On The Way</span>',
      'at_store': '<span class="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">🏬 Rider at Store</span>',
      'picked_up': '<span class="bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">📦 Out For Delivery</span>',
      'store_accepted': '<span class="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">🏬 Store Preparing Order</span>'
    };

    container.innerHTML = `
      <div class="space-y-4">
        ${orders.map(order => {
          const isDelivered = order.status === 'delivered';
          const isPickup = order.orderType === 'pickup';
          const statusBadge = statusBadges[order.status] || `<span class="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">${order.status}</span>`;

          return `
            <div class="bg-white rounded-3xl border border-slate-200/80 hover:border-indigo-300 p-4 sm:p-5 shadow-sm transition space-y-4">
              
              <!-- Order Header -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-2xl ${isDelivered ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'} flex items-center justify-center text-base font-bold">
                    ${isPickup ? '🏬' : '🛵'}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="font-black text-slate-900 text-sm">${order.orderNumber}</h4>
                      ${statusBadge}
                    </div>
                    <p class="text-[11px] text-slate-400 font-mono">${order.placedAt || 'Recently'} • ${isPickup ? 'Store Pickup' : 'Express Delivery'}</p>
                  </div>
                </div>

                <div class="text-left sm:text-right">
                  <span class="text-[10px] font-bold text-slate-400 block uppercase">Total Paid</span>
                  <span class="text-base font-black text-slate-900">₹${order.grandTotal}</span>
                </div>
              </div>

              <!-- Store & Route Info -->
              <div class="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fulfilling Store</span>
                  <p class="font-bold text-slate-800">${order.storeName}</p>
                </div>
                <div class="sm:text-right">
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery OTP</span>
                  <span class="font-mono font-black text-indigo-600 text-sm tracking-widest">${order.otp || '----'}</span>
                </div>
              </div>

              <!-- Items List -->
              <div class="space-y-2">
                ${order.items.map(item => `
                  <div class="flex items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2.5">
                      <img src="${item.photoUrl}" class="w-9 h-9 rounded-xl object-cover border border-slate-100" alt="${item.name}">
                      <div>
                        <p class="font-bold text-slate-800 line-clamp-1">${item.name}</p>
                        <span class="text-[10px] text-slate-400">${item.unit || 'Standard'} • Qty: <strong>${item.quantity}</strong></span>
                      </div>
                    </div>
                    <span class="font-black text-slate-900">₹${item.price * item.quantity}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Action Buttons -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div class="flex items-center gap-2">
                  <!-- Reorder Button -->
                  <button onclick="window.app.reorderPastOrder('${order.id}')"
                    class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs transition flex items-center gap-1.5 border border-indigo-200/60 shadow-sm">
                    <span>🔄 1-Click Reorder</span>
                  </button>

                  <!-- Invoice Button -->
                  <button onclick="window.app.viewInvoice('${order.id}')"
                    class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition flex items-center gap-1.5">
                    <span>🧾 Tax Invoice</span>
                  </button>
                </div>

                ${!isDelivered ? `
                  <button onclick="window.app.closeMyOrdersModal(); window.app.openLiveTracking(window.centralStore.getOrderById('${order.id}'))"
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5">
                    <span>📍 Track Live Status</span>
                  </button>
                ` : `
                  <span class="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                    <span>✓ Order Completed</span>
                  </span>
                `}
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- 1-Click Reorder Action ---
  reorderPastOrder(orderId) {
    const res = window.centralStore.reorderPastOrder(orderId);
    if (res.success) {
      this.closeMyOrdersModal();
      this.renderCartDrawer();
      this.openCart();
      if (window.notify) {
        window.notify.success(`All items from ${res.order.orderNumber} added back to your cart!`, '1-Click Reorder');
      }
    } else {
      if (window.notify) {
        window.notify.warning(res.message, 'Reorder Failed');
      } else {
        alert(res.message);
      }
    }
  }

  // ================= PRINTABLE & DOWNLOADABLE TAX INVOICE =================
  viewInvoice(orderId) {
    const order = window.centralStore.getOrderById(orderId);
    if (!order) return;

    const container = document.getElementById('invoicePrintableContainer');
    if (!container) return;

    const store = window.centralStore.getStores().find(s => s.id === order.storeId);
    const invoiceNumber = `INV-2026-${order.orderNumber.replace('ORD-', '')}`;
    const invoiceDate = order.placedAt || '19 Aug 2026';
    const estimatedGst = Math.round((order.itemsTotal * 0.05)); // 5% GST included

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header Banner & Store Details -->
        <div class="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-4">
          <div>
            <div class="flex items-center gap-2 text-indigo-600 font-black text-xl tracking-tight">
              <span>⚡ Hyper<span class="text-slate-900">Local</span></span>
            </div>
            <p class="text-xs text-slate-500 font-medium mt-0.5">Fast Logistics & Local Marketplace Fleet</p>
            <p class="text-[11px] text-slate-400">Sector 62, Noida, UP - 201301</p>
          </div>

          <div class="text-left sm:text-right">
            <span class="text-xs font-black text-slate-900 uppercase tracking-wider block bg-slate-100 px-2 py-0.5 rounded">TAX INVOICE / CASH MEMO</span>
            <p class="font-black text-slate-900 text-sm mt-1">${invoiceNumber}</p>
            <p class="text-xs text-slate-500 font-mono">Date: ${invoiceDate}</p>
            <p class="text-[11px] text-slate-500">Order ID: <strong>${order.orderNumber}</strong></p>
          </div>
        </div>

        <!-- Store & Customer Two-Column Matrix -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <!-- Sold By (Merchant) -->
          <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sold By (Fulfilling Merchant):</span>
            <h4 class="font-black text-slate-900 text-sm">${order.storeName}</h4>
            <p class="text-slate-600">${store?.address || 'Sector 62 Market, Noida'}</p>
            <p class="text-slate-500 font-mono text-[11px]">GSTIN: 09AABCS1234F1Z5 • FSSAI: 12723000000123</p>
            <p class="text-slate-500">Contact: +91 9811223344</p>
          </div>

          <!-- Billed & Delivered To (Customer) -->
          <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Billed & Delivered To:</span>
            <h4 class="font-black text-slate-900 text-sm">${order.customerName}</h4>
            <p class="text-slate-600">${order.deliveryAddress}</p>
            <p class="text-slate-500">Phone: +91 ${order.customerPhone}</p>
            <p class="text-slate-500 font-bold">Mode: ${order.orderType === 'pickup' ? '🏬 Store Pickup' : '🛵 Doorstep Express'}</p>
          </div>
        </div>

        <!-- Line Items Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-100 text-slate-700 uppercase font-black text-[10px]">
                <th class="py-2.5 px-3">#</th>
                <th class="py-2.5 px-3">Item Description</th>
                <th class="py-2.5 px-3 text-right">Unit Price</th>
                <th class="py-2.5 px-3 text-center">Qty</th>
                <th class="py-2.5 px-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${order.items.map((item, idx) => `
                <tr>
                  <td class="py-2.5 px-3 text-slate-400 font-mono">${idx + 1}</td>
                  <td class="py-2.5 px-3 font-bold text-slate-800">
                    <div>${item.name}</div>
                    <div class="text-[10px] text-slate-400 font-normal">${item.unit || 'Standard'}</div>
                  </td>
                  <td class="py-2.5 px-3 text-right font-mono text-slate-700">₹${item.price}</td>
                  <td class="py-2.5 px-3 text-center font-bold text-slate-900">${item.quantity}</td>
                  <td class="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">₹${item.price * item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Calculation & Total Summary -->
        <div class="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
          <div class="space-y-1 text-slate-500 text-[11px]">
            <p><strong>Payment Mode:</strong> ${order.paymentMode || 'COD'}</p>
            <p><strong>Fulfillment Time Slot:</strong> ${order.timeSlot}</p>
            <p><strong>Taxes:</strong> CGST (2.5%) + SGST (2.5%) Included</p>
          </div>

          <div class="w-full sm:w-60 space-y-1.5 text-right">
            <div class="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span class="font-mono font-bold text-slate-900">₹${order.itemsTotal}</span>
            </div>
            ${order.savings > 0 ? `
              <div class="flex justify-between text-emerald-600 font-bold">
                <span>Discount / Savings:</span>
                <span class="font-mono">-₹${order.savings}</span>
              </div>
            ` : ''}
            <div class="flex justify-between text-slate-600">
              <span>Delivery & Handling:</span>
              <span class="font-mono font-bold ${order.deliveryFee === 0 ? 'text-emerald-600' : 'text-slate-900'}">${order.deliveryFee === 0 ? 'FREE' : '₹' + order.deliveryFee}</span>
            </div>
            <div class="flex justify-between text-slate-500 text-[11px]">
              <span>Taxes (5% GST Incl.):</span>
              <span class="font-mono">₹${estimatedGst}</span>
            </div>
            <div class="border-t-2 border-slate-900 pt-1.5 flex justify-between text-sm font-black text-slate-950">
              <span>Grand Total:</span>
              <span class="text-base text-indigo-600 font-mono">₹${order.grandTotal}</span>
            </div>
          </div>
        </div>

        <!-- Terms & Disclaimer -->
        <div class="border-t border-slate-100 pt-4 text-center text-[10px] text-slate-400 space-y-1">
          <p>This is a computer-generated tax invoice and does not require a physical signature.</p>
          <p>For support, cancellation or returns, please contact help@hyperlocal.app or WhatsApp +91 9876543210.</p>
        </div>

      </div>
    `;

    const modal = document.getElementById('invoiceModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  printInvoice() {
    window.print();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new CustomerApp();
});
