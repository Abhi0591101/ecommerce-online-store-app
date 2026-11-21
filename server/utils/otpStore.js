/**
 * OTP helper — demo mode works in every NODE_ENV (including production)
 * until an SMS gateway is configured.
 *
 * OTP_MODE=demo  → always issue / accept DEMO_OTP (default: 123456)
 * OTP_MODE=sms   → random OTP; wire a gateway in sendViaSms() later
 */
const OTP_MODE = (process.env.OTP_MODE || 'demo').toLowerCase();
const DEMO_OTP = String(process.env.DEMO_OTP || '123456');
const OTP_TTL_MS = Number(process.env.OTP_TTL_MS || 10 * 60 * 1000);

const otpsByPhone = new Map();

const normalizePhone = (phone) => String(phone || '').trim();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const setOtp = (phone, otp) => {
  const key = normalizePhone(phone);
  const code = String(otp || DEMO_OTP);
  otpsByPhone.set(key, { otp: code, sentAt: Date.now() });
  return code;
};

const isExpired = (entry) => !entry || Date.now() - entry.sentAt > OTP_TTL_MS;

/**
 * Placeholder for a real SMS provider (MSG91 / 2Factor / Twilio, etc.).
 * Call this only when OTP_MODE=sms after credentials are set.
 */
const sendViaSms = async (phone, otp) => {
  // TODO: plug SMS gateway here when purchased
  // throw new Error('SMS gateway not configured');
  console.log(`[SMS stub] would send OTP ${otp} to ${normalizePhone(phone)}`);
  return false;
};

const issueOtp = async (phone) => {
  const key = normalizePhone(phone);
  if (!key) {
    const err = new Error('phone is required');
    err.statusCode = 400;
    throw err;
  }

  if (OTP_MODE === 'sms') {
    const otp = generateOtp();
    setOtp(key, otp);
    const sent = await sendViaSms(key, otp);
    if (!sent) {
      // Fallback so the app still works until gateway is live
      console.warn('[OTP] SMS gateway not live — falling back to demo OTP');
      setOtp(key, DEMO_OTP);
      return {
        mode: 'demo',
        otp: DEMO_OTP,
        message: `Demo OTP active (SMS not configured yet). Use ${DEMO_OTP} to verify.`
      };
    }
    return {
      mode: 'sms',
      message: 'OTP sent to your mobile via SMS'
    };
  }

  // Default: demo mode — intentional for production until SMS is added
  setOtp(key, DEMO_OTP);
  console.log(`[OTP demo] phone=${key} otp=${DEMO_OTP}`);
  return {
    mode: 'demo',
    otp: DEMO_OTP,
    message: `Demo OTP: ${DEMO_OTP} (SMS gateway not connected yet)`
  };
};

const verifyOtp = (phone, otp) => {
  const key = normalizePhone(phone);
  const code = String(otp || '').trim();
  if (!key || !code) return false;

  // Demo bypass while OTP_MODE=demo (also accepted as emergency when SMS falls back)
  if (OTP_MODE === 'demo' && code === DEMO_OTP) return true;

  const entry = otpsByPhone.get(key);
  if (!entry || isExpired(entry)) return false;
  const ok = entry.otp === code;
  if (ok) otpsByPhone.delete(key);
  return ok;
};

module.exports = {
  DEMO_OTP,
  OTP_MODE,
  setOtp,
  issueOtp,
  verifyOtp,
  normalizePhone
};
