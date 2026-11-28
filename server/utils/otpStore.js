/**
 * OTP helper — demo OTP 123456 for all panels until SMS gateway is live.
 *
 * OTP_MODE=demo (default) → always issue / accept DEMO_OTP
 * OTP_MODE=sms → random OTP via gateway when configured
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

const sendViaSms = async (phone, otp) => {
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
      setOtp(key, DEMO_OTP);
      console.warn(`[OTP] SMS not live — demo OTP ${DEMO_OTP} for ${key}`);
      return {
        mode: 'demo',
        otp: DEMO_OTP,
        demoOtp: DEMO_OTP,
        message: `OTP sent. Use ${DEMO_OTP}`
      };
    }
    return { mode: 'sms', message: 'OTP sent to your mobile via SMS' };
  }

  // Default demo: same OTP for every phone / every panel
  setOtp(key, DEMO_OTP);
  console.log(`[OTP demo] phone=${key} otp=${DEMO_OTP}`);
  return {
    mode: 'demo',
    otp: DEMO_OTP,
    demoOtp: DEMO_OTP,
    message: `OTP sent. Use ${DEMO_OTP}`
  };
};

const verifyOtp = (phone, otp) => {
  const key = normalizePhone(phone);
  const code = String(otp || '').trim();
  if (!key || !code) return false;

  if (OTP_MODE !== 'sms' && code === DEMO_OTP) {
    otpsByPhone.delete(key);
    return true;
  }

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
