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
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = '1';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/**
 * Shared Razorpay fee payment for seller / franchise registration (and similar).
 * purpose: seller_registration | franchise_registration | checkout
 */
export default function RazorpayFeePay({
  purpose,
  amount,
  label,
  customer = {},
  disabled = false,
  paidMeta = null,
  onPaid,
  onError
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getRazorpayConfig()
      .then((r) => {
        if (!cancelled) setCfg(r?.data || r);
      })
      .catch((err) => {
        if (!cancelled) setLocalError(err.message || 'Could not load Razorpay config');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pay = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (busy || disabled) return;
    setBusy(true);
    setLocalError('');
    try {
      const cfgRes = cfg || (await getRazorpayConfig())?.data || (await getRazorpayConfig());
      const conf = cfgRes?.data || cfgRes || cfg;
      if (!conf?.enabled || !conf.keyId) {
        throw new Error(
          'Razorpay not configured. Ask Admin → Settings → add Razorpay Key Id and Key Secret, then Save.'
        );
      }
      if (!(Number(amount) > 0)) {
        throw new Error('Fee amount is invalid');
      }

      const scriptOk = await loadRazorpayScript();
      if (!scriptOk || !window.Razorpay) {
        throw new Error('Could not load Razorpay checkout script. Check internet / ad-block.');
      }

      const created = await createRazorpayOrder({
        purpose,
        amount: Number(amount),
        customerName: customer.name || '',
        customerPhone: customer.phone || ''
      });
      const orderData = created?.data || created;
      if (!orderData?.razorpayOrderId) {
        throw new Error('Could not create Razorpay order');
      }

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: orderData.keyId || conf.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: conf.companyName || 'Japto.in',
          description: label || `Japto ${purpose}`,
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: customer.name || '',
            contact: customer.phone || '',
            email: customer.email || ''
          },
          theme: { color: '#4f46e5' },
          handler: async (response) => {
            try {
              const verified = await verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: orderData.amountRupees || amount
              });
              const v = verified?.data || verified;
              onPaid?.({
                paymentMode: v.paymentMode || 'ONLINE',
                paymentTxnId: v.paymentTxnId || response.razorpay_payment_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                amountRupees: orderData.amountRupees || amount
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled'))
          }
        });
        rzp.on('payment.failed', (resp) => {
          reject(new Error(resp?.error?.description || 'Payment failed'));
        });
        rzp.open();
      });
    } catch (err) {
      const msg = err?.message || 'Payment failed';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  };

  if (paidMeta?.paymentTxnId) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
        Fee paid via Razorpay · Txn {paidMeta.paymentTxnId}
      </div>
    );
  }

  const keysMissing = cfg && !cfg.enabled;

  return (
    <div className="space-y-2">
      {keysMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-950 text-left">
          Razorpay is off. Admin must save Key Id + Key Secret under{' '}
          <strong>Admin → Settings → Razorpay</strong>.
        </div>
      ) : null}
      {localError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800 text-left">
          {localError}
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy || disabled || !(Number(amount) > 0)}
        onClick={pay}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-2xl font-black text-sm"
      >
        {busy
          ? 'Opening Razorpay…'
          : label || `Pay ₹${Number(amount || 0)} via Razorpay`}
      </button>
    </div>
  );
}
