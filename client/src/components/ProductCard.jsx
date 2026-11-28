import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { addWishlist } from '../services/api';

export default function ProductCard({ product, stores = [], onCompare, onNeedLogin }) {
  const { addToCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [wishMsg, setWishMsg] = useState('');

  const minPrice = product.lowestPrice ?? product.mrp;
  const discountPct =
    product.savingsPercent ??
    Math.max(0, Math.round(((product.mrp - minPrice) / product.mrp) * 100));

  const offers = (product.storeOffers || [])
    .map((offer) => {
      const store = stores.find((s) => String(s._id) === String(offer.storeId));
      if (!store || store.isOnline === false || store.isActive === false) return null;
      const deliveryFee =
        offer.deliveryFee ??
        (offer.price >= (store.freeDeliveryAbove || 500) ? 0 : store.baseDeliveryFee || store.deliveryFee || 0);
      return {
        store,
        price: offer.price,
        deliveryFee,
        totalCost: offer.totalCost ?? offer.price + deliveryFee,
        stock: offer.stockQuantity ?? 50,
        estDeliveryMins: store.estDeliveryMins || 20,
        distanceKm: store.distanceKm || 1.0
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.totalCost - b.totalCost);

  // Only use lowestStore when that store is in the customer's nearby/serviceable list
  const nearbyLowest =
    product.lowestStore &&
    stores.some((s) => String(s._id) === String(product.lowestStore.storeId))
      ? {
          store: {
            _id: product.lowestStore.storeId,
            name: product.lowestStore.name,
            baseDeliveryFee: product.lowestStore.baseDeliveryFee,
            freeDeliveryAbove: product.lowestStore.freeDeliveryAbove,
            estDeliveryMins: product.lowestStore.estDeliveryMins,
            rating: product.lowestStore.rating
          },
          price: minPrice
        }
      : null;

  const bestOffer = offers[0] || nearbyLowest;

  const hasFreeDelivery = offers.some((o) => o.deliveryFee === 0);

  const handleAdd = (offer) => {
    if (!offer) return;
    addToCart(product, offer.store, offer.price);
  };

  return (
    <div className="product-card flex flex-col justify-between overflow-hidden relative group">
      <button
        type="button"
        title={wishMsg || 'Add to wishlist'}
        onClick={async (e) => {
          e.stopPropagation();
          if (!isAuthenticated || user?.role !== 'customer') {
            onNeedLogin?.();
            return;
          }
          try {
            await addWishlist({
              productId: product._id || product.id,
              storeId: bestOffer?.store?._id,
              price: minPrice
            });
            setWishMsg('Saved');
            setTimeout(() => setWishMsg(''), 1500);
          } catch (err) {
            setWishMsg(err.message || 'Failed');
          }
        }}
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 backdrop-blur text-slate-400 hover:text-rose-600 flex items-center justify-center shadow transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      <div
        className="relative overflow-hidden bg-slate-50 aspect-square cursor-pointer"
        onClick={() => onCompare(product)}
        onKeyDown={() => {}}
        role="button"
        tabIndex={0}
      >
        <img
          src={product.photoUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {discountPct > 0 && (
          <span className="absolute bottom-2 left-2 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow tracking-wider uppercase">
            {discountPct}% OFF
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col justify-between flex-grow">
        <div>
          <h3
            className="text-xs md:text-sm font-semibold text-slate-800 line-clamp-2 leading-snug cursor-pointer hover:text-indigo-600"
            onClick={() => onCompare(product)}
          >
            {product.name}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{product.unit}</p>

          <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
            <span className="price-onwards text-sm md:text-base">₹{minPrice}</span>
            <span className="text-[10px] text-slate-400 font-semibold">onwards</span>
            <span className="price-mrp text-[11px]">₹{product.mrp}</span>
            {discountPct > 0 && <span className="discount-text text-[11px]">{discountPct}% off</span>}
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <span className="badge-free-delivery">
              {hasFreeDelivery
                ? 'Free Delivery'
                : offers.length > 0
                  ? `Delivery from ₹${offers[0]?.deliveryFee || 10}`
                  : 'Delivery Available'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <span className="badge-rating">{product.rating} ★</span>
            <span className="text-[11px] text-slate-400">
              ({product.reviewsCount || product.reviews || 0} Reviews)
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-100">
          {bestOffer ? (
            <>
              <button
                type="button"
                onClick={() => onCompare(product)}
                className="w-full py-1.5 px-2 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition flex items-center justify-between"
              >
                <span className="flex items-center gap-1">
                  <span>🏬</span>
                  <span>
                    {Math.max(offers.length, 1)} Online Stores from <strong>₹{minPrice}</strong>
                  </span>
                </span>
                <span className="text-xs">▼ Compare Stores</span>
              </button>

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full mt-1.5 py-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600"
              >
                {expanded ? '▲ Hide quick offers' : '▼ Quick offers'}
              </button>

              {expanded && offers.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {offers.map((offer, idx) => (
                    <div
                      key={offer.store._id}
                      className={`p-2 rounded-xl border ${
                        idx === 0 ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-100 bg-slate-50'
                      } text-[11px] flex items-center justify-between gap-1`}
                    >
                      <div className="truncate max-w-[100px]">
                        <p className="font-bold text-slate-800 truncate">{offer.store.name}</p>
                        <p className="text-[10px] text-slate-400">
                          📍 {offer.distanceKm}km • ~{offer.estDeliveryMins}m
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900 block">₹{offer.price}</span>
                        <span className="text-[9px] text-slate-400">
                          {offer.deliveryFee === 0 ? 'FREE Del' : `+₹${offer.deliveryFee}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdd(offer)}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] shadow-sm flex-shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!expanded && (
                <button
                  type="button"
                  onClick={() => handleAdd(bestOffer)}
                  className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>Add from {(bestOffer.store.name || 'Store').split(' ')[0]}</span>
                </button>
              )}
            </>
          ) : (
            <div className="py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-[11px] text-slate-400 font-semibold">
              ❌ All nearby stores currently offline
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
