import { useEffect, useMemo, useState } from 'react';

const COUNTDOWN_SECS = 60;

export default function PaymentModal({
  open,
  amount = 0,
  orderPreview = null,
  onClose,
  onPaid
}) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECS);
  const [paying, setPaying] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  const upiString = useMemo(() => {
    const amt = Number(amount || 0).toFixed(2);
    const note = encodeURIComponent(orderPreview?.orderNumber || 'HyperLocal Order');
    return `upi://pay?pa=hyperlocal@okaxis&pn=HyperLocal&am=${amt}&cu=INR&tn=${note}`;
  }, [amount, orderPreview]);

  const qrUrl = useMemo(() => {
    // Public QR image generator for demo UPI payload
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiString)}`;
  }, [upiString]);

  useEffect(() => {
    if (!open) return undefined;
    setSecondsLeft(COUNTDOWN_SECS);
    setPaying(false);
    setSelectedApp(null);
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const expired = secondsLeft === 0;

  const simulatePaid = async () => {
    if (paying) return;
    setPaying(true);
    await new Promise((r) => setTimeout(r, 600));
    onPaid?.({
      paymentMode: 'UPI',
      paymentStatus: 'PAID',
      paidVia: selectedApp || 'UPI_QR',
      paidAt: new Date().toISOString()
    });
    setPaying(false);
  };

  const openQuickPay = (app) => {
    setSelectedApp(app);
    // Deep-link attempt (works on mobile if app installed); desktop falls through to simulate
    try {
      window.location.href = upiString;
    } catch {
      /* ignore */
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Instant UPI / Razorpay</p>
            <h3 className="font-black text-base">Scan & Pay ₹{amount}</h3>
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
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black ${
              expired ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${expired ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'}`} />
            {expired ? 'Payment window expired' : `Complete payment in ${mm}:${ss}`}
          </div>

          <div className="mx-auto w-[220px] h-[220px] rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-inner relative">
            <img src={qrUrl} alt="UPI QR Code" className="w-full h-full object-contain" />
            {expired && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                <button
                  type="button"
                  onClick={() => setSecondsLeft(COUNTDOWN_SECS)}
                  className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-black"
                >
                  Refresh QR
                </button>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 font-medium">
            UPI ID: <span className="font-mono font-bold text-slate-800">hyperlocal@okaxis</span>
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'gpay', label: 'GPay', emoji: '🟢' },
              { id: 'phonepe', label: 'PhonePe', emoji: '🟣' },
              { id: 'paytm', label: 'Paytm', emoji: '🔵' }
            ].map((app) => (
              <button
                key={app.id}
                type="button"
                disabled={expired}
                onClick={() => openQuickPay(app.id)}
                className={`py-2.5 rounded-2xl border text-xs font-black transition ${
                  selectedApp === app.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-indigo-300 text-slate-700'
                } disabled:opacity-50`}
              >
                {app.emoji} {app.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={paying || expired}
            onClick={simulatePaid}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/25 transition"
          >
            {paying ? 'Confirming Payment…' : '✅ Simulate Successful Payment'}
          </button>

          <p className="text-[10px] text-slate-400">
            Demo sandbox — marks order as <strong>PAID</strong> and opens live tracking.
          </p>
        </div>
      </div>
    </div>
  );
}
