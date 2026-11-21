import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { t } from '../context/LanguageContext';
import {
  getCustomerProfile,
  patchCustomerProfile,
  changeCustomerPassword,
  requestAccountDeletion,
  getCustomerAddresses,
  addCustomerAddress,
  patchCustomerAddress,
  deleteCustomerAddress,
  getWishlist,
  removeWishlist,
  getMyCustomerOrders,
  requestOrderCancel,
  getCustomerPayments,
  getCustomerCoupons,
  getCustomerWallet,
  getCustomerReferral,
  getCustomerNotifications,
  markCustomerNotification,
  markAllCustomerNotifications,
  getCustomerComplaints,
  createCustomerComplaint,
  getMyReviews,
  submitCustomerReview,
  getCustomerSettings,
  getEnabledCities,
  checkServiceability
} from '../services/api';

const TABS = [
  'profile',
  'addresses',
  'wishlist',
  'orders',
  'payments',
  'coupons',
  'wallet',
  'referral',
  'notifications',
  'support',
  'reviews',
  'settings'
];

const unwrap = (res) => res?.data ?? res ?? [];

const fmtRs = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300';
const btnPrimary =
  'rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50';
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50';

function TabChip({ id, active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
        active
          ? 'bg-slate-900 text-white'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

export default function CustomerAccountPanel({
  open,
  onClose,
  onOpenOrders,
  language = 'en',
  setLanguage
}) {
  const { user } = useAuth();
  const tr = useCallback((key) => t(key, language), [language]);

  const [tab, setTab] = useState('profile');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [err, setErr] = useState('');

  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', city: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });

  const [addresses, setAddresses] = useState([]);
  const [addrForm, setAddrForm] = useState({
    tag: 'Home',
    flatBuilding: '',
    streetArea: '',
    pincode: '',
    city: '',
    isDefault: false
  });
  const [pinCheck, setPinCheck] = useState(null);

  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cancelReason, setCancelReason] = useState({});
  const [payments, setPayments] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, ledger: [] });
  const [referral, setReferral] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [complaintForm, setComplaintForm] = useState({ subject: '', message: '', category: 'general' });
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({
    productId: '',
    storeId: '',
    orderId: '',
    rating: 5,
    comment: ''
  });
  const [settings, setSettings] = useState(null);
  const [cities, setCities] = useState([]);

  const tabLabels = useMemo(
    () => ({
      profile: tr('tab_profile'),
      addresses: tr('tab_addresses'),
      wishlist: tr('tab_wishlist'),
      orders: tr('tab_orders'),
      payments: tr('tab_payments'),
      coupons: tr('tab_coupons'),
      wallet: tr('tab_wallet'),
      referral: tr('tab_referral'),
      notifications: tr('tab_notifications'),
      support: tr('tab_support'),
      reviews: tr('tab_reviews'),
      settings: tr('tab_settings')
    }),
    [tr]
  );

  const resetFlash = () => {
    setFlash('');
    setErr('');
  };

  const loadTab = useCallback(async () => {
    if (!open || !user) return;
    setBusy(true);
    resetFlash();
    try {
      switch (tab) {
        case 'profile': {
          const res = await getCustomerProfile();
          const p = unwrap(res);
          setProfile(p);
          setProfileForm({ name: p.name || '', email: p.email || '', city: p.city || '' });
          const cRes = await getEnabledCities();
          setCities(unwrap(cRes).cities || unwrap(cRes) || []);
          break;
        }
        case 'addresses': {
          const res = await getCustomerAddresses();
          setAddresses(unwrap(res));
          break;
        }
        case 'wishlist': {
          const res = await getWishlist();
          setWishlist(unwrap(res));
          break;
        }
        case 'orders': {
          const res = await getMyCustomerOrders();
          setOrders(unwrap(res));
          break;
        }
        case 'payments': {
          const res = await getCustomerPayments();
          setPayments(unwrap(res));
          break;
        }
        case 'coupons': {
          const res = await getCustomerCoupons();
          setCoupons(unwrap(res));
          break;
        }
        case 'wallet': {
          const res = await getCustomerWallet();
          const w = unwrap(res);
          setWallet({ balance: w.balance ?? 0, ledger: w.ledger || [], note: w.note });
          break;
        }
        case 'referral': {
          const res = await getCustomerReferral();
          setReferral(unwrap(res));
          break;
        }
        case 'notifications': {
          const res = await getCustomerNotifications();
          setNotifications(unwrap(res));
          break;
        }
        case 'support': {
          const res = await getCustomerComplaints();
          setComplaints(unwrap(res));
          break;
        }
        case 'reviews': {
          const res = await getMyReviews();
          setReviews(unwrap(res));
          break;
        }
        case 'settings': {
          const res = await getCustomerSettings();
          setSettings(unwrap(res));
          break;
        }
        default:
          break;
      }
    } catch (e) {
      setErr(e.message || tr('error'));
    } finally {
      setBusy(false);
    }
  }, [open, user, tab, tr]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await patchCustomerProfile(profileForm);
      setProfile(unwrap(res));
      setFlash(tr('saved'));
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await changeCustomerPassword(pwForm);
      setPwForm({ currentPassword: '', newPassword: '' });
      setFlash(tr('saved'));
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const onPincodeBlur = async () => {
    const pin = addrForm.pincode?.trim();
    if (pin?.length !== 6) return;
    try {
      const res = await checkServiceability(pin);
      const d = unwrap(res);
      setPinCheck(d);
      if (d.serviceable && d.city) setAddrForm((f) => ({ ...f, city: d.city }));
    } catch {
      setPinCheck({ serviceable: false, pincode: pin });
    }
  };

  const submitAddress = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await addCustomerAddress(addrForm);
      setAddresses(unwrap(res));
      setAddrForm({
        tag: 'Home',
        flatBuilding: '',
        streetArea: '',
        pincode: '',
        city: '',
        isDefault: false
      });
      setPinCheck(null);
      setFlash(tr('saved'));
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const shareReferral = () => {
    if (!referral) return;
    const text = referral.whatsappText || `Join Japto.in: ${referral.link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const switchLanguage = async (lang) => {
    setLanguage?.(lang);
    try {
      await patchCustomerProfile({ preferredLanguage: lang });
      setFlash(tr('saved'));
    } catch (ex) {
      setErr(ex.message);
    }
  };

  if (!open) return null;

  const panel = (
    <div className="flex h-full flex-col bg-white text-slate-800">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">{tr('account')}</h2>
        <button type="button" onClick={onClose} className={btnGhost}>
          {tr('close')}
        </button>
      </header>

      {!user ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-600">
          {tr('loginPrompt')}
        </div>
      ) : (
        <>
          <div className="border-b border-slate-100 px-3 py-2 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TABS.map((id) => (
                <TabChip
                  key={id}
                  id={id}
                  active={tab === id}
                  label={tabLabels[id]}
                  onClick={setTab}
                />
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <nav className="hidden w-40 shrink-0 flex-col gap-1 border-r border-slate-100 p-3 md:flex">
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-3 py-2 text-left text-xs font-bold ${
                    tab === id ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tabLabels[id]}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {busy && (
                <p className="mb-2 text-xs text-slate-500">{tr('loading')}</p>
              )}
              {flash && (
                <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  {flash}
                </p>
              )}
              {err && (
                <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {err}
                </p>
              )}

              {tab === 'profile' && (
                <div className="space-y-4 max-w-md">
                  <p className="text-xs text-slate-500">
                    {tr('phone')}: <span className="font-semibold text-slate-800">{user.phone}</span>
                  </p>
                  <form onSubmit={saveProfile} className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      {tr('name')}
                      <input
                        className={`mt-1 ${inputCls}`}
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      {tr('email')}
                      <input
                        type="email"
                        className={`mt-1 ${inputCls}`}
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      {tr('city')}
                      <select
                        className={`mt-1 ${inputCls}`}
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                      >
                        <option value="">—</option>
                        {cities.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" disabled={busy} className={btnPrimary}>
                      {tr('save')}
                    </button>
                  </form>
                  <form onSubmit={savePassword} className="space-y-3 border-t border-slate-100 pt-4">
                    <p className="text-xs font-black text-slate-900">{tr('changePassword')}</p>
                    <input
                      type="password"
                      placeholder={tr('currentPassword')}
                      className={inputCls}
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    />
                    <input
                      type="password"
                      placeholder={tr('newPassword')}
                      className={inputCls}
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    />
                    <button type="submit" disabled={busy} className={btnPrimary}>
                      {tr('changePassword')}
                    </button>
                  </form>
                  {profile?.walletBalance != null && (
                    <p className="text-xs text-slate-500">
                      {tr('balance')}: {fmtRs(profile.walletBalance)}
                    </p>
                  )}
                </div>
              )}

              {tab === 'addresses' && (
                <div className="space-y-4">
                  <ul className="space-y-2">
                    {addresses.length === 0 && (
                      <li className="text-xs text-slate-500">{tr('noData')}</li>
                    )}
                    {addresses.map((a) => (
                      <li
                        key={a._id}
                        className="rounded-xl border border-slate-200 p-3 text-xs"
                      >
                        <div className="font-bold text-slate-900">
                          {a.tag}
                          {a.isDefault ? (
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                              {tr('default')}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-slate-600">
                          {a.flatBuilding}, {a.streetArea}, {a.city} – {a.pincode}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!a.isDefault && (
                            <button
                              type="button"
                              className={btnGhost}
                              onClick={async () => {
                                const res = await patchCustomerAddress(a._id, { isDefault: true });
                                setAddresses(unwrap(res));
                              }}
                            >
                              {tr('default')}
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-[11px] font-bold text-red-600"
                            onClick={async () => {
                              const res = await deleteCustomerAddress(a._id);
                              setAddresses(unwrap(res));
                            }}
                          >
                            {tr('remove')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={submitAddress} className="max-w-md space-y-2 rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-black">{tr('addAddress')}</p>
                    <input
                      className={inputCls}
                      placeholder="Tag"
                      value={addrForm.tag}
                      onChange={(e) => setAddrForm({ ...addrForm, tag: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder="Flat / building"
                      value={addrForm.flatBuilding}
                      onChange={(e) => setAddrForm({ ...addrForm, flatBuilding: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder="Street / area"
                      value={addrForm.streetArea}
                      onChange={(e) => setAddrForm({ ...addrForm, streetArea: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder={tr('pincode')}
                      value={addrForm.pincode}
                      onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })}
                      onBlur={onPincodeBlur}
                    />
                    {pinCheck && (
                      <p
                        className={`text-[11px] font-semibold ${
                          pinCheck.serviceable ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {pinCheck.serviceable ? tr('serviceable') : tr('notServiceable')}
                        {pinCheck.area ? ` · ${pinCheck.area}` : ''}
                      </p>
                    )}
                    <input
                      className={inputCls}
                      placeholder={tr('city')}
                      value={addrForm.city}
                      onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={addrForm.isDefault}
                        onChange={(e) => setAddrForm({ ...addrForm, isDefault: e.target.checked })}
                      />
                      {tr('default')}
                    </label>
                    <button type="submit" disabled={busy} className={btnPrimary}>
                      {tr('addAddress')}
                    </button>
                  </form>
                </div>
              )}

              {tab === 'wishlist' && (
                <ul className="space-y-2">
                  {wishlist.length === 0 && (
                    <li className="text-xs text-slate-500">{tr('noData')}</li>
                  )}
                  {wishlist.map((w) => (
                    <li
                      key={w._id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {w.product?.name || 'Product'}
                        </p>
                        <p className="text-slate-500">
                          {w.store?.name || ''} · {fmtRs(w.currentPrice ?? w.priceSnapshot)}
                          {w.outOfStock ? ' · OOS' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-bold text-red-600"
                        onClick={async () => {
                          await removeWishlist(w.product?._id || w.product);
                          loadTab();
                        }}
                      >
                        {tr('remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {tab === 'orders' && (
                <div className="space-y-3">
                  {onOpenOrders && (
                    <button type="button" className={btnGhost} onClick={onOpenOrders}>
                      {tr('openOrders')}
                    </button>
                  )}
                  {orders.length === 0 && (
                    <p className="text-xs text-slate-500">{tr('noData')}</p>
                  )}
                  {orders.map((o) => (
                    <div
                      key={o._id}
                      className="rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-black text-slate-900">#{o.orderNumber}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold capitalize">
                          {o.status}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">
                        {o.storeId?.name || 'Store'} · {fmtRs(o.grandTotal)} ·{' '}
                        {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                      {!['completed', 'cancelled', 'rejected', 'out_for_delivery'].includes(
                        o.status
                      ) && (
                        <div className="mt-2 flex gap-2">
                          <input
                            className={`flex-1 ${inputCls}`}
                            placeholder={tr('reason')}
                            value={cancelReason[o._id] || ''}
                            onChange={(e) =>
                              setCancelReason({ ...cancelReason, [o._id]: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            className={btnPrimary}
                            onClick={async () => {
                              const reason = cancelReason[o._id];
                              if (!reason?.trim()) return;
                              await requestOrderCancel(o._id, reason.trim());
                              loadTab();
                            }}
                          >
                            {tr('cancelOrder')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'payments' && (
                <ul className="space-y-2">
                  {payments.length === 0 && (
                    <li className="text-xs text-slate-500">{tr('noData')}</li>
                  )}
                  {payments.map((p) => (
                    <li
                      key={p._id || p.orderNumber}
                      className="rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <p className="font-bold">#{p.orderNumber}</p>
                      <p className="text-slate-600">
                        {fmtRs(p.grandTotal)} · {p.paymentMode} · {p.paymentStatus}
                        {p.walletUsed ? ` · wallet ${fmtRs(p.walletUsed)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {tab === 'coupons' && (
                <ul className="space-y-2">
                  {coupons.length === 0 && (
                    <li className="text-xs text-slate-500">{tr('noData')}</li>
                  )}
                  {coupons.map((c) => (
                    <li
                      key={c._id || c.code}
                      className="rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <p className="font-black text-slate-900">{c.code}</p>
                      <p className="text-slate-600">
                        {c.discountType === 'percent'
                          ? `${c.discountValue}% off`
                          : `${fmtRs(c.discountValue)} off`}
                        {c.minOrderValue ? ` · min ${fmtRs(c.minOrderValue)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {tab === 'wallet' && (
                <div className="space-y-3 text-xs">
                  <p className="text-lg font-black text-slate-900">
                    {tr('balance')}: {fmtRs(wallet.balance)}
                  </p>
                  {wallet.note && <p className="text-slate-500">{wallet.note}</p>}
                  <ul className="space-y-1">
                    {(wallet.ledger || []).map((row) => (
                      <li
                        key={row._id}
                        className="flex justify-between rounded-lg border border-slate-100 px-2 py-1.5"
                      >
                        <span>{row.description || row.type}</span>
                        <span
                          className={
                            Number(row.amount) >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }
                        >
                          {fmtRs(row.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'referral' && referral && (
                <div className="max-w-sm space-y-3 text-xs">
                  <p>
                    {tr('referralCode')}:{' '}
                    <span className="font-mono text-base font-black">{referral.code}</span>
                  </p>
                  <p className="break-all text-slate-600">{referral.link}</p>
                  <p>
                    {tr('referred')}: <strong>{referral.referredCount ?? 0}</strong>
                  </p>
                  <button type="button" onClick={shareReferral} className={btnPrimary}>
                    {tr('shareWhatsApp')}
                  </button>
                </div>
              )}

              {tab === 'notifications' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={async () => {
                      await markAllCustomerNotifications();
                      loadTab();
                    }}
                  >
                    {tr('markAllRead')}
                  </button>
                  {notifications.length === 0 && (
                    <p className="text-xs text-slate-500">{tr('noData')}</p>
                  )}
                  {notifications.map((n) => (
                    <button
                      key={n._id}
                      type="button"
                      onClick={async () => {
                        if (!n.read) await markCustomerNotification(n._id, true);
                        loadTab();
                      }}
                      className={`w-full rounded-xl border p-3 text-left text-xs ${
                        n.read ? 'border-slate-100 bg-white' : 'border-slate-300 bg-slate-50'
                      }`}
                    >
                      <p className="font-bold text-slate-900">{n.title}</p>
                      <p className="text-slate-600">{n.body}</p>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'support' && (
                <div className="space-y-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        await createCustomerComplaint(complaintForm);
                        setComplaintForm({ subject: '', message: '', category: 'general' });
                        loadTab();
                        setFlash(tr('saved'));
                      } catch (ex) {
                        setErr(ex.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="max-w-md space-y-2 rounded-xl border border-slate-200 p-3"
                  >
                    <p className="text-xs font-black">{tr('newComplaint')}</p>
                    <input
                      className={inputCls}
                      placeholder={tr('subject')}
                      value={complaintForm.subject}
                      onChange={(e) =>
                        setComplaintForm({ ...complaintForm, subject: e.target.value })
                      }
                    />
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder={tr('message')}
                      value={complaintForm.message}
                      onChange={(e) =>
                        setComplaintForm({ ...complaintForm, message: e.target.value })
                      }
                    />
                    <button type="submit" disabled={busy} className={btnPrimary}>
                      {tr('submit')}
                    </button>
                  </form>
                  <ul className="space-y-2 text-xs">
                    {complaints.map((c) => (
                      <li key={c._id} className="rounded-xl border border-slate-200 p-3">
                        <p className="font-bold">{c.subject}</p>
                        <p className="text-slate-600">{c.message}</p>
                        <p className="mt-1 capitalize text-slate-400">{c.status}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'reviews' && (
                <div className="space-y-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        await submitCustomerReview(reviewForm);
                        setReviewForm({
                          productId: '',
                          storeId: '',
                          orderId: '',
                          rating: 5,
                          comment: ''
                        });
                        loadTab();
                        setFlash(tr('saved'));
                      } catch (ex) {
                        setErr(ex.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="max-w-md space-y-2 rounded-xl border border-slate-200 p-3 text-xs"
                  >
                    <p className="font-black">Submit review (verified purchase)</p>
                    <input
                      className={inputCls}
                      placeholder="Product ID"
                      value={reviewForm.productId}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, productId: e.target.value })
                      }
                    />
                    <input
                      className={inputCls}
                      placeholder="Store ID"
                      value={reviewForm.storeId}
                      onChange={(e) => setReviewForm({ ...reviewForm, storeId: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      max={5}
                      value={reviewForm.rating}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, rating: Number(e.target.value) })
                      }
                    />
                    <textarea
                      className={inputCls}
                      rows={2}
                      placeholder="Comment"
                      value={reviewForm.comment}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, comment: e.target.value })
                      }
                    />
                    <button type="submit" disabled={busy} className={btnPrimary}>
                      {tr('submit')}
                    </button>
                  </form>
                  <ul className="space-y-2 text-xs">
                    {reviews.map((r) => (
                      <li key={r._id} className="rounded-xl border border-slate-200 p-3">
                        <p className="font-bold">{r.productId?.name || 'Product'}</p>
                        <p>
                          ★ {r.rating} · {r.approvalStatus}
                        </p>
                        <p className="text-slate-600">{r.comment}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'settings' && (
                <div className="max-w-lg space-y-4 text-xs">
                  <div>
                    <p className="mb-2 font-black text-slate-900">{tr('language')}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={
                          language === 'en'
                            ? btnPrimary
                            : btnGhost
                        }
                        onClick={() => switchLanguage('en')}
                      >
                        {tr('english')}
                      </button>
                      <button
                        type="button"
                        className={
                          language === 'hi'
                            ? btnPrimary
                            : btnGhost
                        }
                        onClick={() => switchLanguage('hi')}
                      >
                        {tr('hindi')}
                      </button>
                    </div>
                  </div>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{tr('logoutNote')}</p>
                  {settings && (
                    <>
                      {settings.privacyHtml && (
                        <details className="rounded-xl border border-slate-200 p-3">
                          <summary className="cursor-pointer font-bold">{tr('privacyPolicy')}</summary>
                          <div
                            className="prose prose-sm mt-2 max-w-none text-slate-700"
                            dangerouslySetInnerHTML={{ __html: settings.privacyHtml }}
                          />
                        </details>
                      )}
                      {settings.termsHtml && (
                        <details className="rounded-xl border border-slate-200 p-3">
                          <summary className="cursor-pointer font-bold">{tr('termsOfUse')}</summary>
                          <div
                            className="prose prose-sm mt-2 max-w-none text-slate-700"
                            dangerouslySetInnerHTML={{ __html: settings.termsHtml }}
                          />
                        </details>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                    onClick={async () => {
                      if (!window.confirm('Request permanent account deletion?')) return;
                      try {
                        await requestAccountDeletion();
                        setFlash(
                          language === 'hi'
                            ? 'हटाने का अनुरोध भेजा गया'
                            : 'Deletion request submitted'
                        );
                        loadTab();
                      } catch (ex) {
                        setErr(ex.message);
                      }
                    }}
                  >
                    {tr('deleteAccount')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Close panel backdrop"
        className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {panel}
      </aside>
    </>
  );
}