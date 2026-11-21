import { useCart } from '../context/CartContext';

export default function CartDrawer({ open, onClose, onCheckout }) {
  const {
    cart,
    selectedStore,
    fulfillmentMode,
    selectedTimeSlot,
    timeSlots,
    totals,
    updateCartQty,
    clearCart,
    setOrderType,
    setSelectedTimeSlot
  } = useCart();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col justify-between ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              🛒
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">Shopping Cart</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-grow">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="font-bold text-slate-700">Your cart is empty</p>
              <p className="text-xs text-slate-400 mt-1">Browse products and choose your nearby store!</p>
            </div>
          ) : (
            <>
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-xs">
                    🏬
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                      Fulfilling Store
                    </span>
                    <p className="font-bold text-slate-900 text-xs">
                      {selectedStore?.name || cart[0]?.storeName}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={clearCart} className="text-xs text-rose-600 font-bold hover:underline">
                  Clear All
                </button>
              </div>

              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100"
                  >
                    <img
                      src={item.photoUrl}
                      className="w-12 h-12 rounded-xl object-cover border"
                      alt={item.name}
                    />
                    <div className="flex-grow">
                      <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{item.name}</h4>
                      <p className="text-[11px] text-slate-400">
                        {item.unit} • ₹{item.price} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, -1)}
                        className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:text-rose-600 text-sm"
                      >
                        -
                      </button>
                      <span className="font-extrabold text-xs text-slate-900 w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, 1)}
                        className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:text-emerald-600 text-sm"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-extrabold text-xs text-slate-900">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <label className="text-xs font-bold text-slate-900 mb-2 block">Choose Fulfillment Mode:</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setOrderType('delivery')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      fulfillmentMode === 'delivery'
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-500/20'
                        : 'text-slate-600'
                    }`}
                  >
                    🛵 Doorstep Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('pickup')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      fulfillmentMode === 'pickup'
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-500/20'
                        : 'text-slate-600'
                    }`}
                  >
                    🏬 Store Pickup
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-bold text-slate-900 mb-2 block">
                  Choose Time Slot & Delivery Speed:
                </label>
                <div className="space-y-2">
                  {timeSlots
                    .filter((s) => s.type === fulfillmentMode)
                    .map((slot) => {
                      const isSelected = selectedTimeSlot === slot.label;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedTimeSlot(slot.label)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all text-left ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-1 ring-indigo-500/30'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              readOnly
                              checked={isSelected}
                              className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-800">{slot.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-black ${
                                slot.fee === 0
                                  ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                                  : 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                              } px-2 py-0.5 rounded-md`}
                            >
                              {slot.fee === 0 ? 'FREE' : `+₹${slot.fee}`}
                            </span>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-700 text-white">
                              {slot.tag}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Total ({totals.itemsCount} items)</span>
                <span className="font-bold text-slate-900">₹{totals.itemsTotal}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  Delivery Fee (
                  {fulfillmentMode === 'pickup'
                    ? 'Store Pickup'
                    : totals.deliveryFee === 0
                      ? 'Saver Slot'
                      : 'Express/Slot Fee'}
                  )
                </span>
                <span className={`font-bold ${totals.deliveryFee === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {totals.deliveryFee === 0 ? 'FREE' : `₹${totals.deliveryFee}`}
                </span>
              </div>
              {totals.savings > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Total Savings</span>
                  <span>-₹{totals.savings}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-extrabold text-slate-950">
                <span>Grand Total</span>
                <span className="text-indigo-600 text-base">₹{totals.grandTotal}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="w-full mt-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout • ₹{totals.grandTotal}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
