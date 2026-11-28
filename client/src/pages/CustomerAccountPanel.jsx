import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { t } from '../context/LanguageContext';
import FormField from '../components/FormField';
import NotificationBell from '../components/NotificationBell';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
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
  checkServiceability,
  sendCustomerOtp
} from '../services/api';

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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
const addrInputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-400';
const addrLabelCls = 'mb-1 block text-sm font-bold text-slate-900';
const btnPrimary =
  'rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50';
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

const ADDRESS_TYPES = [
  {
    id: 'House',
    hint: 'Independent house, villa, or builder floor (6 AM - 11 PM delivery)'
  },
  {
    id: 'Apartment',
    hint: 'Flat in a society or apartment complex (delivery to lobby / door)'
  },
  {
    id: 'Business',
    hint: 'Office, shop, or commercial building (delivery during business hours)'
  },
  {
    id: 'Other',
    hint: 'Hostel, PG, hotel, or other location type'
  }
];

const EMPTY_ADDR = () => ({
  fullName: '',
  mobile: '',
  pincode: '',
  flatBuilding: '',
  streetArea: '',
  landmark: '',
  city: '',
  state: '',
  addressType: 'House',
  tag: 'Home',
  weekendDelivery: '',
  deliveryInstructions: '',
  isDefault: false
});

const tagFromAddressType = (addressType) => {
  if (addressType === 'Business') return 'Office';
  if (addressType === 'Other') return 'Other';
  return 'Home';
};

