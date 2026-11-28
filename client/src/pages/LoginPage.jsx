import { useMemo, useState } from 'react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { useAuth } from '../context/AuthContext';
import {
  changeFranchisePassword,
  loginCustomerOtp,
  loginFranchiseApi,
  loginRiderOtp,
  loginWithOtp,
  registerCustomer,
  registerDeliveryBoy,
  resetCustomerPassword,
  sendCustomerOtp,
  sendFranchiseOtp,
  sendPortalOtp,
  sendRiderOtp
} from '../services/api';

const PORTALS = [
  {
    id: 'customer',
    role: 'customer',
    label: 'Customer',
    icon: '👤',
    hint: 'Shop, orders, wallet & support',
    view: 'customer'
  },
  {
    id: 'store_owner',
    role: 'store_owner',
    label: 'Seller',
    icon: '🏪',
    hint: 'Seller = Store Admin (same login)',
    view: 'seller'
  },
  {
    id: 'driver',
    role: 'driver',
    label: 'Rider',
    icon: '🛵',
    hint: 'Delivery Boy Panel',
    view: 'rider'
  },
  {
    id: 'franchise',
    role: 'franchise',
    label: 'Franchise',
    icon: '🗺️',
    hint: 'Franchise Dashboard',
    view: 'franchise'
  },
  {
    id: 'superadmin',
    role: 'superadmin',
    label: 'Admin',
    icon: '👑',
    hint: 'Platform admin only',
    view: 'superadmin'
  }
];

export function viewForRole(role) {
  const portal = PORTALS.find((p) => p.role === role);
  return portal?.view || 'customer';
}

