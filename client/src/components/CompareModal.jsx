import { useEffect, useMemo, useState } from 'react';
import { getProductComparison } from '../services/api';
import { useCart } from '../context/CartContext';

export default function CompareModal({ product, open, onClose, location, stores = [] }) {
  const { addToCart } = useCart();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [sortKey, setSortKey] = useState('lowest_total');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !product) return undefined;

    let cancelled = false;
    setSelectedImageIdx(0);
    setLoading(true);

    const load = async () => {
      try {
        const res = await getProductComparison(product._id, {
          lat: location?.lat,
          lng: location?.lng,
          city: location?.city,
          pincode: location?.pincode,
          radiusKm: location?.radiusKm || 40
        });
        if (!cancelled && res?.data) {
          setComparison(res.data);
          return;
        }
      } catch {
        /* build from live product + stores in memory */
      }

      if (cancelled) return;
      const offers = (product.storeOffers || []).map((offer) => {
        const store = stores.find((s) => String(s._id) === String(offer.storeId));
        if (!store) return null;
        return {
          storeId: store._id,
          storeName: store.name,
          photoUrl: store.photoUrl,
          rating: store.rating,
          reviewsCount: store.reviewsCount,
          estDeliveryMins: store.estDeliveryMins,
          distanceKm: store.distanceKm || 1,
          itemPrice: offer.price,
          deliveryFee: offer.deliveryFee ?? 0,
          totalCost: offer.totalCost ?? offer.price + (offer.deliveryFee ?? 0),
          stockQuantity: offer.stockQuantity || 50,
          isLowestPrice: false,
          pickupAvailable: true
        };
      }).filter(Boolean);

      offers.sort((a, b) => a.totalCost - b.totalCost);
      if (offers[0]) offers[0].isLowestPrice = true;

      setComparison({
        product: {
          ...product,
          photos: product.photos?.length ? product.photos : [product.photoUrl]
        },
        stores: offers
      });
    };

    load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, product, stores]);

  const photos = useMemo(() => {
    const p = comparison?.product || product;
    if (!p) return [];
    if (p.photos?.length) return p.photos;
    return p.photoUrl ? [p.photoUrl] : [];
  }, [comparison, product]);

  const offers = useMemo(() => {
    const list = [...(comparison?.stores || [])];
    return list.sort((a, b) => {
      if (sortKey === 'lowest_price') return a.itemPrice - b.itemPrice;
      if (sortKey === 'fastest_time') return a.estDeliveryMins - b.estDeliveryMins;
      return a.totalCost - b.totalCost;
    });
  }, [comparison, sortKey]);

  if (!open || !product) return null;

  const detail = comparison?.product || product;
  const minPrice = offers[0]?.itemPrice ?? detail.lowestPrice ?? detail.mrp;
  const discountPct = Math.max(0, Math.round(((detail.mrp - minPrice) / detail.mrp) * 100));
  const currentPhoto = photos[selectedImageIdx] || detail.photoUrl;

  const handleZoom = (e) => {
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = 'scale(2.2)';
  };

  const resetZoom = (e) => {
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    img.style.transformOrigin = 'center center';
    img.style.transform = 'scale(1)';
  };

  const handleAdd = (offer) => {
    addToCart(detail, {
      _id: offer.storeId,
      name: offer.storeName,
      photoUrl: offer.photoUrl,
      baseDeliveryFee: offer.deliveryFee,
      freeDeliveryAbove: offer.freeDeliveryAbove || 0,
      estDeliveryMins: offer.estDeliveryMins,
      rating: offer.rating,
      address: offer.address
    }, offer.itemPrice);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="bg-[#f9f9fb] rounded-3xl w-full max-w-5xl my-4 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-white p-3 md:p-4 border-b border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-800 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/50 px-4 py-2 rounded-xl transition border border-slate-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>← Back to All Products</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6 max-h-[85vh] overflow-y-auto">
          {loading && (
            <div className="text-center text-xs text-slate-400 py-6">Loading store comparison…</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white rounded-3xl p-5 md:p-8 border border-slate-200/80 shadow-sm">
            <div className="md:col-span-5 space-y-3">
              <div
                className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 relative shadow-inner cursor-crosshair select-none flex items-center justify-center"
                onMouseMove={handleZoom}
                onMouseLeave={resetZoom}
              >
                <img
                  src={currentPhoto}
                  alt={detail.name}
                  className="w-full h-full object-contain transition-transform duration-100 ease-out origin-center pointer-events-none p-2"
                />
                {discountPct > 0 && (
                  <span className="absolute top-3 left-3 bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-md shadow uppercase tracking-wider pointer-events-none">
                    {discountPct}% OFF
                  </span>
                )}
              </div>

              {photos.length > 1 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                  {photos.map((imgUrl, idx) => (
                    <button
                      key={imgUrl + idx}
                      type="button"
                      onClick={() => setSelectedImageIdx(idx)}
                      className={`w-16 h-16 rounded-xl ${
                        idx === selectedImageIdx
                          ? 'border-2 border-indigo-600 ring-2 ring-indigo-300'
                          : 'border border-slate-200 opacity-70 hover:opacity-100'
                      } p-0.5 cursor-pointer overflow-hidden flex-shrink-0 transition`}
                    >
                      <img src={imgUrl} className="w-full h-full object-cover rounded-lg" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-7 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
                    Brand: {detail.brand || 'Verified Supplier'}
                  </span>
                  <span className="badge-rating text-xs">{detail.rating} ★</span>
                  <span className="text-xs text-slate-400 font-medium">
                    ({detail.reviewsCount || 0} Ratings)
                  </span>
                </div>

                <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-2">{detail.name}</h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{detail.unit} • Fast Local Delivery</p>

                <div className="flex items-baseline gap-2.5 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <span className="text-3xl font-black text-slate-950">₹{minPrice}</span>
                  <span className="text-xs font-bold text-slate-400">onwards</span>
                  <span className="text-sm font-semibold text-slate-400 line-through">MRP ₹{detail.mrp}</span>
                  <span className="text-sm font-black text-[#038d63]">{discountPct}% off</span>
                </div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="badge-free-delivery">Free Delivery Available</span>
                  <span className={`text-xs ${offers.length > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-0.5 rounded font-semibold`}>
                    {offers.length > 0
                      ? `Available in ${offers.length} Online Stores`
                      : '❌ Currently Offline in all nearby stores'}
                  </span>
                </div>

                <div className="mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                  <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">Product Details:</h4>
                  <p className="text-slate-600 leading-relaxed">{detail.description}</p>
                </div>

                <div className="mt-4 p-3 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <div>
                      <span className="font-bold text-slate-800 block">
                        Delivery to{' '}
                        {location?.area || location?.city || 'your location'}
                        {location?.pincode ? ` - ${location.pincode}` : ''}
                      </span>
                      <span className="text-[11px] text-[#038d63] font-semibold">
                        ⚡ Express Delivery in 15-25 mins available!
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {offers[0] && (
                <button
                  type="button"
                  onClick={() => handleAdd(offers[0])}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2"
                >
                  <span>Buy from {offers[0].storeName} • ₹{offers[0].totalCost} Total</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>🏢 All Nearby Stores Selling {detail.name}</span>
                  <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {offers.length} Offers
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compare prices, delivery charges & choose the best store for you.
                </p>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Sort:</span>
                {[
                  ['lowest_total', '🏷️ Lowest Total'],
                  ['lowest_price', '💰 Item Price'],
                  ['fastest_time', '⚡ Fastest']
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSortKey(key)}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap ${
                      sortKey === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {offers.length === 0 && (
                <p className="text-center py-6 text-slate-400 text-xs">
                  No online stores currently available for this product.
                </p>
              )}

              {offers.map((offer) => {
                const isBest = offer.isLowestPrice || offer.totalCost === offers[0]?.totalCost;
                return (
                  <div
                    key={offer.storeId}
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isBest
                        ? 'border-emerald-400 bg-emerald-50/40 shadow-sm'
                        : 'border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <img
                        src={offer.photoUrl}
                        className="w-14 h-14 rounded-xl object-cover border flex-shrink-0"
                        alt={offer.storeName}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-slate-900 text-sm md:text-base">{offer.storeName}</h4>
                          {isBest && (
                            <span className="text-[9px] font-black uppercase bg-[#038d63] text-white px-2 py-0.5 rounded-full">
                              ✨ BEST TOTAL VALUE
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Open Now
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span className="badge-rating text-[10px]">{offer.rating} ★</span>
                          <span>•</span>
                          <span>📍 {offer.distanceKm || 1} km</span>
                          <span>•</span>
                          <span>🕒 ~{offer.estDeliveryMins} mins</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Item + Delivery</span>
                        <span className="font-bold text-slate-700 text-xs">
                          ₹{offer.itemPrice} +{' '}
                          {offer.deliveryFee === 0 ? (
                            <strong className="text-[#038d63]">FREE</strong>
                          ) : (
                            `₹${offer.deliveryFee}`
                          )}
                        </span>
                      </div>
                      <div className="border-l border-slate-200 pl-4 text-right">
                        <span className="text-[10px] text-[#038d63] block uppercase font-black">Total Cost</span>
                        <span className="font-black text-base md:text-lg text-[#038d63]">₹{offer.totalCost}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdd(offer)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition flex-shrink-0"
                      >
                        + Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
