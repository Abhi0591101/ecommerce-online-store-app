import { useEffect, useState } from 'react';
import {
  createRazorpayOrder,
  getRazorpayConfig,
  verifyRazorpayPayment
} from '../services/api';

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/**
 * Online payment via Razorpay Checkout (UPI / Card / Netbanking / Wallet).
 * Requires Razorpay Key Id + Secret in Admin → Settings.
 */
export default function PaymentModal({
  open,
  amount = 0,
  orderPreview = null,
  customer = null,
  onClose,
  onPaid
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setError('');
    setBusy(false);
    let cancelled = false;
    getRazorpayConfig()
      .then((r) => {
        if (!cancelled) setConfig(r?.data || r);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load payment config');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const startRazorpay = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const cfg = config || (await getRazorpayConfig()).data;
      if (!cfg?.enabled || !cfg.keyId) {
        throw new Error(
          'Razorpay not configured. Admin → Settings → add Razorpay Key Id and Key Secret.'
        );
      }

      const scriptOk = await loadRazorpayScript();
      if (!scriptOk || !window.Razorpay) {
        throw new Error('Could not load Razorpay checkout script');
      }

      const created = await createRazorpayOrder({
        purpose: 'checkout',
        amount: Number(amount),
        customerName: customer?.name || orderPreview?.customerName || '',
        customerPhone: customer?.phone || orderPreview?.customerPhone || ''
      });
      const orderData = created?.data || created;

      const options = {
        key: orderData.keyId || cfg.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: cfg.companyName || 'Japto.in',
        description: orderPreview?.orderNumber
          ? `Order ${orderPreview.orderNumber}`
          : 'Japto.in order',
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: customer?.name || orderPreview?.customerName || '',
          contact: customer?.phone || orderPreview?.customerPhone || '',
          email: customer?.email || ''
        },
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          try {
            const verified = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: Number(amount)
            });
            const v = verified?.data || verified;
            await onPaid?.({
              paymentMode: v.paymentMode || 'ONLINE',
              paymentStatus: 'paid',
              paymentTxnId: v.paymentTxnId || response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id
            });
          } catch (err) {
            setError(err.message || 'Payment verification failed');
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setError('Payment cancelled. You can try again or choose COD.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setError(resp?.error?.description || 'Payment failed');
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Could not start payment');
      setBusy(false);
    }
  };

  const enabled = config?.enabled;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
              Razorpay Checkout
            </p>
            <h3 className="font-black text-base">Pay ₹{Number(amount || 0).toFixed(0)}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-center">
          <p className="text-xs font-semibold text-slate-600">
            UPI · Cards · Netbanking · Wallets — secured by Razorpay
          </p>

          {config && !enabled ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 text-left">
              Razorpay is off. Admin → Settings → save Razorpay Key Id and Key Secret, then retry.
            </div>
          ) : null}

          {error ? (
            <p className="text-xs font-bold text-rose-600 text-left">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={busy || (config && !enabled)}
            onClick={startRazorpay}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-600/25 transition"
          >
            {busy ? 'Opening Razorpay…' : `Pay ₹${Number(amount || 0).toFixed(0)} securely`}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            Cancel / use COD instead
          </button>
        </div>
      </div>
    </div>
  );
}