export default function LoginPage({
  initialRole = 'store_owner',
  onSuccess,
  onBackToStore,
  onSellerRegister
}) {
  const { applySession, loading: authBooting } = useAuth();
  const [portalId, setPortalId] = useState(
    PORTALS.some((p) => p.id === initialRole) ? initialRole : 'store_owner'
  );
  // otp | password | register | forgot
  const [mode, setMode] = useState('otp');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [city, setCity] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const portal = useMemo(
    () => PORTALS.find((p) => p.id === portalId) || PORTALS[1],
    [portalId]
  );
  const isCustomer = portal.role === 'customer';
  const isRider = portal.role === 'driver';
  const isFranchise = portal.role === 'franchise';

  const sendOtp = async (purpose) => {
    setError('');
    if (!phone.trim()) {
      setError('Enter mobile number');
      return;
    }
    try {
      let res;
      if (isRider) {
        res = await sendRiderOtp({ phone: phone.trim(), purpose });
      } else if (isFranchise) {
        res = await sendFranchiseOtp({ phone: phone.trim(), purpose });
      } else if (isCustomer) {
        res = await sendCustomerOtp({ phone: phone.trim(), purpose });
      } else {
        res = await sendPortalOtp({
          phone: phone.trim(),
          role: portal.role,
          purpose
        });
      }
      setOtpSent(true);
      const code = res.demoOtp || res.otp;
      if (code) {
        setOtp(String(code));
        setOtpHint(res.message || `OTP sent. Use ${code}`);
      } else {
        setOtp('');
        setOtpHint(res.message || 'OTP sent to your mobile number');
      }
    } catch (err) {
      setError(err.message || 'OTP failed');
      setOtpSent(false);
    }
  };

  const switchMode = (id) => {
    setMode(id);
    setError('');
    setOtp('');
    setOtpHint('');
    setOtpSent(false);
  };

  const requireOtpGate = () => {
    if (!otpSent || !otp.trim()) {
      setError('Send OTP first, then enter the OTP');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isCustomer && mode === 'register') {
        if (!requireOtpGate()) {
          setSubmitting(false);
          return;
        }
        if (!name.trim() || !phone.trim() || !email.trim() || !password || !otp.trim()) {
          setError('Name, mobile number, email, password and OTP are all mandatory');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        const res = await registerCustomer({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          otp: otp.trim(),
          referralCode: referralCode.trim() || undefined
        });
        const user = applySession(res.data?.token, res.data?.user);
        onSuccess?.(user, 'customer');
        return;
      }

      // Japto: Join as Delivery Partner — OTP + details, then Admin verification
      if (isRider && mode === 'register') {
        if (!requireOtpGate()) {
          setSubmitting(false);
          return;
        }
        if (!name.trim() || !phone.trim() || !password || !otp.trim()) {
          setError('Name, mobile, password and OTP are required');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        await registerDeliveryBoy({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password,
          otp: otp.trim(),
          vehicleType: vehicleType.trim() || undefined,
          city: city.trim() || undefined
        });
        setMode('otp');
        setOtpSent(false);
        setOtp('');
        setPassword('');
        setOtpHint('Registration submitted — wait for Admin approval, then login with OTP');
        setError('');
        return;
      }

      if ((isCustomer || isFranchise) && mode === 'forgot') {
        if (!requireOtpGate()) {
          setSubmitting(false);
          return;
        }
        if (!phone.trim() || !otp.trim() || !password) {
          setError('Phone, OTP and new password required');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        if (isFranchise) {
          await changeFranchisePassword({
            phone: phone.trim(),
            otp: otp.trim(),
            newPassword: password
          });
        } else {
          await resetCustomerPassword({
            phone: phone.trim(),
            otp: otp.trim(),
            newPassword: password
          });
        }
        setMode(isFranchise ? 'password' : 'otp');
        setError('');
        setOtpHint(
          isFranchise
            ? 'Password updated — sign in with password or OTP'
            : 'Password updated — sign in with OTP'
        );
        setOtpSent(false);
        setOtp('');
        setPassword('');
        return;
      }

      // Franchise password login (registration password)
      if (isFranchise && mode === 'password') {
        if (!phone.trim() || !password) {
          setError('Phone and password required');
          setSubmitting(false);
          return;
        }
        const res = await loginFranchiseApi({
          phone: phone.trim(),
          password
        });
        const user = applySession(res.data?.token, res.data?.user);
        onSuccess?.(user, viewForRole(user.role));
        return;
      }

      // All portals: OTP login
      if (!requireOtpGate()) {
        setSubmitting(false);
        return;
      }
      if (!phone.trim() || !otp.trim()) {
        setError('Phone and OTP required');
        setSubmitting(false);
        return;
      }

      let res;
      if (isCustomer) {
        res = await loginCustomerOtp({ phone: phone.trim(), otp: otp.trim() });
      } else if (isRider) {
        res = await loginRiderOtp({ phone: phone.trim(), otp: otp.trim() });
      } else if (isFranchise) {
        res = await loginFranchiseApi({ phone: phone.trim(), otp: otp.trim() });
      } else {
        res = await loginWithOtp({
          phone: phone.trim(),
          otp: otp.trim(),
          role: portal.role
        });
      }
      const user = applySession(res.data?.token, res.data?.user);
      onSuccess?.(user, viewForRole(user.role));
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (authBooting) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
        Checking session…
      </div>
    );
  }

  const modeTabs = isCustomer
    ? [
        ['otp', 'Login (OTP)'],
        ['register', 'Register'],
        ['forgot', 'Forgot Password']
      ]
    : isRider
      ? [
          ['otp', 'Login (OTP)'],
          ['register', 'Register']
        ]
      : isFranchise
        ? [
            ['otp', 'Login (OTP)'],
            ['password', 'Login (Password)'],
            ['forgot', 'Forgot Password']
          ]
        : [['otp', 'Login (OTP)']];

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% 20%, rgba(15,118,110,0.45), transparent), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(245,158,11,0.25), transparent)'
        }}
      />

      <div className="relative z-10 max-w-md mx-auto px-4 py-10 sm:py-16">
        <button
          type="button"
          onClick={onBackToStore}
          className="mb-6 text-xs font-bold text-slate-300 hover:text-white transition"
        >
          ← Back to storefront
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center font-black text-lg shadow-lg">
            ⚡
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              Japto<span className="text-emerald-400">.in</span> Login
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">OTP required for every portal</p>
          </div>
        </div>

        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="p-2 bg-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-1">
            {PORTALS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPortalId(p.id);
                  setMode('otp');
                  setError('');
                  setOtpHint('');
                  setOtpSent(false);
                  setOtp('');
                  setPassword('');
                }}
                className={`rounded-2xl px-2 py-2.5 text-center transition ${
                  portalId === p.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="text-base leading-none">{p.icon}</div>
                <div className="text-[10px] font-black mt-1">{p.label}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-3">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <p className="text-xs font-black text-emerald-900">
                {portal.icon} {portal.label}
              </p>
              <p className="text-[11px] text-emerald-800/80 font-medium">{portal.hint}</p>
            </div>

            <div className="flex flex-wrap gap-1">
              {modeTabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchMode(id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                    mode === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error ? (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2">
                {error}
              </div>
            ) : null}
            {otpHint ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-2">
                {otpHint}
              </div>
            ) : null}

            {mode === 'register' && (isCustomer || isRider) ? (
              <>
                <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                  {isRider
                    ? 'Join as Delivery Partner (Japto). Mobile OTP required. Admin must approve before you can work.'
                    : 'Registration requires name, mobile number and email. Mobile is verified by OTP before account creation.'}
                </p>
                <Field label="Name *">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    required
                    autoComplete="name"
                  />
                </Field>
                <Field label="Mobile number *">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setOtpSent(false);
                      setOtp('');
                      setOtpHint('');
                    }}
                    className={inputCls}
                    required
                    autoComplete="tel"
                  />
                </Field>
                <Field label={isCustomer ? 'Email address *' : 'Email (optional)'}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    required={isCustomer}
                    autoComplete="email"
                  />
                </Field>
                {isRider ? (
                  <>
                    <Field label="Vehicle type (optional)">
                      <input
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Bike / Scooter"
                      />
                    </Field>
                    <Field label="City (optional)">
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputCls}
                        placeholder="Service city"
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : (
              <Field label="Mobile number *">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setOtpSent(false);
                    setOtp('');
                    setOtpHint('');
                  }}
                  className={inputCls}
                  required
                  autoComplete="tel"
                />
              </Field>
            )}

            {mode !== 'password' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    sendOtp(mode === 'register' ? 'register' : mode === 'forgot' ? 'reset' : 'login')
                  }
                  className="w-full px-3 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  {otpSent
                    ? 'Resend OTP'
                    : mode === 'register'
                      ? 'Send OTP to verify mobile'
                      : mode === 'forgot'
                        ? 'Send OTP to reset password'
                        : 'Send OTP to login'}
                </button>
                {otpSent ? (
                  <Field label="OTP *">
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className={inputCls}
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </Field>
                ) : (
                  <p className="text-[10px] font-semibold text-slate-500">
                    OTP field appears after you click Send OTP
                  </p>
                )}
              </div>
            ) : null}

            {(mode === 'password' ||
              (mode === 'register' && (isCustomer || isRider)) ||
              mode === 'forgot') && (
              <Field
                label={
                  mode === 'forgot'
                    ? 'Create new password *'
                    : mode === 'password'
                      ? 'Password *'
                      : 'Create password *'
                }
              >
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls + ' pr-14'}
                    required
                    minLength={mode === 'password' ? undefined : 6}
                    autoComplete={mode === 'password' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-700 px-2"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {mode !== 'password' ? <PasswordStrengthMeter password={password} /> : null}
              </Field>
            )}

            {isCustomer && mode === 'register' ? (
              <Field label="Referral code (optional)">
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className={inputCls}
                />
              </Field>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-sm py-3.5 transition"
            >
              {submitting
                ? 'Please wait…'
                : mode === 'register' && isRider
                  ? 'Submit delivery partner application'
                  : mode === 'register'
                    ? 'Create customer account'
                    : mode === 'forgot'
                      ? 'Reset password'
                      : mode === 'password'
                        ? `Sign in as ${portal.label}`
                        : `Sign in as ${portal.label}`}
            </button>

            {portal.role === 'store_owner' && onSellerRegister && (
              <button
                type="button"
                onClick={onSellerRegister}
                className="w-full text-center text-xs font-bold text-emerald-700 hover:underline"
              >
                New seller? Register with OTP + documents
              </button>
            )}
            {isRider && mode === 'otp' ? (
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="w-full text-center text-xs font-bold text-emerald-700 hover:underline"
              >
                New rider? Join as Delivery Partner
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white';

function Field({ label, children, className = '' }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
