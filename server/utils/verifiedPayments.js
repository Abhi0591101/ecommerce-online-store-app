/**
 * Short-lived store of Razorpay payments verified via signature.
 * placeOrder consumes these so clients cannot fake paymentStatus=paid.
 */
const store = new Map();
const TTL_MS = 30 * 60 * 1000;

const prune = () => {
  const now = Date.now();
  for (const [id, row] of store.entries()) {
    if (now - row.at > TTL_MS || row.used) store.delete(id);
  }
};

const markVerified = (paymentId, meta = {}) => {
  if (!paymentId) return;
  prune();
  store.set(String(paymentId), {
    at: Date.now(),
    used: false,
    amountPaise: meta.amountPaise != null ? Number(meta.amountPaise) : null,
    orderId: meta.orderId || '',
    method: meta.method || ''
  });
};

/** Returns meta if valid unused verification; marks used. */
const consumeVerified = (paymentId, amountRupees) => {
  prune();
  const row = store.get(String(paymentId || ''));
  if (!row || row.used) return null;
  if (row.amountPaise != null && amountRupees != null) {
    const expected = Math.round(Number(amountRupees) * 100);
    // allow 1 paise rounding drift
    if (Math.abs(expected - row.amountPaise) > 1) return null;
  }
  row.used = true;
  store.set(String(paymentId), row);
  return row;
};

const peekVerified = (paymentId) => {
  prune();
  const row = store.get(String(paymentId || ''));
  if (!row || row.used) return null;
  return row;
};

/**
 * Require a Razorpay-verified payment for a fee amount (INR).
 * Does NOT mark used — call consumeVerified after successful save.
 * If expectedAmount is 0, payment is skipped.
 */
const requireFeePayment = (paymentId, expectedAmountInr) => {
  const expected = Number(expectedAmountInr);
  if (!Number.isFinite(expected) || expected <= 0) {
    return { ok: true, skipped: true, paymentId: '', meta: null };
  }
  const id = String(paymentId || '').trim();
  if (!id) {
    return {
      ok: false,
      message: 'Razorpay payment is required. Complete online payment first.'
    };
  }
  const meta = peekVerified(id);
  if (!meta) {
    return {
      ok: false,
      message: 'Payment not verified. Pay again via Razorpay and retry.'
    };
  }
  if (
    meta.amountPaise != null &&
    Math.abs(meta.amountPaise - Math.round(expected * 100)) > 500
  ) {
    return {
      ok: false,
      message: `Paid amount does not match required fee ₹${expected}`
    };
  }
  return { ok: true, paymentId: id, meta };
};

module.exports = { markVerified, consumeVerified, peekVerified, requireFeePayment };
