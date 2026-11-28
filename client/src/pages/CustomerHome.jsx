import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import CategorySlider from '../components/CategorySlider';
import HeroBanner from '../components/HeroBanner';
import ProductCard from '../components/ProductCard';
import CompareModal from '../components/CompareModal';
import CartDrawer from '../components/CartDrawer';
import CheckoutModal from '../components/CheckoutModal';
import LiveTrackingModal from '../components/LiveTrackingModal';
import MyOrdersModal from '../components/MyOrdersModal';
import ServicesView from '../components/ServicesView';
import StoresView from '../components/StoresView';
import MobileBottomNav from '../components/MobileBottomNav';
import CustomerAccountPanel from './CustomerAccountPanel';
import { getCategories, getProducts, getStores } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { usePlatform } from '../context/PlatformContext';
import { withStoreDistances } from '../utils/geo';
import { hasUsableDeliveryLocation } from '../utils/detectLocation';

export default function CustomerHome({
  onOpenLogin,
  onLogout,
  onGoDashboard,
  dashboardLabel,
  onOpenFranchise
}) {
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { totals } = useCart();
  const {
    location,
    setLocation,
    locationDetecting,
    needLocationPicker,
    setNeedLocationPicker,
    categories,
    mainCategories,
    products,
    stores,
    services,
    orders,
    addOrder,
    setCategories,
    setProducts,
    setStores
  } = usePlatform();

  const sliderCategories = useMemo(() => {
    const navExtras = [
      {
        _id: 'nav-all',
        slug: 'all',
        name: 'All Products',
        iconEmoji: '✨',
        photoUrl:
          'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80'
      },
      ...mainCategories.filter((c) => c.isActive !== false),
      {
        _id: 'nav-services',
        slug: 'services',
        name: 'Services',
        iconEmoji: '🛠️',
        photoUrl:
          'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=160&auto=format&fit=crop&q=80'
      },
      {
        _id: 'nav-shops',
        slug: 'shops',
        name: 'Nearby Shops',
        iconEmoji: '🏬',
        photoUrl:
          'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=160&auto=format&fit=crop&q=80'
      }
    ];
    return navExtras;
  }, [mainCategories]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [mainTab, setMainTab] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [storeFilterId, setStoreFilterId] = useState(null);
  const [globalFilters, setGlobalFilters] = useState({
    freeDelivery: false,
    inStock: true,
    pickupAvailable: false
  });
  const [globalSort, setGlobalSort] = useState('lowest_total');
  const [apiOnline, setApiOnline] = useState(false);
  const [navActive, setNavActive] = useState('home');

  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [compareProduct, setCompareProduct] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [brandFilter, setBrandFilter] = useState('');
  const [priceSort, setPriceSort] = useState(''); // low | high | ''
  const [catalogLoading, setCatalogLoading] = useState(false);

  const isLocating = Boolean(locationDetecting || location?.detecting);
  const catalogReady = hasUsableDeliveryLocation(location);
  const isCatalogProcessing = isLocating || catalogLoading || (!catalogReady && !needLocationPicker);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const canFetch = hasUsableDeliveryLocation(location);
      const locQuery = canFetch
        ? {
            lat: location.lat,
            lng: location.lng,
            city: location.city,
            radiusKm: location.radiusKm || 40,
            pincode: location.pincode
          }
        : null;
      const [catRes, prodRes, storeRes] = await Promise.all([
        getCategories(),
        locQuery
          ? getProducts({
              category:
                activeCategory === 'all' ||
                activeCategory === 'services' ||
                activeCategory === 'shops'
                  ? undefined
                  : activeCategory,
              search: searchQuery || undefined,
              ...locQuery
            })
          : Promise.resolve({ data: [] }),
        locQuery ? getStores(locQuery) : Promise.resolve({ data: [] })
      ]);

      // Keep full main+sub list so seller listing dropdowns stay valid
      if (catRes?.data?.length) setCategories(catRes.data);
      if (!canFetch) {
        setProducts([]);
        setStores([]);
      } else if (prodRes?.data) {
        const enriched = prodRes.data.map((p) => ({
          ...p,
          categorySlug: p.categoryId?.slug || p.categorySlug,
          storeOffers:
            Array.isArray(p.storeOffers) && p.storeOffers.length
              ? p.storeOffers
              : p.lowestStore
                ? [
                    {
                      storeId: p.lowestStore.storeId,
                      price: p.lowestPrice,
                      stockQuantity: 50,
                      deliveryFee:
                        p.lowestPrice >= (p.lowestStore.freeDeliveryAbove || 0)
                          ? 0
                          : p.lowestStore.baseDeliveryFee || 0,
                      totalCost:
                        p.lowestPrice +
                        (p.lowestPrice >= (p.lowestStore.freeDeliveryAbove || 0)
                          ? 0
                          : p.lowestStore.baseDeliveryFee || 0)
                    }
                  ]
                : []
        }));
        setProducts(enriched);
      } else {
        setProducts([]);
      }
      if (canFetch && Array.isArray(storeRes?.data)) {
        setStores(withStoreDistances(storeRes.data, location));
      }
      const live = !catRes?.offline && !prodRes?.offline && !storeRes?.offline;
      setApiOnline(live);
    } catch {
      setApiOnline(false);
    } finally {
      setCatalogLoading(false);
    }
  }, [activeCategory, searchQuery, location, setCategories, setProducts, setStores]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleCategorySelect = (slug) => {
    setActiveCategory(slug);
    setStoreFilterId(null);
    if (slug === 'services') {
      setMainTab('services');
      setNavActive('services');
    } else if (slug === 'shops') {
      setMainTab('shops');
      setNavActive('home');
    } else {
      setMainTab('products');
      setNavActive(slug === 'grocery' ? 'grocery' : 'home');
    }
  };

  const handleMainTab = (tab) => {
    setMainTab(tab);
    setStoreFilterId(null);
    if (tab === 'services') {
      setActiveCategory('services');
      setNavActive('services');
    } else if (tab === 'shops') {
      setActiveCategory('shops');
      setNavActive('home');
    } else {
      if (activeCategory === 'services' || activeCategory === 'shops') setActiveCategory('all');
      setNavActive('home');
    }
  };

  const browseStoreCatalog = (store) => {
    setStoreFilterId(store._id);
    setMainTab('products');
    setActiveCategory('all');
    setSearchQuery('');
    setNavActive('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (storeFilterId) {
      list = list.filter((p) => {
        const offers = p.storeOffers || [];
        if (offers.some((o) => String(o.storeId) === String(storeFilterId))) return true;
        if (String(p.lowestStore?.storeId) === String(storeFilterId)) return true;
        return false;
      });
    }

    if (
      mainTab === 'products' &&
      !storeFilterId &&
      activeCategory !== 'all' &&
      activeCategory !== 'services' &&
      activeCategory !== 'shops'
    ) {
      list = list.filter((p) => (p.categorySlug || p.categoryId?.slug) === activeCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)
      );
    }

    if (brandFilter) {
      const b = brandFilter.toLowerCase();
      list = list.filter((p) => (p.brand || '').toLowerCase().includes(b));
    }

    list = list.filter((p) => {
      const offers = p.storeOffers || [];
      if (globalFilters.freeDelivery && offers.length && !offers.some((o) => (o.deliveryFee ?? 1) === 0)) {
        return false;
      }
      if (globalFilters.inStock) {
        const stockOk =
          offers.length === 0 ||
          offers.some((o) => (o.stockQuantity ?? o.stock ?? 1) > 0) ||
          p.isActive !== false;
        if (!stockOk) return false;
      }
      if (globalFilters.pickupAvailable) {
        const store = stores.find((s) => String(s._id) === String(p.lowestStore?.storeId));
        if (store && store.pickupAvailable === false) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (priceSort === 'low' || globalSort === 'lowest_price' || globalSort === 'lowest_total') {
        return (a.lowestPrice || a.mrp) - (b.lowestPrice || b.mrp);
      }
      if (priceSort === 'high') {
        return (b.lowestPrice || b.mrp) - (a.lowestPrice || a.mrp);
      }
      if (globalSort === 'fastest_time') {
        return (a.lowestStore?.estDeliveryMins || 99) - (b.lowestStore?.estDeliveryMins || 99);
      }
      return 0;
    });

    return list;
  }, [
    products,
    activeCategory,
    mainTab,
    searchQuery,
    globalFilters,
    globalSort,
    stores,
    storeFilterId,
    brandFilter,
    priceSort
  ]);

  const activeStoreFilter = stores.find((s) => String(s._id) === String(storeFilterId));

  const headerTitle = () => {
    if (mainTab === 'services') {
      return (
        <>
          <span>🛠️ Home & Repair Services</span>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            Doorstep Within 45 Mins
          </span>
        </>
      );
    }
    if (mainTab === 'shops') {
      return (
        <>
          <span>🏬 Verified Local Stores Nearby</span>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Live Status</span>
        </>
      );
    }
    if (activeStoreFilter) {
      return (
        <>
          <span>Shopping at {activeStoreFilter.name}</span>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            Store Catalog
          </span>
        </>
      );
    }
    return (
      <>
        <span>Products In Your Area</span>
        <span className="text-xs font-bold text-[#038d63] bg-[#f2f9f6] px-2 py-0.5 rounded">
          Lowest Price Guaranteed
        </span>
      </>
    );
  };

  const onOrderPlaced = (order) => {
    const saved = addOrder({
      ...order,
      storeId: order.storeId || order.items?.[0]?.storeId,
      status: order.status || 'placed',
      paymentStatus: order.paymentStatus || (order.paymentMode === 'UPI' ? 'PAID' : 'PENDING')
    });
    setTrackingOrder(saved);
  };

  const tabBtnClass = (tab) =>
    `flex-1 py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 ${
      mainTab === tab
        ? 'bg-white text-indigo-600 shadow-sm font-black'
        : 'text-slate-600 hover:text-indigo-600 font-bold'
    }`;

  return (
    <div className="bg-[#f9f9fb] text-[#333333] min-h-screen pb-20 md:pb-8 selection:bg-indigo-600 selection:text-white">
      <Header
        location={location}
        onLocationChange={setLocation}
        locationDetecting={locationDetecting}
        needLocationPicker={needLocationPicker}
        onLocationPickerHandled={() => setNeedLocationPicker(false)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenOrders={() => {
          setOrdersOpen(true);
          setNavActive('orders');
        }}
        onOpenCart={() => {
          setCartOpen(true);
          setNavActive('cart');
        }}
        onOpenLogin={onOpenLogin}
        onLogout={onLogout}
        onOpenFranchise={onOpenFranchise}
        dashboardLabel={dashboardLabel || (user?.role === 'customer' ? '👤 My Account' : null)}
        onGoDashboard={() => {
          // Customer → My Account panel only (never staff / Admin login)
          if (user?.role === 'customer') {
            setAccountOpen(true);
            return;
          }
          if (!user) {
            onOpenLogin?.('customer');
            return;
          }
          onGoDashboard?.();
        }}
      />

      {isCatalogProcessing ? (
        <div className="sticky top-16 z-30 bg-white/95 border-b border-slate-100 backdrop-blur-sm">
          <div className="catalog-progress-track rounded-none h-1">
            <div className="catalog-progress-bar" />
          </div>
        </div>
      ) : null}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {!apiOnline && (
          <div className="mb-3 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Backend offline — no catalog loaded. Start MongoDB, then `npm run seed` and `npm run dev`.
          </div>
        )}

        {/* Segmented Main Navigation */}
        <div className="flex items-center justify-center gap-2 mb-4 bg-slate-200/80 p-1.5 rounded-2xl max-w-xl mx-auto shadow-inner">
          <button type="button" onClick={() => handleMainTab('products')} className={tabBtnClass('products')}>
            <span>📦 Products</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                mainTab === 'products' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-300 text-slate-700'
              }`}
            >
              {products.length}
            </span>
          </button>
          <button type="button" onClick={() => handleMainTab('services')} className={tabBtnClass('services')}>
            <span>🛠️ Services</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                mainTab === 'services' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-300 text-slate-700'
              }`}
            >
              {services.length}
            </span>
          </button>
          <button type="button" onClick={() => handleMainTab('shops')} className={tabBtnClass('shops')}>
            <span>🏬 Nearby Stores</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                mainTab === 'shops' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-300 text-slate-700'
              }`}
            >
              {stores.length}
            </span>
          </button>
        </div>

        {mainTab === 'products' && (
          <CategorySlider
            categories={sliderCategories}
            activeCategory={activeCategory}
            onSelectCategory={handleCategorySelect}
          />
        )}

        <HeroBanner location={location} />

        <section>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2 flex-wrap">
              {headerTitle()}
            </h2>
            {activeStoreFilter && (
              <button
                type="button"
                onClick={() => setStoreFilterId(null)}
                className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition"
              >
                ✕ Clear store filter
              </button>
            )}
          </div>

          {mainTab === 'products' && (
            <div className="space-y-4 animate-[fadeIn_0.25s_ease]">
              <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap">Filter:</span>
                  {[
                    ['freeDelivery', '🚚 Free Delivery'],
                    ['inStock', '📦 In Stock'],
                    ['pickupAvailable', '🏬 Store Pickup']
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGlobalFilters((f) => ({ ...f, [key]: !f[key] }))}
                      className={`px-3 py-1 rounded-full font-semibold border transition-all flex items-center gap-1 whitespace-nowrap ${
                        globalFilters[key]
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {label} {globalFilters[key] ? '✓' : ''}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px] whitespace-nowrap">Sort:</span>
                  {[
                    ['lowest_total', '🏷️ Lowest Total'],
                    ['lowest_price', '💰 Price ↑'],
                    ['fastest_time', '⚡ Fastest']
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setGlobalSort(key);
                        setPriceSort(key === 'lowest_price' ? 'low' : '');
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                        globalSort === key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPriceSort('high');
                      setGlobalSort('price_high');
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      priceSort === 'high' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    💰 Price ↓
                  </button>
                  <input
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    placeholder="Brand filter"
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold w-28"
                  />
                </div>
              </div>

              {isCatalogProcessing ? (
                <div className="py-14 bg-white rounded-3xl p-8 border border-slate-100">
                  <p className="text-center text-sm font-black text-slate-700 tracking-wide">
                    Processing…
                  </p>
                  <p className="text-center text-xs font-semibold text-slate-400 mt-1 mb-5">
                    {isLocating
                      ? 'Finding your delivery PIN'
                      : 'Loading products for your location'}
                  </p>
                  <div className="catalog-progress-track max-w-md mx-auto">
                    <div className="catalog-progress-bar" />
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-500 bg-white rounded-3xl p-8 border border-slate-100">
                  <p className="font-bold text-slate-800 text-lg">No products found</p>
                  <p className="text-sm text-slate-400 mt-1">
                    {storeFilterId
                      ? 'This store has no matching catalog items in the current filter.'
                      : needLocationPicker || !location?.pincode
                        ? 'Set your delivery PIN to see products near you.'
                        : !stores?.length
                          ? `No stores serve ${location?.pincode || location?.city || 'this area'} yet. Try another delivery PIN.`
                          : 'Try another category or clear search.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      onNeedLogin={() => onOpenLogin?.('customer')}
                      key={product._id}
                      product={product}
                      stores={stores}
                      onCompare={setCompareProduct}
                    />
                  ))}
                </div>
              )}

              {activeCategory === 'all' && !searchQuery && !storeFilterId && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                        <span>🛠️ Local Home Services & Repairs</span>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                          45 Mins Arrival
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        AC Repair, Electricians, Cleaning & more at your doorstep in {location.city}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMainTab('services')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl transition"
                    >
                      <span>View All ({services.length})</span>
                      <span>➔</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {services.slice(0, 3).map((s) => (
                      <div
                        key={s._id}
                        className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3 hover:border-indigo-300 transition"
                      >
                        <img
                          src={s.photoUrl}
                          className="w-16 h-16 rounded-xl object-cover border flex-shrink-0"
                          alt={s.name}
                        />
                        <div className="flex-grow min-w-0">
                          <span className="text-[9px] font-extrabold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {s.category}
                          </span>
                          <h4 className="font-bold text-xs text-slate-900 truncate mt-1">{s.name}</h4>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            ₹{s.visitCharge} visit • ★ {s.rating}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMainTab('services')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm flex-shrink-0"
                        >
                          Book ➔
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mainTab === 'services' && (
            <div className="animate-[fadeIn_0.25s_ease]">
              <ServicesView services={services} location={location} />
            </div>
          )}

          {mainTab === 'shops' && (
            <div className="animate-[fadeIn_0.25s_ease]">
              <StoresView
                stores={stores}
                location={location}
                onBrowseCatalog={browseStoreCatalog}
              />
            </div>
          )}
        </section>
      </main>

      <MobileBottomNav
        active={navActive}
        cartCount={totals.itemsCount}
        onHome={() => {
          handleCategorySelect('all');
          setNavActive('home');
        }}
        onGrocery={() => {
          handleCategorySelect('grocery');
          setNavActive('grocery');
        }}
        onOrders={() => {
          setOrdersOpen(true);
          setNavActive('orders');
        }}
        onServices={() => {
          handleMainTab('services');
          setNavActive('services');
        }}
        onCart={() => {
          setCartOpen(true);
          setNavActive('cart');
        }}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        location={location}
        onOrderPlaced={onOrderPlaced}
      />

      <CompareModal
        product={compareProduct}
        open={!!compareProduct}
        onClose={() => setCompareProduct(null)}
        location={location}
        stores={stores}
      />

      <LiveTrackingModal
        open={!!trackingOrder}
        order={trackingOrder}
        onClose={() => setTrackingOrder(null)}
      />

      <MyOrdersModal
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        localOrders={orders}
        onTrack={setTrackingOrder}
      />

      <CustomerAccountPanel
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onLogout={onLogout}
        onOpenOrders={() => {
          setAccountOpen(false);
          setOrdersOpen(true);
        }}
        language={language}
        setLanguage={setLanguage}
      />
    </div>
  );
}
