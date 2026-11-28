import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import LocationModal from './LocationModal';

export default function Header({
  location,
  onLocationChange,
  locationDetecting = false,
  needLocationPicker = false,
  onLocationPickerHandled,
  searchQuery,
  onSearchChange,
  onOpenOrders,
  onOpenCart,
  onOpenLogin,
  onLogout,
  onGoDashboard,
  onOpenFranchise,
  dashboardLabel: dashboardLabelProp
}) {
  const { totals } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
    if (needLocationPicker && !locationDetecting) {
      setShowLocationModal(true);
      onLocationPickerHandled?.();
    }
  }, [needLocationPicker, locationDetecting, onLocationPickerHandled]);

  // Prefer label from App (remembers which panel you left), else fall back by role
  const dashboardLabel =
    dashboardLabelProp ||
    (user?.role === 'store_owner'
      ? '🏪 Seller Panel'
      : user?.role === 'driver'
        ? '🛵 Rider Hub'
        : user?.role === 'franchise'
          ? '🗺️ Franchise Panel'
          : user?.role === 'superadmin'
            ? '👑 Admin Panel'
            : user?.role === 'customer'
              ? '👤 My Account'
              : null);

  return (
    <>
      <div className="bg-slate-950 text-white text-xs py-1.5 px-4 sticky top-0 z-50 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold tracking-wide text-[11px] sm:text-xs">
            HYPERLOCAL MULTI-STORE PLATFORM (LIVE)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenFranchise ? (
            <button
              type="button"
              onClick={onOpenFranchise}
              className="px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-[11px]"
            >
              Franchise
            </button>
          ) : null}
          {isAuthenticated ? (
            <>
              <span className="text-slate-300 text-[11px] font-semibold hidden sm:inline truncate max-w-[140px]">
                {user?.name}
              </span>
              {dashboardLabel ? (
                <button
                  type="button"
                  onClick={onGoDashboard}
                  className="px-2.5 py-0.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
                >
                  {dashboardLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onLogout}
                className="px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px]"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenLogin?.('customer')}
              className="px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
            >
              Customer Login
            </button>
          )}
        </div>
      </div>

      <header className="bg-white border-b border-slate-200 sticky top-[29px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3 md:gap-6">
            <div className="flex items-center gap-3 md:gap-6">
              <a href="/" className="flex items-center gap-2 text-slate-900 font-black text-xl md:text-2xl tracking-tight">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-indigo-600/30">
                  ⚡
                </div>
                <span>
                  Hyper<span className="text-indigo-600">Local</span>
                </span>
              </a>

              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 transition max-w-[180px] sm:max-w-[240px] truncate"
              >
                <span className="text-indigo-600">📍</span>
                <span className="truncate font-medium">
                  {locationDetecting || location?.detecting
                    ? 'Detecting PIN…'
                    : location?.pincode
                      ? `Deliver to ${location.pincode}`
                      : 'Set delivery PIN'}
                </span>
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div className="flex-grow max-w-xl relative hidden md:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search Maggi, Amul Milk, Stationery, Veggies, Services..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition shadow-inner"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2 md:gap-2.5">
              <button
                type="button"
                onClick={onOpenOrders}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 px-3 py-2 rounded-xl text-xs font-bold transition"
              >
                <span>📦</span>
                <span className="hidden sm:inline">My Orders</span>
              </button>

              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => onOpenLogin?.('customer')}
                  className="hidden md:flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold transition"
                >
                  Login
                </button>
              ) : null}

              <button
                type="button"
                onClick={onOpenCart}
                className="relative flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 sm:px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="hidden sm:inline">Cart</span>
                {totals.itemsCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center">
                    {totals.itemsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="pb-3 md:hidden">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search Maggi, Amul Milk, Stationery, Veggies..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white shadow-inner"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <LocationModal
        open={showLocationModal}
        location={location}
        autoDetect={needLocationPicker || !location?.pincode}
        onSelect={onLocationChange}
        onClose={() => setShowLocationModal(false)}
      />
    </>
  );
}
