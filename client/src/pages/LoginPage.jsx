import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  loginCustomerOtp,
  loginRiderOtp,
  registerCustomer,
  resetCustomerPassword,
  sendCustomerOtp,
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
  const { login, applySession, loading: authBooting } = useAuth();
  const [portalId, setPortalId] = useState(
    PORTALS.some((p) => p.id === initialRole) ? initialRole : 'store_owner'
  );
  const [mode, setMode] = useState('password'); // password | otp | register | forgot
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpHint, setOtpHint] = useState('');
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
  const otpPortal = isCustomer || isRider;

  const sendOtp = async (purpose) => {
    setError('');
    if (!phone.trim()) {
      setError('Enter mobile number');
      return;
    }
    try {
      const res = isRider
        ? await sendRiderOtp({ phone: phone.trim(), purpose })
        : await sendCustomerOtp({ phone: phone.trim(), purpose });
      setOtpHint(res.message || 'OTP sent');
      if (res.demoOtp || res.otp) setOtp(String(res.demoOtp || res.otp));
    } catch (err) {
      setError(err.message || 'OTP failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isCustomer && mode === 'register') {
        if (!name.trim() || !phone.trim() || !email.trim() || !password || !otp.trim()) {
          setError('Name, phone, email, password and OTP are required');
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

      if (isCustomer && mode === 'otp') {
        if (!phone.trim() || !otp.trim()) {
          setError('Phone and OTP required');
          return;
        }
        const res = await loginCustomerOtp({ phone: phone.trim(), otp: otp.trim() });
        const user = applySession(res.data?.token, res.data?.user);
        onSuccess?.(user, 'customer');
        return;
      }

      if (isRider && mode === 'otp') {
        if (!phone.trim() || !otp.trim()) {
          setError('Phone and OTP required');
          return;
        }
        const res = await loginRiderOtp({ phone: phone.trim(), otp: otp.trim() });
        const user = applySession(res.data?.token, res.data?.user);
        onSuccess?.(user, 'rider');
        return;
      }

      if (isCustomer && mode === 'forgot') {
        if (!phone.trim() || !otp.trim() || !password) {
          setError('Phone, OTP and new password required');
          return;
        }
        await resetCustomerPassword({
          phone: phone.trim(),
          otp: otp.trim(),
          newPassword: password
        });
        setMode('password');
        setError('');
        setOtpHint('Password updated — sign in with new password');
        return;
      }

      if (!phone.trim() || !password) {
        setError('Enter phone and password');
        return;
      }
      const user = await login({
        phone: phone.trim(),
        password,
        role: portal.role
      });
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
            <p className="text-[11px] text-slate-400 font-medium">Sign in to your portal</p>
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
                  setMode('password');
                  setError('');
                  setOtpHint('');
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

            {otpPortal ? (
              <div className="flex flex-wrap gap-1">
                {(isCustomer
                  ? [
                      ['password', 'Password'],
                      ['otp', 'OTP login'],
                      ['register', 'Register'],
                      ['forgot', 'Forgot']
                    ]
                  : [
                      ['password', 'Password'],
                      ['otp', 'OTP login']
                    ]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setMode(id);
                      setError('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      mode === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

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

            {isCustomer && mode === 'register' ? (
              <>
                <Field label="Full name *">
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
                </Field>
                <Field label="Email *">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
                </Field>
              </>
            ) : null}

            <Field label="Phone *">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
                required
              />
            </Field>

            {otpPortal && (mode === 'otp' || mode === 'register' || mode === 'forgot') ? (
              <div className="flex gap-2 items-end">
                <Field label="OTP *" className="flex-1">
                  <input value={otp} onChange={(e) => setOtp(e.target.value)} className={inputCls} />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    sendOtp(mode === 'register' ? 'register' : mode === 'forgot' ? 'reset' : 'login')
                  }
                  className="px-3 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap"
                >
                  Send OTP
                </button>
              </div>
            ) : null}

            {(mode === 'password' || mode === 'register' || mode === 'forgot') && (
              <Field label={mode === 'forgot' ? 'New password *' : 'Password *'}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls + ' pr-14'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-700 px-2"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>
            )}

            {isCustomer && mode === 'register' ? (
              <Field label="Referral code (optional)">
                <input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} className={inputCls} />
              </Field>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-sm py-3.5 transition"
            >
              {submitting
                ? 'Please wait…'
                : mode === 'register'
                  ? 'Create customer account'
                  : mode === 'forgot'
                    ? 'Reset password'
                    : mode === 'otp'
                      ? 'Sign in with OTP'
                      : `Sign in as ${portal.label}`}
            </button>

            {portal.role === 'store_owner' && onSellerRegister && (
              <button
                type="button"
                onClick={onSellerRegister}
                className="w-full text-center text-xs font-bold text-emerald-700 hover:underline"
              >
                New seller? Register with OTP + KYC docs
              </button>
            )}

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Demo OTP <span className="font-mono text-slate-600">123456</span> · password{' '}
              <span className="font-mono text-slate-600">password123</span>
              <br />
              Customer <span className="font-mono">9999900001</span> · Seller{' '}
              <span className="font-mono">9811223344</span> · Rider{' '}
              <span className="font-mono">9811009988</span> · Admin{' '}
              <span className="font-mono">9999900000</span>
            </p>
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