function TabChip({ id, active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${active
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
  onLogout,
  language = 'en',
  setLanguage
}) {
  const { user, logout } = useAuth();
  const tr = useCallback((key) => t(key, language), [language]);

  const [tab, setTab] = useState('profile');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [err, setErr] = useState('');

  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', city: '', avatarUrl: '' });
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpHint, setEmailOtpHint] = useState('');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', otp: '' });
  const [pwOtpSent, setPwOtpSent] = useState(false);
  const [pwOtpHint, setPwOtpHint] = useState('');

  const [addresses, setAddresses] = useState([]);
  const [addrForm, setAddrForm] = useState(EMPTY_ADDR);
  const [editingAddrId, setEditingAddrId] = useState(null);
  const [deliveryPrefsOpen, setDeliveryPrefsOpen] = useState(true);
  const [weekendOpen, setWeekendOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
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
          setProfileForm({
            name: p.name || '',
            email: p.email || '',
            city: p.city || '',
            avatarUrl: p.avatarUrl || ''
          });
          setEmailOtp('');
          setEmailOtpSent(false);
          setEmailOtpHint('');
          setPwForm({ currentPassword: '', newPassword: '', otp: '' });
          setPwOtpSent(false);
          setPwOtpHint('');
          const cRes = await getEnabledCities();
          setCities(unwrap(cRes).cities || unwrap(cRes) || []);
          break;
        }
        case 'addresses': {
          const res = await getCustomerAddresses();
          setAddresses(unwrap(res));
          if (!editingAddrId) {
            setAddrForm((f) => ({
              ...f,
              fullName: f.fullName || profile?.name || user?.name || '',
              mobile: f.mobile || profile?.phone || user?.phone || ''
            }));
          }
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

  const emailChanged = useMemo(() => {
    const next = String(profileForm.email || '').trim().toLowerCase();
    const cur = String(profile?.email || '').trim().toLowerCase();
    return !!next && next !== cur;
  }, [profileForm.email, profile?.email]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name?.trim()) {
      setErr('Name is required');
      return;
    }
    if (!profileForm.email?.trim()) {
      setErr('Email is required');
      return;
    }
    if (emailChanged && (!emailOtpSent || !emailOtp.trim())) {
      setErr('Send OTP and verify to update email');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const payload = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        city: profileForm.city,
        avatarUrl: profileForm.avatarUrl
      };
      if (emailChanged) payload.otp = emailOtp.trim();
      const res = await patchCustomerProfile(payload);
      setProfile(unwrap(res));
      setEmailOtp('');
      setEmailOtpSent(false);
      setEmailOtpHint('');
      setFlash(tr('saved'));
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const sendEmailChangeOtp = async () => {
    const phone = profile?.phone || user?.phone;
    if (!phone) {
      setErr('Phone not found on profile');
      return;
    }
    if (!emailChanged) {
      setErr('Change email first, then verify with OTP');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await sendCustomerOtp({ phone, purpose: 'email_change' });
      setEmailOtpSent(true);
      setEmailOtpHint(res.message || 'OTP sent to your mobile');
      setEmailOtp('');
    } catch (ex) {
      setErr(ex.message);
      setEmailOtpSent(false);
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordOtp = async () => {
    const phone = profile?.phone || user?.phone;
    if (!phone) {
      setErr('Phone not found on profile');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await sendCustomerOtp({ phone, purpose: 'reset' });
      setPwOtpSent(true);
      setPwOtpHint(res.message || 'OTP sent');
      setPwForm((f) => ({ ...f, otp: '' }));
    } catch (ex) {
      setErr(ex.message);
      setPwOtpSent(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSecureLogout = async () => {
    try {
      if (onLogout) await onLogout();
      else await logout();
    } finally {
      onClose?.();
    }
  };

  const handleDeletionRequest = async () => {
    if (profile?.deletionRequested) {
      setFlash(
        language === 'hi'
          ? 'हटाने का अनुरोध पहले से Admin के पास है'
          : 'Deletion request already pending Admin review'
      );
      return;
    }
    if (!window.confirm('Request permanent account deletion? Admin will review this request.')) {
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await requestAccountDeletion();
      setProfile(unwrap(res) || { ...profile, deletionRequested: true });
      setFlash(
        language === 'hi' ? 'हटाने का अनुरोध भेजा गया' : 'Deletion request submitted for Admin review'
      );
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pwOtpSent || !pwForm.otp?.trim()) {
      setErr('Send OTP first — password cannot change without OTP');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await changeCustomerPassword(pwForm);
      setPwForm({ currentPassword: '', newPassword: '', otp: '' });
      setPwOtpSent(false);
      setPwOtpHint('');
      setFlash(tr('saved'));
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const onAvatarFile = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setErr('Please upload an image');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErr('Image must be under 4MB');
      return;
    }
    try {
      const avatarUrl = await fileToDataUrl(file);
      setProfileForm((f) => ({ ...f, avatarUrl }));
      setBusy(true);
      const res = await patchCustomerProfile({ avatarUrl });
      setProfile(unwrap(res));
      setFlash('Profile photo updated');
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

  const startEditAddress = (a) => {
    setEditingAddrId(a._id);
    setAddrForm({
      fullName: a.fullName || profile?.name || user?.name || '',
      mobile: a.mobile || profile?.phone || user?.phone || '',
      pincode: a.pincode || '',
      flatBuilding: a.flatBuilding || '',
      streetArea: a.streetArea || '',
      landmark: a.landmark || '',
      city: a.city || '',
      state: a.state || '',
      addressType: a.addressType || 'House',
      tag: a.tag || tagFromAddressType(a.addressType || 'House'),
      weekendDelivery: a.weekendDelivery || '',
      deliveryInstructions: a.deliveryInstructions || '',
      isDefault: !!a.isDefault
    });
    setDeliveryPrefsOpen(true);
    setWeekendOpen(!!a.weekendDelivery);
    setInstructionsOpen(!!a.deliveryInstructions);
    setPinCheck(null);
    setErr('');
  };

  const resetAddressForm = () => {
    setEditingAddrId(null);
    setAddrForm({
      ...EMPTY_ADDR(),
      fullName: profile?.name || user?.name || '',
      mobile: profile?.phone || user?.phone || ''
    });
    setPinCheck(null);
  };

  const submitAddress = async (e) => {
    e.preventDefault();
    const {
      fullName,
      mobile,
      flatBuilding,
      streetArea,
      landmark,
      pincode,
      city,
      state
    } = addrForm;
    if (
      !fullName?.trim() ||
      !mobile?.trim() ||
      !flatBuilding?.trim() ||
      !streetArea?.trim() ||
      !landmark?.trim() ||
      !pincode?.trim() ||
      !city?.trim() ||
      !state?.trim()
    ) {
      setErr('All address fields are required');
      return;
    }
    const mob = String(mobile).replace(/\s+/g, '');
    if (!/^[6-9]\d{9}$/.test(mob) && !/^\+91[6-9]\d{9}$/.test(mob)) {
      setErr('Enter a valid 10-digit mobile number');
      return;
    }
    if (!/^\d{6}$/.test(String(pincode).trim())) {
      setErr('Pincode must be 6 digits');
      return;
    }
    const payload = {
      ...addrForm,
      mobile: mob,
      tag: tagFromAddressType(addrForm.addressType)
    };
    setBusy(true);
    setErr('');
    try {
      const res = editingAddrId
        ? await patchCustomerAddress(editingAddrId, payload)
        : await addCustomerAddress(payload);
      setAddresses(unwrap(res));
      resetAddressForm();
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
    <div className="flex h-full min-h-screen flex-col bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Customer</p>
          <h2 className="text-sm font-black text-slate-900">{tr('account')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <NotificationBell
              title="Your notifications"
              fetchInbox={async () => {
                const res = await getCustomerNotifications();
                const rows = res?.data ?? res ?? [];
                const list = Array.isArray(rows) ? rows : [];
                return {
                  items: list.map((n) => ({
                    ...n,
                    id: n._id,
                    body: n.body || n.message || ''
                  })),
                  unread: list.filter((n) => !n.read).length
                };
              }}
              onMarkRead={(n) => markCustomerNotification(n._id || n.id, true)}
              onMarkAllRead={markAllCustomerNotifications}
              onItemClick={() => setTab('notifications')}
            />
          ) : null}
          <button type="button" onClick={onClose} className={btnGhost}>
            {tr('close')} / Storefront
          </button>
        </div>
      </header>

      {!user ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-600">
          {tr('loginPrompt')}
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 bg-white px-3 py-2 md:hidden">
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
            <nav className="hidden w-56 shrink-0 flex-col gap-0.5 border-r border-slate-200 bg-white p-3 md:flex sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-3 py-2.5 text-left text-[11px] font-bold transition ${tab === id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  {tabLabels[id]}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
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
                <div className="mx-auto max-w-xl space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h3 className="text-sm font-black text-slate-900">Customer Profile</h3>
                  </div>

                  {/* Profile photo */}
                  <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Profile photo
                    </h4>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                        {profileForm.avatarUrl ? (
                          <img
                            src={profileForm.avatarUrl}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">
                            No photo
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700">
                          Upload or change profile photo
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-[11px]"
                          onChange={(e) => onAvatarFile(e.target.files?.[0])}
                        />
                        {profileForm.avatarUrl ? (
                          <button
                            type="button"
                            className="text-[11px] font-bold text-rose-600"
                            onClick={async () => {
                              setProfileForm((f) => ({ ...f, avatarUrl: '' }));
                              try {
                                const res = await patchCustomerProfile({ avatarUrl: '' });
                                setProfile(unwrap(res));
                                setFlash('Photo removed');
                              } catch (ex) {
                                setErr(ex.message);
                              }
                            }}
                          >
                            Remove photo
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  {/* Name / Mobile / Email */}
                  <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <form onSubmit={saveProfile} className="space-y-4">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-800">
                          Name (view & edit)
                        </label>
                        <input
                          className={inputCls}
                          value={profileForm.name}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-800">
                          Mobile number (view only)
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className={`${inputCls} bg-slate-50 text-slate-700`}
                            value={profile?.phone || user?.phone || ''}
                            readOnly
                            disabled
                          />
                          {profile?.phoneVerified || user?.phoneVerified ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                              OTP verified
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                              Not verified
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Mobile cannot be changed here. It was verified during registration / OTP
                          login.
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-800">
                          Email (view & update — OTP verification required when changed)
                        </label>
                        <input
                          type="email"
                          className={inputCls}
                          value={profileForm.email}
                          onChange={(e) => {
                            setProfileForm({ ...profileForm, email: e.target.value });
                            setEmailOtpSent(false);
                            setEmailOtp('');
                            setEmailOtpHint('');
                          }}
                          required
                        />
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {profile?.emailVerified ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                              Email verified
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                              Verification pending
                            </span>
                          )}
                        </div>
                        {emailChanged ? (
                          <div className="mt-2 space-y-2 rounded-lg border border-sky-100 bg-sky-50/60 p-3">
                            <p className="text-[11px] font-semibold text-sky-900">
                              Email change requires OTP sent to your registered mobile.
                            </p>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={sendEmailChangeOtp}
                              className={btnGhost}
                            >
                              {emailOtpSent ? 'Resend OTP' : 'Send OTP to verify email change'}
                            </button>
                            {emailOtpHint ? (
                              <p className="text-[11px] font-semibold text-emerald-700">
                                {emailOtpHint}
                              </p>
                            ) : null}
                            {emailOtpSent ? (
                              <FormField label="OTP *">
                                <input
                                  className={inputCls}
                                  value={emailOtp}
                                  onChange={(e) => setEmailOtp(e.target.value)}
                                  required
                                />
                              </FormField>
                            ) : (
                              <p className="text-[10px] font-semibold text-slate-500">
                                OTP field appears after Send OTP
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-800">
                          Preferred city (optional)
                        </label>
                        <select
                          className={inputCls}
                          value={profileForm.city}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, city: e.target.value })
                          }
                        >
                          <option value="">—</option>
                          {cities.map((c) => (
                            <option
                              key={typeof c === 'string' ? c : c.city || c}
                              value={typeof c === 'string' ? c : c.city || c}
                            >
                              {typeof c === 'string' ? c : c.city || c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button type="submit" disabled={busy} className={btnPrimary}>
                        Save profile
                      </button>
                    </form>
                  </section>

                  {/* Change password */}
                  <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Change password
                    </h4>
                    <form onSubmit={savePassword} className="mt-3 space-y-3">
                      <FormField label={tr('currentPassword')}>
                        <input
                          type="password"
                          className={inputCls}
                          value={pwForm.currentPassword}
                          onChange={(e) =>
                            setPwForm({ ...pwForm, currentPassword: e.target.value })
                          }
                          required
                          autoComplete="current-password"
                        />
                      </FormField>
                      <FormField label={tr('newPassword')}>
                        <input
                          type="password"
                          className={inputCls}
                          value={pwForm.newPassword}
                          onChange={(e) =>
                            setPwForm({ ...pwForm, newPassword: e.target.value })
                          }
                          required
                          minLength={6}
                          autoComplete="new-password"
                        />
                        <PasswordStrengthMeter password={pwForm.newPassword} />
                      </FormField>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={sendPasswordOtp}
                        className={btnGhost}
                      >
                        {pwOtpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                      {pwOtpHint ? (
                        <p className="text-[11px] font-semibold text-emerald-700">{pwOtpHint}</p>
                      ) : null}
                      {pwOtpSent ? (
                        <FormField label="OTP *">
                          <input
                            className={inputCls}
                            value={pwForm.otp}
                            onChange={(e) => setPwForm({ ...pwForm, otp: e.target.value })}
                            required
                          />
                        </FormField>
                      ) : (
                        <p className="text-[10px] font-semibold text-slate-500">
                          OTP required — field appears after Send OTP. Password cannot change
                          without OTP.
                        </p>
                      )}
                      <button type="submit" disabled={busy || !pwOtpSent} className={btnPrimary}>
                        {tr('changePassword')}
                      </button>
                    </form>
                  </section>

                  {/* Logout */}
                  <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Secure logout
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Ends your session on this device and clears the signed-in token.
                    </p>
                    <button
                      type="button"
                      className={`${btnGhost} mt-3`}
                      onClick={handleSecureLogout}
                    >
                      Logout
                    </button>
                  </section>

                  {/* Account deletion */}
                  <section className="rounded-xl border border-red-100 bg-white p-4 sm:p-5">
                    <h4 className="text-xs font-black uppercase tracking-wide text-red-600">
                      Account deletion request
                    </h4>
                    {profile?.deletionRequested ? (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        Deletion request pending Admin review
                        {profile.deletionRequestedAt
                          ? ` · ${new Date(profile.deletionRequestedAt).toLocaleString()}`
                          : ''}
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Submit a request to permanently delete your account. Admin reviews before
                          action.
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          onClick={handleDeletionRequest}
                        >
                          {tr('deleteAccount')}
                        </button>
                      </>
                    )}
                  </section>

                  {profile?.walletBalance != null && (
                    <p className="text-xs text-slate-500">
                      {tr('balance')}: {fmtRs(profile.walletBalance)}
                    </p>
                  )}
                </div>
              )}

              {tab === 'addresses' && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                  <ul className="space-y-3">
                    {addresses.length === 0 && (
                      <li className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                        {tr('noData')}
                      </li>
                    )}
                    {addresses.map((a) => (
                      <li
                        key={a._id}
                        className={`rounded-xl border bg-white p-4 text-sm ${editingAddrId === a._id
                          ? 'border-sky-400 ring-1 ring-sky-200'
                          : 'border-slate-200'
                          }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {a.fullName || a.tag || 'Address'}
                          </span>
                          <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {a.addressType || a.tag || 'House'}
                          </span>
                          {a.isDefault ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              {tr('default')}
                            </span>
                          ) : null}
                        </div>
                        {a.mobile ? (
                          <p className="mt-1 text-xs text-slate-500">Phone: {a.mobile}</p>
                        ) : null}
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {[a.flatBuilding, a.streetArea, a.landmark]
                            .filter(Boolean)
                            .join(', ')}
                          <br />
                          {[a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                        </p>
                        {a.deliveryInstructions ? (
                          <p className="mt-1 text-[11px] italic text-slate-500">
                            Note: {a.deliveryInstructions}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={btnGhost}
                            onClick={() => startEditAddress(a)}
                          >
                            Edit
                          </button>
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
                            className="rounded-lg px-3 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              const res = await deleteCustomerAddress(a._id);
                              setAddresses(unwrap(res));
                              if (editingAddrId === a._id) resetAddressForm();
                            }}
                          >
                            {tr('remove')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <form
                    onSubmit={submitAddress}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base font-black text-slate-900">
                        {editingAddrId ? 'Edit address' : tr('addAddress')}
                      </p>
                      {editingAddrId ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-sky-700 hover:underline"
                          onClick={resetAddressForm}
                        >
                          Cancel edit
                        </button>
                      ) : null}
                    </div>

                    <div>
                      <label className={addrLabelCls} htmlFor="addr-fullName">
                        Full name (First and Last name)
                      </label>
                      <input
                        id="addr-fullName"
                        className={addrInputCls}
                        value={addrForm.fullName}
                        onChange={(e) => setAddrForm({ ...addrForm, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className={addrLabelCls} htmlFor="addr-mobile">
                        Mobile number
                      </label>
                      <input
                        id="addr-mobile"
                        className={addrInputCls}
                        value={addrForm.mobile}
                        onChange={(e) => setAddrForm({ ...addrForm, mobile: e.target.value })}
                        inputMode="tel"
                        maxLength={13}
                        required
                      />
                    </div>

                    <div>
                      <label className={addrLabelCls} htmlFor="addr-pincode">
                        Pincode
                      </label>
                      <input
                        id="addr-pincode"
                        className={addrInputCls}
                        value={addrForm.pincode}
                        onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })}
                        onBlur={onPincodeBlur}
                        required
                        minLength={6}
                        maxLength={6}
                        pattern="\d{6}"
                        inputMode="numeric"
                      />
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        6-digit India Post PIN code
                      </p>
                      {pinCheck && (
                        <p
                          className={`mt-1 text-[11px] font-semibold ${pinCheck.serviceable ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                        >
                          {pinCheck.serviceable ? tr('serviceable') : tr('notServiceable')}
                          {pinCheck.area ? ` · ${pinCheck.area}` : ''}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={addrLabelCls} htmlFor="addr-flat">
                        Flat, House no., Building, Company, Apartment
                      </label>
                      <input
                        id="addr-flat"
                        className={addrInputCls}
                        value={addrForm.flatBuilding}
                        onChange={(e) =>
                          setAddrForm({ ...addrForm, flatBuilding: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className={addrLabelCls} htmlFor="addr-street">
                        Area, Street, Sector, Village
                      </label>
                      <input
                        id="addr-street"
                        className={addrInputCls}
                        value={addrForm.streetArea}
                        onChange={(e) =>
                          setAddrForm({ ...addrForm, streetArea: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className={addrLabelCls} htmlFor="addr-landmark">
                        Landmark
                      </label>
                      <input
                        id="addr-landmark"
                        className={addrInputCls}
                        value={addrForm.landmark}
                        onChange={(e) => setAddrForm({ ...addrForm, landmark: e.target.value })}
                        required
                      />
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        Example: near Apollo Hospital
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div>
                        <label className={addrLabelCls} htmlFor="addr-city">
                          Town/City
                        </label>
                        <input
                          id="addr-city"
                          className={addrInputCls}
                          value={addrForm.city}
                          onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className={addrLabelCls} htmlFor="addr-state">
                          State
                        </label>
                        <select
                          id="addr-state"
                          className={addrInputCls}
                          value={addrForm.state}
                          onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                          required
                        >
                          <option value="">Choose a state</option>
                          {INDIAN_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-sm font-bold text-slate-900">
                        Delivery instructions (optional)
                      </p>
                      <button
                        type="button"
                        className="mt-1 flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
                        onClick={() => setDeliveryPrefsOpen((v) => !v)}
                      >
                        Add preferences, notes, access codes and more
                        <span className="text-xs">{deliveryPrefsOpen ? '▴' : '▾'}</span>
                      </button>

                      {deliveryPrefsOpen && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="mb-2 text-sm text-slate-800">Address Type</p>
                            <div className="flex flex-wrap gap-2">
                              {ADDRESS_TYPES.map((atype) => {
                                const active = addrForm.addressType === atype.id;
                                return (
                                  <button
                                    key={atype.id}
                                    type="button"
                                    onClick={() =>
                                      setAddrForm({
                                        ...addrForm,
                                        addressType: atype.id,
                                        tag: tagFromAddressType(atype.id)
                                      })
                                    }
                                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${active
                                      ? 'border-sky-600 font-bold text-sky-800 ring-1 ring-sky-500'
                                      : 'border-slate-300 font-medium text-slate-700 hover:border-slate-400'
                                      }`}
                                  >
                                    {atype.id}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-xs italic text-slate-500">
                              {
                                ADDRESS_TYPES.find((atype) => atype.id === addrForm.addressType)
                                  ?.hint
                              }
                            </p>
                          </div>

                          <div className="overflow-hidden rounded-md border border-slate-300">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm text-slate-800 hover:bg-slate-50"
                              onClick={() => setWeekendOpen((v) => !v)}
                            >
                              Can you receive deliveries at this address on weekends?
                              <span className="text-xs text-slate-500">
                                {weekendOpen ? '▴' : '▾'}
                              </span>
                            </button>
                            {weekendOpen && (
                              <div className="space-y-2 border-t border-slate-200 px-3 py-3">
                                {[
                                  { id: 'yes', label: 'Yes, weekends are fine' },
                                  { id: 'no', label: 'No, weekdays only' }
                                ].map((opt) => (
                                  <label
                                    key={opt.id}
                                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                                  >
                                    <input
                                      type="radio"
                                      name="weekendDelivery"
                                      checked={addrForm.weekendDelivery === opt.id}
                                      onChange={() =>
                                        setAddrForm({
                                          ...addrForm,
                                          weekendDelivery: opt.id
                                        })
                                      }
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="overflow-hidden rounded-md border border-slate-300">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm text-slate-800 hover:bg-slate-50"
                              onClick={() => setInstructionsOpen((v) => !v)}
                            >
                              Do we need additional instructions to deliver to this address?
                              <span className="text-xs text-slate-500">
                                {instructionsOpen ? '▴' : '▾'}
                              </span>
                            </button>
                            {instructionsOpen && (
                              <div className="border-t border-slate-200 px-3 py-3">
                                <label
                                  className="mb-1 block text-sm font-bold text-slate-900"
                                  htmlFor="addr-instructions"
                                >
                                  Delivery instructions
                                </label>
                                <textarea
                                  id="addr-instructions"
                                  className={`${addrInputCls} min-h-[88px] resize-y`}
                                  value={addrForm.deliveryInstructions}
                                  onChange={(e) =>
                                    setAddrForm({
                                      ...addrForm,
                                      deliveryInstructions: e.target.value
                                    })
                                  }
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                  Building description, nearby landmark, or other navigation
                                  details.
                                </p>
                                <p className="mt-1 text-xs italic text-slate-500">
                                  Your instructions help us deliver your packages to your
                                  expectations and will be used when possible.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={addrForm.isDefault}
                        onChange={(e) =>
                          setAddrForm({ ...addrForm, isDefault: e.target.checked })
                        }
                      />
                      Use as default address
                    </label>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button type="submit" disabled={busy} className={btnPrimary}>
                        {editingAddrId ? 'Update address' : tr('addAddress')}
                      </button>
                      {editingAddrId ? (
                        <button type="button" className={btnGhost} onClick={resetAddressForm}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
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
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            <FormField label={tr('reason')} className="flex-1 min-w-[160px]">
                              <input
                                className={inputCls}
                                value={cancelReason[o._id] || ''}
                                onChange={(e) =>
                                  setCancelReason({ ...cancelReason, [o._id]: e.target.value })
                                }
                              />
                            </FormField>
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
                      className={`w-full rounded-xl border p-3 text-left text-xs ${n.read ? 'border-slate-100 bg-white' : 'border-slate-300 bg-slate-50'
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
                    <FormField label={tr('subject')}>
                      <input
                        className={inputCls}
                        value={complaintForm.subject}
                        onChange={(e) =>
                          setComplaintForm({ ...complaintForm, subject: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField label={tr('message')}>
                      <textarea
                        className={inputCls}
                        rows={3}
                        value={complaintForm.message}
                        onChange={(e) =>
                          setComplaintForm({ ...complaintForm, message: e.target.value })
                        }
                      />
                    </FormField>
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
                    <FormField label="Product ID">
                      <input
                        className={inputCls}
                        value={reviewForm.productId}
                        onChange={(e) =>
                          setReviewForm({ ...reviewForm, productId: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="Store ID">
                      <input
                        className={inputCls}
                        value={reviewForm.storeId}
                        onChange={(e) =>
                          setReviewForm({ ...reviewForm, storeId: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="Rating (1–5)">
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
                    </FormField>
                    <FormField label="Comment">
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={reviewForm.comment}
                        onChange={(e) =>
                          setReviewForm({ ...reviewForm, comment: e.target.value })
                        }
                      />
                    </FormField>
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
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                    Account deletion is managed from the{' '}
                    <button
                      type="button"
                      className="font-bold text-slate-900 underline"
                      onClick={() => setTab('profile')}
                    >
                      Profile
                    </button>{' '}
                    tab (section 3.2).
                  </p>
                  {profile?.deletionRequested ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-800">
                      Deletion request pending Admin review
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[61] flex flex-col bg-slate-100"
      role="dialog"
      aria-modal="true"
    >
      {panel}
    </div>
  );
}