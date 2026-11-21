// Hyperlocal Multi-Store Product Detail & Comparison Engine

class MultiStoreComparisonEngine {
  constructor() {
    this.currentProduct = null;
    this.currentSort = 'lowest_total'; // 'lowest_total' | 'lowest_price' | 'fastest_time' | 'nearest' | 'rating'
    this.activeFilters = {
      freeDelivery: false,
      inStock: true,
      pickupAvailable: false
    };
    this.selectedImageIdx = 0;
    this.currentLightboxZoom = 1;
    this.currentLightboxIdx = 0;

    // Keyboard support for Lightbox
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('productLightboxModal');
      if (modal && !modal.classList.contains('hidden')) {
        if (e.key === 'Escape') this.closeLightboxModal();
        if (e.key === 'ArrowLeft') this.slideLightbox(-1);
        if (e.key === 'ArrowRight') this.slideLightbox(1);
        if (e.key === '+' || e.key === '=') this.changeLightboxZoom(0.3);
        if (e.key === '-') this.changeLightboxZoom(-0.3);
      }
    });
  }

  getProductPhotos() {
    const p = this.currentProduct;
    if (!p) return [];
    let list = [];
    if (p.photos && Array.isArray(p.photos) && p.photos.length > 0) {
      list = p.photos.filter(Boolean);
    } else if (p.photoUrl) {
      list = [p.photoUrl];
    }
    return [...new Set(list)];
  }

  selectImage(idx) {
    if (!this.currentProduct) return;
    const photos = this.getProductPhotos();
    if (idx < 0 || idx >= photos.length) return;
    this.selectedImageIdx = idx;

    const mainImg = document.getElementById('mainProductPhoto');
    if (mainImg) {
      mainImg.src = photos[idx];
    }

    photos.forEach((_, i) => {
      const thumb = document.getElementById(`prodThumb_${i}`);
      if (thumb) {
        if (i === idx) {
          thumb.className = 'w-16 h-16 rounded-xl border-2 border-indigo-600 ring-2 ring-indigo-300 p-0.5 cursor-pointer overflow-hidden flex-shrink-0 shadow-sm transition';
        } else {
          thumb.className = 'w-16 h-16 rounded-xl border border-slate-200 p-0.5 cursor-pointer overflow-hidden flex-shrink-0 opacity-70 hover:opacity-100 hover:border-slate-300 transition';
        }
      }
    });
  }

  handleImageZoom(e) {
    const container = e.currentTarget;
    const img = document.getElementById('mainProductPhoto');
    if (!container || !img) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = 'scale(2.2)';
  }

  resetImageZoom() {
    const img = document.getElementById('mainProductPhoto');
    if (img) {
      img.style.transformOrigin = 'center center';
      img.style.transform = 'scale(1)';
    }
  }

  openLightboxModal() {
    const photos = this.getProductPhotos();
    if (photos.length === 0) return;

    this.currentLightboxIdx = this.selectedImageIdx || 0;
    this.currentLightboxZoom = 1;

    let modal = document.getElementById('productLightboxModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'productLightboxModal';
      modal.className = 'fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-between p-4 hidden animate-in fade-in duration-200 select-none';
      document.body.appendChild(modal);
    }

    this.renderLightboxContent();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeLightboxModal() {
    const modal = document.getElementById('productLightboxModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.currentLightboxZoom = 1;
  }

  changeLightboxZoom(delta) {
    this.currentLightboxZoom = Math.min(Math.max(1, +(this.currentLightboxZoom + delta).toFixed(1)), 3.5);
    const img = document.getElementById('lightboxActiveImage');
    const zoomText = document.getElementById('lightboxZoomLevel');
    if (img) {
      img.style.transform = `scale(${this.currentLightboxZoom})`;
    }
    if (zoomText) {
      zoomText.innerText = `${Math.round(this.currentLightboxZoom * 100)}%`;
    }
  }

  resetLightboxZoom() {
    this.currentLightboxZoom = 1;
    const img = document.getElementById('lightboxActiveImage');
    const zoomText = document.getElementById('lightboxZoomLevel');
    if (img) {
      img.style.transform = 'scale(1)';
      img.style.transformOrigin = 'center center';
    }
    if (zoomText) {
      zoomText.innerText = '100%';
    }
  }

  slideLightbox(dir) {
    const photos = this.getProductPhotos();
    if (photos.length <= 1) return;
    this.currentLightboxIdx = (this.currentLightboxIdx + dir + photos.length) % photos.length;
    this.resetLightboxZoom();
    this.renderLightboxContent();
  }

  renderLightboxContent() {
    const modal = document.getElementById('productLightboxModal');
    if (!modal) return;
    const photos = this.getProductPhotos();
    const p = this.currentProduct;
    const curPhoto = photos[this.currentLightboxIdx] || p.photoUrl;

    modal.innerHTML = `
      <!-- Top Bar -->
      <div class="w-full max-w-5xl flex items-center justify-between text-white py-2 px-3 md:px-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <span class="font-bold text-xs md:text-sm truncate max-w-xs md:max-w-md">${p.name}</span>
          <span class="text-[10px] md:text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono font-bold">${this.currentLightboxIdx + 1} / ${photos.length}</span>
        </div>

        <!-- Zoom Controls -->
        <div class="flex items-center gap-1.5 md:gap-2">
          <button onclick="window.compareEngine.changeLightboxZoom(-0.3)" class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-base transition" title="Zoom Out">-</button>
          <span id="lightboxZoomLevel" class="text-xs font-mono font-bold w-12 text-center">${Math.round(this.currentLightboxZoom * 100)}%</span>
          <button onclick="window.compareEngine.changeLightboxZoom(0.3)" class="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-base transition" title="Zoom In">+</button>
          <button onclick="window.compareEngine.resetLightboxZoom()" class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition ml-1" title="Reset Zoom">↺ 100%</button>
          <button onclick="window.compareEngine.closeLightboxModal()" class="w-8 h-8 rounded-lg bg-rose-600/90 hover:bg-rose-600 flex items-center justify-center font-bold text-sm ml-2 md:ml-4 transition shadow-lg" title="Close">✕</button>
        </div>
      </div>

      <!-- Main Lightbox Image Stage -->
      <div class="relative w-full max-w-4xl flex-grow flex items-center justify-center overflow-hidden my-3">
        ${photos.length > 1 ? `
          <button onclick="window.compareEngine.slideLightbox(-1)" class="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur shadow-xl transition text-2xl font-black">‹</button>
        ` : ''}

        <div class="w-full h-full flex items-center justify-center overflow-hidden cursor-zoom-in" onclick="window.compareEngine.changeLightboxZoom(0.4)">
          <img id="lightboxActiveImage" src="${curPhoto}" alt="${p.name}" class="max-h-[68vh] max-w-[85vw] object-contain transition-transform duration-200 ease-out select-none shadow-2xl rounded-2xl">
        </div>

        ${photos.length > 1 ? `
          <button onclick="window.compareEngine.slideLightbox(1)" class="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur shadow-xl transition text-2xl font-black">›</button>
        ` : ''}
      </div>

      <!-- Bottom Thumbnails Strip -->
      ${photos.length > 1 ? `
        <div class="flex items-center gap-2 overflow-x-auto p-2 bg-black/40 backdrop-blur rounded-2xl border border-white/10 max-w-md mx-auto no-scrollbar">
          ${photos.map((img, i) => `
            <button onclick="window.compareEngine.currentLightboxIdx = ${i}; window.compareEngine.resetLightboxZoom(); window.compareEngine.renderLightboxContent();"
              class="w-12 h-12 rounded-xl overflow-hidden border-2 transition flex-shrink-0 ${i === this.currentLightboxIdx ? 'border-indigo-400 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}">
              <img src="${img}" class="w-full h-full object-cover">
            </button>
          `).join('')}
        </div>
      ` : '<div class="py-1"></div>'}
    `;
  }

  // Open Full Detailed In-Page View (Zero Popup Modal!)
  openComparisonPage(productId) {
    const products = window.centralStore.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    this.currentProduct = product;
    this.selectedImageIdx = 0;
    
    // Set active product in app controller
    if (window.app) {
      window.app.activeCompareProductId = productId;
      window.app.renderCurrentView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  closeComparisonPage() {
    if (window.app) {
      window.app.activeCompareProductId = null;
      window.app.renderCurrentView();
    }
  }

  setSort(sortKey) {
    this.currentSort = sortKey;
    const listContainer = document.getElementById('inpageStoreList');
    if (listContainer) {
      this.renderStoreListInto(listContainer);
    }
  }

  toggleFilter(filterKey) {
    this.activeFilters[filterKey] = !this.activeFilters[filterKey];
    const filterContainer = document.getElementById('inpageFilterChips');
    const listContainer = document.getElementById('inpageStoreList');
    if (filterContainer) this.renderFiltersInto(filterContainer);
    if (listContainer) this.renderStoreListInto(listContainer);
  }

  getProcessedStoreOffers() {
    if (!this.currentProduct || !this.currentProduct.stores) return [];

    const allStores = window.centralStore.getStores();

    const offers = this.currentProduct.stores.map(storeOffer => {
      const store = allStores.find(s => s.id === storeOffer.storeId);
      if (!store) return null;

      const isOnline = window.centralStore.isStoreOnline(store.id);
      const deliveryFee = store.deliveryFee === 0 || storeOffer.price >= (store.freeDeliveryAbove || 500) ? 0 : store.deliveryFee;
      const totalCost = storeOffer.price + deliveryFee;

      return {
        store,
        price: storeOffer.price,
        deliveryFee: deliveryFee,
        totalCost: totalCost,
        stock: storeOffer.stock,
        inStock: storeOffer.inStock !== false && (storeOffer.stock || 1) > 0,
        estDeliveryMins: store.estDeliveryMins,
        distanceKm: store.distanceKm,
        rating: store.rating,
        reviewsCount: store.reviewsCount,
        isOnline: isOnline,
        pickupAvailable: store.pickupAvailable
      };
    }).filter(Boolean);

    // Strictly include ONLY ONLINE stores (Offline stores are completely hidden)
    const onlineOffers = offers.filter(offer => offer.isOnline);

    // Apply Filters
    return onlineOffers.filter(offer => {
      if (this.activeFilters.freeDelivery && offer.deliveryFee > 0) return false;
      if (this.activeFilters.inStock && !offer.inStock) return false;
      if (this.activeFilters.pickupAvailable && !offer.pickupAvailable) return false;
      return true;
    }).sort((a, b) => {
      if (this.currentSort === 'lowest_price') return a.price - b.price;
      if (this.currentSort === 'lowest_total') return a.totalCost - b.totalCost;
      if (this.currentSort === 'fastest_time') return a.estDeliveryMins - b.estDeliveryMins;
      if (this.currentSort === 'nearest') return a.distanceKm - b.distanceKm;
      if (this.currentSort === 'rating') return b.rating - a.rating;
      return 0;
    });
  }

  // Render Full Rich Product Detail & Multi-Store Comparison Page
  renderInPageView(container) {
    const p = this.currentProduct;
    if (!p) return;

    const offers = this.getProcessedStoreOffers();
    const minPrice = offers.length > 0 ? Math.min(...offers.map(s => s.price)) : p.mrp;
    const discountPct = Math.round(((p.mrp - minPrice) / p.mrp) * 100);
    const relatedProducts = window.centralStore.getProducts().filter(item => item.category === p.category && item.id !== p.id).slice(0, 4);

    const photoList = this.getProductPhotos();
    const currentPhoto = photoList[this.selectedImageIdx] || p.photoUrl;

    container.innerHTML = `
      <div class="space-y-6 animate-in fade-in duration-200">
        
        <!-- Breadcrumb & Back Navigation -->
        <div class="flex items-center justify-between bg-white p-3 md:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <button onclick="window.compareEngine.closeComparisonPage()" 
            class="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-800 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/50 px-4 py-2 rounded-xl transition border border-slate-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            <span>← Back to All Products</span>
          </button>

          <div class="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span class="capitalize font-bold text-slate-700">${p.category}</span>
            <span>/</span>
            <span class="truncate max-w-[150px] sm:max-w-[280px] font-semibold text-slate-900">${p.name}</span>
          </div>
        </div>

        <!-- MAIN PRODUCT HERO SHOWCASE (2-Column Desktop Grid) -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white rounded-3xl p-5 md:p-8 border border-slate-200/80 shadow-sm">
          
          <!-- Product Photos Gallery with Interactive Zoom (Left 5 Cols) -->
          <div class="md:col-span-5 space-y-3">
            <!-- Interactive Hover & Click Zoom Box -->
            <div id="productZoomContainer" 
              class="w-full aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 relative shadow-inner group cursor-crosshair select-none flex items-center justify-center"
              onmousemove="window.compareEngine.handleImageZoom(event)"
              onmouseleave="window.compareEngine.resetImageZoom()"
              onclick="window.compareEngine.openLightboxModal()">
              <img id="mainProductPhoto" src="${currentPhoto}" alt="${p.name}" class="w-full h-full object-contain transition-transform duration-100 ease-out origin-center pointer-events-none p-2">
              ${discountPct > 0 ? `
                <span class="absolute top-3 left-3 bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-md shadow uppercase tracking-wider pointer-events-none">
                  ${discountPct}% OFF
                </span>
              ` : ''}
              <button type="button" onclick="event.stopPropagation(); alert('❤️ Added to Wishlist!')" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur text-slate-400 hover:text-rose-600 flex items-center justify-center shadow transition hover:scale-110">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              </button>
            </div>

            <!-- Distinct Thumbnails Strip (Only unique photos, no hardcoded duplicates!) -->
            ${photoList.length > 1 ? `
              <div class="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                ${photoList.map((imgUrl, idx) => {
                  const isActive = idx === this.selectedImageIdx;
                  return `
                    <div id="prodThumb_${idx}" onclick="window.compareEngine.selectImage(${idx})" 
                      class="w-16 h-16 rounded-xl ${isActive ? 'border-2 border-indigo-600 ring-2 ring-indigo-300' : 'border border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300'} p-0.5 cursor-pointer overflow-hidden flex-shrink-0 shadow-xs transition">
                      <img src="${imgUrl}" class="w-full h-full object-cover rounded-lg" alt="${p.name} Photo ${idx + 1}">
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Product Details & Specifications (Right 7 Cols) -->
          <div class="md:col-span-7 space-y-4 flex flex-col justify-between">
            <div>
              <!-- Brand & Rating -->
              <div class="flex items-center gap-3">
                <span class="text-xs font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
                  Brand: ${p.brand || 'Verified Supplier'}
                </span>
                <span class="badge-rating text-xs">
                  ${p.rating} ★
                </span>
                <span class="text-xs text-slate-400 font-medium">(${p.reviews} Ratings & 480 Reviews)</span>
              </div>

              <!-- Title -->
              <h1 class="text-xl md:text-2xl font-black text-slate-900 mt-2">${p.name}</h1>
              <p class="text-xs text-slate-500 font-medium mt-0.5">${p.unit} • Fast Local Delivery</p>

              <!-- Price Display -->
              <div class="flex items-baseline gap-2.5 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                <span class="text-3xl font-black text-slate-950">₹${minPrice}</span>
                <span class="text-xs font-bold text-slate-400">onwards</span>
                <span class="text-sm font-semibold text-slate-400 line-through">MRP ₹${p.mrp}</span>
                <span class="text-sm font-black text-[#038d63]">${discountPct}% off</span>
              </div>

              <div class="mt-2 flex items-center gap-2">
                <span class="badge-free-delivery">Free Delivery Available</span>
                <span class="text-xs ${offers.length > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-0.5 rounded font-semibold">
                  ${offers.length > 0 ? `Available in ${offers.length} Online Stores` : '❌ Currently Offline in all nearby stores'}
                </span>
              </div>

              <!-- Product Highlights & Specs -->
              <div class="mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <h4 class="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">Product Details:</h4>
                <p class="text-slate-600 leading-relaxed">${p.description}</p>
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div><strong class="text-slate-700">Net Quantity:</strong> <span class="text-slate-500">${p.unit}</span></div>
                  <div><strong class="text-slate-700">Category:</strong> <span class="text-slate-500 capitalize">${p.category}</span></div>
                  <div><strong class="text-slate-700">Shelf Life:</strong> <span class="text-slate-500">Fresh Daily Supply</span></div>
                  <div><strong class="text-slate-700">Country of Origin:</strong> <span class="text-slate-500">India 🇮🇳</span></div>
                </div>
              </div>

              <!-- Delivery Pincode Checker -->
              <div class="mt-4 p-3 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-base">📍</span>
                  <div>
                    <span class="font-bold text-slate-800 block">Delivery to Sector 62, Noida - 201301</span>
                    <span class="text-[11px] text-[#038d63] font-semibold">⚡ Express Delivery in 15-25 mins available!</span>
                  </div>
                </div>
                <button onclick="document.getElementById('locationModal').classList.remove('hidden')" class="text-xs font-bold text-indigo-600 hover:underline">Change</button>
              </div>
            </div>

            <!-- Quick Best Store Order Button -->
            ${offers[0] ? `
              <div class="pt-4 border-t border-slate-100 flex items-center gap-3">
                <button onclick="window.compareEngine.selectStoreAndAddToCart('${offers[0].store.id}', ${offers[0].price})"
                  class="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                  <span>Buy from ${offers[0].store.name} • ₹${offers[0].totalCost} Total</span>
                </button>
              </div>
            ` : `
              <div class="pt-4 border-t border-slate-100">
                <button disabled class="w-full py-3.5 bg-slate-200 text-slate-400 rounded-2xl font-bold text-xs cursor-not-allowed">
                  ❌ Currently Offline in All Nearby Stores
                </button>
              </div>
            `}
          </div>
        </div>

        <!-- MULTI-STORE PRICE COMPARISON SECTION -->
        <div class="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 class="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>🏢 All Nearby Stores Selling ${p.name}</span>
                <span class="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">${offers.length} Offers</span>
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">Compare prices, delivery charges & choose the best store for you.</p>
            </div>

            <!-- Sort Controls -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span class="text-slate-400 font-bold uppercase text-[10px]">Sort:</span>
              <button onclick="window.compareEngine.setSort('lowest_total')" class="px-2.5 py-1 rounded-lg font-bold ${this.currentSort === 'lowest_total' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}">🏷️ Lowest Total</button>
              <button onclick="window.compareEngine.setSort('lowest_price')" class="px-2.5 py-1 rounded-lg font-bold ${this.currentSort === 'lowest_price' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}">💰 Item Price</button>
              <button onclick="window.compareEngine.setSort('fastest_time')" class="px-2.5 py-1 rounded-lg font-bold ${this.currentSort === 'fastest_time' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}">⚡ Fastest</button>
            </div>
          </div>

          <!-- Store Cards List -->
          <div class="space-y-3" id="inpageStoreList">
            <!-- Injected below -->
          </div>
        </div>

        <!-- REVIEWS & RATINGS BREAKDOWN -->
        <div class="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h3 class="font-black text-slate-900 text-base">Customer Ratings & Reviews</h3>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div class="md:col-span-4 bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center text-center">
              <span class="text-4xl font-black text-slate-950">${p.rating} ★</span>
              <p class="text-xs text-slate-500 font-semibold mt-1">${p.reviews} Verified Customer Ratings</p>
              <div class="mt-3 flex items-center gap-1 text-[#038d63] text-xs font-bold">
                <span>✓</span> 100% Genuine Local Buyers
              </div>
            </div>

            <div class="md:col-span-8 space-y-3 text-xs">
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="badge-rating text-[10px]">5.0 ★</span>
                  <strong class="text-slate-800">Rohit Verma</strong>
                  <span class="text-slate-400">• 2 days ago</span>
                </div>
                <p class="text-slate-600 mt-1">"Super fast delivery from nearby store! Received fresh and intact within 20 mins. Highly recommended!"</p>
              </div>

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="badge-rating text-[10px]">5.0 ★</span>
                  <strong class="text-slate-800">Pooja Sharma</strong>
                  <span class="text-slate-400">• 4 days ago</span>
                </div>
                <p class="text-slate-600 mt-1">"Best price compared to other marts. Ordered using Express slot and received instantly!"</p>
              </div>
            </div>
          </div>
        </div>

        <!-- SIMILAR / RELATED PRODUCTS -->
        ${relatedProducts.length > 0 ? `
          <div class="space-y-3">
            <h3 class="font-black text-slate-900 text-base">Similar Products in ${p.category}</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              ${relatedProducts.map(item => `
                <div class="product-card p-3 cursor-pointer hover:border-indigo-600" onclick="window.compareEngine.openComparisonPage('${item.id}')">
                  <img src="${item.photoUrl}" class="w-full h-32 object-cover rounded-xl mb-2">
                  <h4 class="text-xs font-bold text-slate-800 line-clamp-1">${item.name}</h4>
                  <p class="text-[10px] text-slate-400">${item.unit}</p>
                  <p class="font-black text-sm text-slate-900 mt-1">₹${item.stores[0]?.price || item.mrp} onwards</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;

    const listContainer = document.getElementById('inpageStoreList');
    if (listContainer) this.renderStoreListInto(listContainer);
  }

  renderStoreListInto(container) {
    const offers = this.getProcessedStoreOffers();
    if (offers.length === 0) {
      container.innerHTML = '<p class="text-center py-6 text-slate-400 text-xs">No online stores currently available for this product.</p>';
      return;
    }

    const lowestTotal = Math.min(...offers.map(o => o.totalCost));

    container.innerHTML = offers.map((offer, idx) => {
      const isBest = offer.totalCost === lowestTotal;
      return `
        <div class="p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isBest ? 'border-emerald-400 bg-emerald-50/40 shadow-sm' : 'border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300'
        }">
          
          <div class="flex items-start gap-3.5">
            <img src="${offer.store.photoUrl}" class="w-14 h-14 rounded-xl object-cover border flex-shrink-0" alt="${offer.store.name}">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-extrabold text-slate-900 text-sm md:text-base">${offer.store.name}</h4>
                ${isBest ? '<span class="text-[9px] font-black uppercase bg-[#038d63] text-white px-2 py-0.5 rounded-full">✨ BEST TOTAL VALUE</span>' : ''}
                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Open Now</span>
              </div>
              <div class="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <span class="badge-rating text-[10px]">${offer.rating} ★</span>
                <span>•</span>
                <span>📍 ${offer.distanceKm} km</span>
                <span>•</span>
                <span>🕒 ~${offer.estDeliveryMins} mins</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
            <div class="text-right">
              <span class="text-[10px] text-slate-400 block uppercase font-bold">Item + Delivery</span>
              <span class="font-bold text-slate-700 text-xs">₹${offer.price} + ${offer.deliveryFee === 0 ? '<strong class="text-[#038d63]">FREE</strong>' : `₹${offer.deliveryFee}`}</span>
            </div>

            <div class="border-l border-slate-200 pl-4 text-right">
              <span class="text-[10px] text-[#038d63] block uppercase font-black">Total Cost</span>
              <span class="font-black text-slate-950 text-base md:text-lg text-[#038d63]">₹${offer.totalCost}</span>
            </div>

            <button onclick="window.compareEngine.selectStoreAndAddToCart('${offer.store.id}', ${offer.price})"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition flex-shrink-0">
              + Add to Cart
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  selectStoreAndAddToCart(storeId, price, productId = null) {
    const product = productId 
      ? window.centralStore.getProducts().find(p => p.id === productId)
      : this.currentProduct;

    if (!product) return;

    const store = window.centralStore.getStores().find(s => s.id === storeId);
    if (!store) return;

    if (!window.centralStore.isStoreOnline(store.id)) {
      if (window.notify) {
        window.notify.warning(`"${store.name}" is currently offline and not accepting orders.`, 'Store Offline');
      } else {
        alert(`⚠️ "${store.name}" is currently offline and not accepting orders.`);
      }
      return;
    }

    const success = window.centralStore.addToCart(product, store, price);
    if (success) {
      if (window.notify) {
        window.notify.success(`Added "${product.name}" to cart from ${store.name}!`, 'Item Added');
      }
      if (window.app) {
        window.app.renderCartDrawer();
        window.app.openCart();
      }
    }
  }
}

window.compareEngine = new MultiStoreComparisonEngine();
