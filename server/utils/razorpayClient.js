/**
 * Razorpay client — keys from Admin Site Settings (DB), not .env.
 */
const Razorpay = require('razorpay');
const crypto = require('crypto');

let cache = { at: 0, keys: null };
const CACHE_MS = 3000;

const invalidateRazorpayCache = () => {
  cache = { at: 0, keys: null };
  cachedInstance = null;
  cachedSig = '';
};

const loadKeys = async () => {
  if (cache.keys && Date.now() - cache.at < CACHE_MS) return cache.keys;
  const SiteSettings = require('../models/SiteSettings');
  let s = await SiteSettings.findOne({ key: 'default' }).lean();
  if (!s) {
    s = (await SiteSettings.create({ key: 'default' })).toObject();
  }
  const keys = {
    keyId: String(s.razorpayKeyId || '').trim(),
    keySecret: String(s.razorpayKeySecret || '').trim(),
    webhookSecret: String(s.razorpayWebhookSecret || '').trim(),
    companyName: String(s.razorpayCompanyName || 'Japto.in').trim() || 'Japto.in'
  };
  cache = { at: Date.now(), keys };
  return keys;
};

const getKeys = async () => loadKeys();

const isConfigured = async () => {
  const { keyId, keySecret } = await loadKeys();
  return Boolean(keyId && keySecret);
};

let cachedInstance = null;
let cachedSig = '';

const getRazorpay = async () => {
  const { keyId, keySecret } = await loadKeys();
  if (!keyId || !keySecret) {
    const err = new Error(
      'Razorpay is not configured. Admin → Settings → add Razorpay Key Id and Key Secret.'
    );
    err.statusCode = 503;
    throw err;
  }
  const sig = `${keyId}:${keySecret}`;
  if (!cachedInstance || cachedSig !== sig) {
    cachedInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    cachedSig = sig;
  }
  return cachedInstance;
};

/** amountRupees → paise integer */
const toPaise = (amountRupees) => Math.round(Number(amountRupees || 0) * 100);

const verifyPaymentSignature = async ({ orderId, paymentId, signature }) => {
  const { keySecret } = await loadKeys();
  if (!keySecret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
};

const verifyWebhookSignature = async (rawBody, signature) => {
  const { webhookSecret } = await loadKeys();
  if (!webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

const mapRazorpayMethod = (method) => {
  const m = String(method || '').toLowerCase();
  if (m === 'upi') return 'UPI';
  if (m === 'card') return 'CARD';
  if (m === 'netbanking') return 'NETBANKING';
  if (m === 'wallet') return 'WALLET';
  if (m === 'cod') return 'COD';
  return 'ONLINE';
};

module.exports = {
  getKeys,
  loadKeys,
  isConfigured,
  getRazorpay,
  toPaise,
  verifyPaymentSignature,
  verifyWebhookSignature,
  mapRazorpayMethod,
  invalidateRazorpayCache
};
