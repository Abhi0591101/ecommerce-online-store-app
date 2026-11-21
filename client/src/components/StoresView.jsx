import { formatDistanceKm } from '../utils/geo';

const CATEGORY_TAG = (store) => {
  const name = (store.name || '').toLowerCase();
  if (name.includes('veg') || name.includes('farm') || name.includes('fresh')) return 'Veggies';
  if (name.includes('station') || name.includes('book')) return 'Stationery';
  if (name.includes('hardware') || name.includes('sanitary')) return 'Hardware';
  if (name.includes('furniture') || name.includes('chair')) return 'Furniture';
  if (name.includes('cosmetic') || name.includes('beauty') || name.includes('glamour')) return 'Cosmetics';
  if (name.includes('super') || name.includes('mart')) return 'Supermarket';
  return store.categoryTag || 'Kirana';
};

export default function StoresView({ stores = [], location, onBrowseCatalog }) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 border border-emerald-800/40 shadow-md">
        <div>
          <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
            🏬 Local Merchant Network
          </span>
          <h3 className="text-lg md:text-xl font-black mt-1.5">
            Nearby Kirana & Supermarket Storefronts
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Live distances from {location?.area || location?.city || 'your pin'} • Haversine filtered
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-2xl border border-white/15 text-center">
          <span className="text-xs font-bold text-emerald-300 block">{stores.length} Stores</span>
          <span className="text-sm font-black">Within radius</span>
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="py-16 text-center text-slate-500 bg-white rounded-3xl p-8 border border-slate-100">
          <p className="font-bold text-slate-800 text-lg">No stores nearby</p>
          <p className="text-sm text-slate-400 mt-1">Change location or expand your delivery radius.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store) => {
            const isOpen = store.isOnline !== false;
            const fee = store.baseDeliveryFee ?? store.deliveryFee ?? 0;
            return (
              <div
                key={store._id}
                className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-sm hover:border-indigo-300 transition flex flex-col gap-3"
              >
                <div className="flex gap-3.5">
                  <img
                    src={store.photoUrl}
                    className="w-20 h-20 rounded-2xl object-cover border flex-shrink-0"
                    alt={store.name}
                  />
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">
                          {store.name}
                        </h3>
                        <span className="inline-block mt-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {CATEGORY_TAG(store)}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap ${
                          isOpen
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-rose-700 bg-rose-50'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        {isOpen ? 'OPEN NOW' : 'CLOSED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{store.address}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="badge-rating">{store.rating} ★</span>
                  <span className="text-slate-400">({store.reviewsCount || 0} reviews)</span>
                  <span className="font-bold text-indigo-600">
                    📍 {formatDistanceKm(store.distanceKm)}
                  </span>
                  <span className="font-bold text-slate-700">⚡ {store.estDeliveryMins || 20}m</span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <p className="text-slate-500 font-medium">
                      Delivery:{' '}
                      <strong className="text-slate-900">{fee === 0 ? 'FREE' : `₹${fee}`}</strong>
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      🕐 {store.openingTime || '08:00 AM - 10:00 PM'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBrowseCatalog?.(store)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-sm transition whitespace-nowrap"
                  >
                    Browse Store Catalog ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
