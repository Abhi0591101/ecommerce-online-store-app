import { useEffect, useState } from 'react';
import { getMyCustomerOrders, getOrders, requestOrderCancel } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import PrintableInvoice from './PrintableInvoice';

const STATUS_BADGES = {
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  placed: 'bg-slate-100 text-slate-800 border-slate-200',
  accepted: 'bg-blue-50 text-blue-800 border-blue-200',
  packing: 'bg-blue-50 text-blue-800 border-blue-200',
  out_for_delivery: 'bg-amber-50 text-amber-800 border-amber-200',
  ready_for_pickup: 'bg-amber-50 text-amber-800 border-amber-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

export default function MyOrdersModal({
  open,
  onClose,
  localOrders = [],
  onTrack,
  onOrdersChange
}) {
  const { user, isAuthenticated } = useAuth();
  const { addToCart, clearCart } = useCart();
  const [orders, setOrders] = useState([]);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        let apiOrders = [];
        if (isAuthenticated && user?.role === 'customer') {
          const res = await getMyCustomerOrders(statusFilter ? { status: statusFilter } : {});
          apiOrders = res?.data || [];
        } else if (user?.phone) {
          const res = await getOrders({ phone: user.phone });
          apiOrders = res?.data || [];
        }
        const mapped = apiOrders.map((o) => ({
          ...o,
          id: o._id,
          storeName: o.storeId?.name || o.storeName || 'Store',
          otp: o.otpCode,
          placedAt: o.createdAt ? new Date(o.createdAt).toLocaleString() : 'Recently',
          items: (o.items || []).map((item) => ({
            ...item,
            name: item.productName || item.name,
            price: item.unitPrice || item.price,
            unit: item.unitSpec || item.unit,
            photoUrl:
              item.photoUrl ||
              'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100'
          }))
        }));
        if (!cancelled) {
          const merged = [...localOrders, ...mapped];
          const unique = [];
          const seen = new Set();
          merged.forEach((o) => {
            const key = o.orderNumber || o.id;
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(o);
            }
          });
          setOrders(unique);
          onOrdersChange?.(unique);
        }
      } catch {
        if (!cancelled) setOrders(localOrders);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, localOrders, onOrdersChange, isAuthenticated, user, statusFilter]);

  if (!open) return null;

  const statusLabel = (status) => String(status || 'placed').replace(/_/g, ' ');

  const reorder = (order) => {
    clearCart();
    (order.items || []).forEach((item) => {
      addToCart(
        {
          _id: item.productId,
          name: item.name || item.productName,
          unit: item.unit || item.unitSpec,
          photoUrl: item.photoUrl,
          mrp: item.price || item.unitPrice
        },
        { _id: order.storeId?._id || order.storeId, name: order.storeName },
        item.price || item.unitPrice
      );
    });
    setFlash('Reorder added to cart at current listing — review cart before checkout');
    setTimeout(() => setFlash(''), 2500);
  };

  const cancelOrder = async (order) => {
    const reason = window.prompt('Cancellation reason?');
    if (!reason) return;
    try {
      await requestOrderCancel(order._id || order.id, reason);
      setFlash('Cancellation request sent — Admin approval required');
      setStatusFilter((s) => s);
    } catch (err) {
      setFlash(err.message || 'Cancel failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900">My Orders</h3>
            <p className="text-[10px] text-slate-500 font-bold">No returns in this release</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 font-bold">
            ✕
          </button>
        </div>

        <div className="px-4 py-2 flex gap-1 overflow-x-auto text-[10px] font-bold">
          {['', 'placed', 'accepted', 'packing', 'out_for_delivery', 'completed', 'cancelled'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded-lg whitespace-nowrap ${
                statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {flash ? (
          <p className="mx-4 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{flash}</p>
        ) : null}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? <p className="text-sm text-slate-500 font-bold">Loading…</p> : null}
          {!loading && !orders.length ? (
            <p className="text-sm text-slate-500 font-bold text-center py-10">No orders yet</p>
          ) : null}
          {orders.map((order) => (
            <div key={order.orderNumber || order.id} className="border border-slate-200 rounded-2xl p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-black text-sm text-slate-900">{order.orderNumber}</p>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {order.storeName} · {order.placedAt}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border h-fit ${
                    STATUS_BADGES[order.status] || 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {statusLabel(order.status)}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-700">
                ₹{Number(order.grandTotal || 0).toFixed(0)} · {order.paymentMode} ·{' '}
                {order.paymentStatus || 'pending'}
              </p>
              {order.cancellationRequest?.status === 'pending' ? (
                <p className="text-[10px] font-bold text-amber-700">Cancellation pending Admin</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onTrack?.(order)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold"
                >
                  Track
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(order)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold"
                >
                  Invoice
                </button>
                <button
                  type="button"
                  onClick={() => reorder(order)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold"
                >
                  Reorder
                </button>
                {isAuthenticated &&
                user?.role === 'customer' &&
                !['completed', 'cancelled', 'rejected', 'out_for_delivery'].includes(order.status) &&
                order.cancellationRequest?.status !== 'pending' ? (
                  <button
                    type="button"
                    onClick={() => cancelOrder(order)}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-[10px] font-bold"
                  >
                    Request cancel
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {invoiceOrder ? (
        <PrintableInvoice order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />
      ) : null}
    </div>
  );
}
