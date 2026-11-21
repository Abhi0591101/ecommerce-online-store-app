import { useEffect, useMemo, useState } from 'react';
import {
  getCustomerAddresses,
  getCustomerWallet,
  placeOrder,
  validateCoupon
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { usePlatform } from '../context/PlatformContext';
import PaymentModal from './PaymentModal';

export default function CheckoutModal({
  open,
  onClose,
  location,
  onOrderPlaced
}) {
  const { cart, selectedStore, fulfillmentMode, selectedTimeSlot, totals, buildCheckoutPayload, clearCart } = useCart();
  const { stores } = usePlatform();
  const { user, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pincode, setPincode] = useState(location?.pincode || '201301');
  const [address, setAddress] = useState('');
  const [paymentMode, setPaymentMode] = useState('COD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [upiOpen, setUpiOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [step, setStep] = useState('form'); // form | review
  const [addresses, setAddresses] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setError('');
    if (user?.role === 'customer') {
      setName(user.name || '');
      setPhone(user.phone || '');
      getCustomerAddresses()
        .then((r) => {
          const list = r.data || [];
          setAddresses(list);
          const def = list.find((a) => a.isDefault) || list[0];
          if (def) {
            setAddress(
              [def.flatBuilding, def.streetArea, def.city].filter(Boolean).join(', ')
            );
            setPincode(def.pincode || location?.pincode || '201301');
          }
        })
        .catch(() => {});
      getCustomerWallet()
        .then((r) => setWalletBalance(r.data?.balance || 0))
        .catch(() => {});
    } else {
      setName('');
      setPhone('');
      setAddress(
        `Flat / Tower, ${location?.area || location?.city || 'your area'}`
      );
      setPincode(location?.pincode || '201301');
    }
  }, [open, user, location]);

  const walletUseAmt = useMemo(() => {
    if (!useWallet) return 0;
    const payable = Math.max(0, totals.grandTotal - discount);
    return Math.min(walletBalance, payable);
  }, [useWallet, walletBalance, totals.grandTotal, discount]);

  const payable = Math.max(0, totals.grandTotal - discount - walletUseAmt);

  const sellerLabel = selectedStore?.name || cart[0]?.storeName || 'Seller';

  if (!open && !upiOpen) return null;

  const isPickup = fulfillmentMode === 'pickup';

  const buildLocalOrder = (payMeta = {}) => {
    const storeId = selectedStore?._id || cart[0]?.storeId;
    const storeDoc = stores.find((s) => String(s._id) === String(storeId));
    return {
      storeId,
      storeName: selectedStore?.name || cart[0]?.storeName || storeDoc?.name,
      storeLat: selectedStore?.lat || storeDoc?.lat || location?.lat || 28.6280,
      storeLng: selectedStore?.lng || storeDoc?.lng || location?.lng || 77.3649,
      customerLat: location?.lat || 28.6275,
      customerLng: location?.lng || 77.3650,
      customerName: name,
      customerPhone: phone,
      deliveryAddress: isPickup
        ? selectedStore?.address || address || 'Store Pickup'
        : address,
      pincode,
      paymentMode: payMeta.paymentMode || paymentMode,
      paymentStatus: payMeta.paymentStatus || (paymentMode === 'COD' ? 'PENDING' : 'PENDING'),
      orderType: fulfillmentMode,
      timeSlot: selectedTimeSlot,
      items: [...cart],
      itemsTotal: totals.itemsTotal,
      deliveryFee: totals.deliveryFee,
      savings: totals.savings,
      grandTotal: totals.grandTotal,
      placedAt: new Date().toLocaleString()
    };
  };

  const finalizeOrder = async (payMeta = {}) => {
    const payload = buildCheckoutPayload({
      name,
      phone,
      pincode,
      address: isPickup
        ? selectedStore?.address || address || 'Store Pickup'
        : address,
      paymentMode: payMeta.paymentMode || paymentMode,
      customerId: isAuthenticated && user?.role === 'customer' ? user._id || user.id : undefined,
      couponCode: discount > 0 ? couponCode : '',
      discountAmount: discount,
      walletUsed: walletUseAmt,
      paymentTxnId: payMeta.paymentTxnId || ''
    });

    const baseMeta = buildLocalOrder(payMeta);

    try {
      const res = await placeOrder({
        ...payload,
        paymentStatus: payMeta.paymentStatus || undefined
      });
      const data = res?.data || res;
      clearCart();
      onOrderPlaced({
        ...baseMeta,
        orderNumber: data.orderNumber,
        otpCode: data.otpCode,
        grandTotal: data.grandTotal ?? payable,
        status: data.status || 'placed',
        orderId: data.orderId || data._id,
        paymentStatus: payMeta.paymentStatus || data.paymentStatus || baseMeta.paymentStatus
      });
    } catch (err) {
      setError(err.message || 'Order failed');
      throw err;
    }
  };

  const applyCoupon = async () => {
    setCouponMsg('');
    try {
      const res = await validateCoupon({ code: couponCode, orderValue: totals.itemsTotal });
      setDiscount(res.data?.discount || 0);
      setCouponMsg(`Applied −₹${res.data?.discount || 0}`);
    } catch (err) {
      setDiscount(0);
      setCouponMsg(err.message || 'Invalid coupon');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required');
      return;
    }
    if (!isPickup && !address.trim()) {
      setError('Delivery address is required');
      return;
    }
    setError('');
    if (step === 'form') {
      setStep('review');
      return;
    }

    if (paymentMode === 'UPI') {
      setPendingOrder(buildLocalOrder({ paymentMode: 'UPI', paymentStatus: 'PENDING' }));
      setUpiOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await finalizeOrder({ paymentMode: 'COD', paymentStatus: 'PENDING' });
      onClose();
    } catch {
      /* error shown */
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpiPaid = async (payMeta) => {
    setSubmitting(true);
    await finalizeOrder({
      paymentMode: 'UPI',
      paymentStatus: 'PAID',
      ...payMeta
    });
    setUpiOpen(false);
    setPendingOrder(null);
    setSubmitting(false);
    onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isPickup
                      ? 'text-amber-700 bg-amber-100'
                      : 'text-indigo-700 bg-indigo-50'
                  }`}
                >
                  {isPickup ? '🏬 Instant Store Pickup' : '⚡ Express Doorstep Delivery'}
                </span>
                <h3 className="font-black text-slate-900 text-lg mt-1">
                  {isPickup ? 'Confirm Pickup & Payment' : 'Delivery Address & Payment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Seller / Store</p>
                <p className="font-black text-slate-900">{sellerLabel}</p>
                <p className="text-[10px] text-slate-500">{cart.length} item(s) from this seller</p>
              </div>

              {step === 'review' ? (
                <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="font-black text-emerald-900">Order review</p>
                  <p>{name} · {phone}</p>
                  <p>{isPickup ? 'Pickup' : address} · PIN {pincode}</p>
                  <p>Items ₹{totals.itemsTotal} · Delivery ₹{totals.deliveryFee}</p>
                  {discount > 0 ? <p>Discount −₹{discount}</p> : null}
                  {walletUseAmt > 0 ? <p>Wallet −₹{walletUseAmt}</p> : null}
                  <p className="font-black text-lg">Pay ₹{payable} · {paymentMode}</p>
                  <button type="button" className="text-[10px] font-bold underline" onClick={() => setStep('form')}>
                    Edit details
                  </button>
                </div>
              ) : null}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Your Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mobile Number (For OTP/Call) *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">PIN Code *</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              {isPickup ? (
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-amber-900 font-black text-sm">🏬 Store Pickup Location:</strong>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                        Ready in 15 mins
                      </span>
                    </div>
                    <p className="text-slate-800 font-bold text-xs">
                      {selectedStore?.name || cart[0]?.storeName}
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      {selectedStore?.address || 'Local Market'} • PIN: {pincode}
                    </p>
                    <p className="text-emerald-700 font-semibold text-[11px] pt-1">
                      ✓ Zero Delivery Fee applied to this order.
                    </p>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Pickup Notes / Person Name (Optional)</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">Delivery Address / Flat / Tower *</label>
                    <span className="text-[10px] text-indigo-600 font-bold">
                      📍 Synced with {location?.city || 'Location'}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Coupon code</label>
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    placeholder="Enter code"
                  />
                  <button type="button" onClick={applyCoupon} className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold">
                    Apply
                  </button>
                </div>
                {couponMsg ? <p className="text-[10px] font-bold text-slate-600">{couponMsg}</p> : null}
                {isAuthenticated && user?.role === 'customer' && walletBalance > 0 ? (
                  <label className="flex items-center gap-2 font-bold text-slate-700">
                    <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
                    Use wallet (₹{walletBalance} available)
                  </label>
                ) : null}
                {!isPickup && addresses.length > 0 ? (
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    onChange={(e) => {
                      const a = addresses.find((x) => String(x._id) === e.target.value);
                      if (!a) return;
                      setAddress([a.flatBuilding, a.streetArea, a.city].filter(Boolean).join(', '));
                      setPincode(a.pincode || pincode);
                    }}
                    defaultValue=""
                  >
                    <option value="">Saved addresses…</option>
                    {addresses.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.tag}: {a.flatBuilding} {a.pincode}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-2">Select Payment Method:</label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                      paymentMode === 'COD'
                        ? 'border-indigo-600 bg-indigo-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="paymentMode"
                        value="COD"
                        checked={paymentMode === 'COD'}
                        onChange={() => setPaymentMode('COD')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">💵 Pay on Delivery / Pickup</span>
                        <span className="text-slate-500 text-[11px]">Pay cash or UPI at delivery or store counter</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                      POPULAR
                    </span>
                  </label>

                  <label
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                      paymentMode === 'UPI'
                        ? 'border-indigo-600 bg-indigo-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="paymentMode"
                        value="UPI"
                        checked={paymentMode === 'UPI'}
                        onChange={() => setPaymentMode('UPI')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">📱 Instant UPI QR</span>
                        <span className="text-slate-500 text-[11px]">Google Pay, PhonePe, Paytm QR • Razorpay sandbox</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {error && <p className="text-rose-600 font-semibold text-xs">{error}</p>}

              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={handleSubmit}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/30 transition flex items-center justify-center gap-2"
              >
                <span>
                  {submitting
                    ? 'Placing Order…'
                    : step === 'form'
                      ? `Review order • ₹${payable}`
                      : paymentMode === 'UPI'
                        ? `Pay ₹${payable} via UPI`
                        : `Confirm & place • ₹${payable}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        open={upiOpen}
        amount={payable}
        orderPreview={pendingOrder}
        onClose={() => {
          setUpiOpen(false);
          setPendingOrder(null);
        }}
        onPaid={handleUpiPaid}
      />
    </>
  );
}
