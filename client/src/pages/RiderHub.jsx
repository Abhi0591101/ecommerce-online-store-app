import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  acceptDeliveryApi,
  confirmPickupApi,
  createRiderRequest,
  getAvailableDeliveries,
  getMyDeliveries,
  getRiderNotifications,
  getRiderProfile,
  getRiderRequests,
  getRiderStats,
  markRiderNotificationRead,
  patchDeliveryStatusApi,
  patchRiderProfile,
  registerDeliveryBoy,
  rejectDeliveryApi,
  sendRiderOtp,
  setRiderDutyApi,
  verifyDeliveryOtpApi
} from '../services/api';

const TAB_KEY = 'japto_rider_tab';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'orders', label: 'Orders' },
  { id: 'active', label: 'Active run' },
  { id: 'history', label: 'History' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'requests', label: 'Requests' },
  { id: 'profile', label: 'Profile' }
];

const ACTIVE_STATUSES = new Set([
  'accepted',
  'assigned',
  'reached_pickup',
  'picked_up',
  'on_the_way',
  'reached_customer',
  'arrived_at_store',
  'out_for_delivery'
]);

const HISTORY_DONE = new Set(['delivered', 'cancelled', 'rejected']);

const STATUS_LABELS = {
  accepted: 'Accepted',
  reached_pickup: 'Reached pickup',
  picked_up: 'Picked up',
  on_the_way: 'On the way',
  reached_customer: 'Reached customer',
  delivered: 'Delivered',
  offered: 'Offered',
  assigned: 'Assigned',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

const REQUEST_TYPES = [
  { id: 'general', label: 'General' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'payment', label: 'Payment' },
  { id: 'other', label: 'Other' },
  { id: 'seller_onboarding', label: 'Seller onboarding' }
];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pickData = (res) => res?.data ?? res;
const pickList = (res) => {
  const d = pickData(res);
  return Array.isArray(d) ? d : d?.data ?? d?.rows ?? [];
};
const fmtDate = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(v);
  }
};

const gmapsDir = (lat, lng, label = '') => {
  if (lat == null || lng == null) return null;
  const q = label ? `${lat},${lng} (${encodeURIComponent(label)})` : `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function Btn({ children, onClick, variant = 'default', className = '', disabled, type = 'button' }) {
  const base = 'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-slate-900 text-white border-slate-900'
      : variant === 'danger'
        ? 'bg-red-50 text-red-700 border-red-200'
        : variant === 'ok'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function PanelTable({ cols, rows, onRowClick }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {cols.map((c) => (
              <th key={c.key || c} className="px-3 py-2 font-black text-slate-700 whitespace-nowrap">
                {c.label || c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows?.length ? (
            <tr>
              <td colSpan={cols.length} className="px-3 py-6 text-center text-slate-400 font-bold">
                No records
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row._id || row.id || i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-100 ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              >
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-slate-700 font-semibold whitespace-nowrap">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-white';

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-black text-slate-900 mt-1">{value}</p>
      {sub ? <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

export default function RiderHub({ onNavigateCustomer, onNavigateAdmin, onLogout }) {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem(TAB_KEY) || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  const [canWork, setCanWork] = useState(false);
  const [stats, setStats] = useState(null);
  const [available, setAvailable] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [historyDate, setHistoryDate] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpDeliveryId, setOtpDeliveryId] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [profileForm, setProfileForm] = useState(null);
  const [reqForm, setReqForm] = useState({
    type: 'general',
    message: '',
    sellerName: '',
    sellerPhone: '',
    shopName: '',
    shopAddress: '',
    shopInfo: ''
  });
  const [dutyBusy, setDutyBusy] = useState(false);
  const pollRef = useRef(null);

  const notify = useCallback((msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3200);
  }, []);

  const accountPending = profile?.status === 'pending';
  const ordersLocked = accountPending || !canWork;

  const activeRun = useMemo(
    () => deliveries.find((d) => ACTIVE_STATUSES.has(d.status)) || null,
    [deliveries]
  );

  const loadProfile = useCallback(async () => {
    const res = await getRiderProfile();
    const data = pickData(res);
    setProfile(data);
    setCanWork(!!res?.canWork);
    setProfileForm({ ...data });
    return data;
  }, []);

  const loadStats = useCallback(async () => {
    const res = await getRiderStats();
    setStats(pickData(res));
  }, []);

  const loadAvailable = useCallback(async () => {
    try {
      const res = await getAvailableDeliveries();
      setAvailable(pickList(res));
    } catch (e) {
      setAvailable([]);
      if (e?.status === 403 || e?.message?.includes('Not approved')) {
        notify('Orders unavailable until Admin approves your account.');
      }
    }
  }, [notify]);

  const loadDeliveries = useCallback(
    async (opts = {}) => {
      const params = {};
      if (opts.date || historyDate) params.date = opts.date || historyDate;
      if (opts.status) params.status = opts.status;
      const res = await getMyDeliveries(params);
      setDeliveries(pickList(res));
    },
    [historyDate]
  );

  const loadNotifications = useCallback(async () => {
    const res = await getRiderNotifications();
    setNotifications(pickList(res));
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await getRiderRequests();
    setRequests(pickList(res));
  }, []);

  const refresh = useCallback(async () => {
    if (!user || user.role !== 'driver') return;
    setBusy(true);
    try {
      await Promise.all([
        loadProfile(),
        loadStats(),
        loadAvailable(),
        loadDeliveries(),
        loadNotifications(),
        loadRequests()
      ]);
      notify('Data refreshed');
    } catch {
      notify('Some data could not be loaded — check connection.');
    } finally {
      setBusy(false);
    }
  }, [user, loadProfile, loadStats, loadAvailable, loadDeliveries, loadNotifications, loadRequests, notify]);

  useEffect(() => {
    if (authLoading || !user || user.role !== 'driver') return;
    setBusy(true);
    Promise.all([
      loadProfile(),
      loadStats(),
      loadAvailable(),
      loadDeliveries(),
      loadNotifications(),
      loadRequests()
    ])
      .catch(() => notify('Failed to load rider panel'))
      .finally(() => setBusy(false));
  }, [
    authLoading,
    user,
    loadProfile,
    loadStats,
    loadAvailable,
    loadDeliveries,
    loadNotifications,
    loadRequests,
    notify
  ]);

  useEffect(() => {
    if (!user || user.role !== 'driver') return undefined;
    if (pollRef.current) clearInterval(pollRef.current);
    if (profile?.isOnline && canWork && (tab === 'orders' || tab === 'active')) {
      pollRef.current = setInterval(() => {
        loadAvailable().catch(() => {});
        loadDeliveries().catch(() => {});
      }, 20000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [user, profile?.isOnline, canWork, tab, loadAvailable, loadDeliveries]);

  const toggleDuty = async () => {
    if (!canWork) {
      notify('Admin approval required before you can go on duty.');
      return;
    }
    const next = !profile?.isOnline;
    setDutyBusy(true);
    try {
      const res = await setRiderDutyApi({ isOnline: next });
      const data = pickData(res);
      setProfile(data);
      notify(next ? 'You are now on duty' : 'You are off duty');
      if (next) await loadAvailable();
    } catch (e) {
      notify(e?.message || 'Could not update duty status');
    } finally {
      setDutyBusy(false);
    }
  };

  const acceptOrder = async (id) => {
    if (ordersLocked) {
      notify(accountPending ? 'Account pending — cannot accept orders yet.' : 'Not approved for deliveries.');
      return;
    }
    if (!profile?.isOnline) {
      notify('Go on duty first to accept orders.');
      return;
    }
    try {
      await acceptDeliveryApi(id);
      notify('Delivery accepted');
      await loadDeliveries();
      await loadAvailable();
      setTab('active');
    } catch (e) {
      notify(e?.message || 'Accept failed');
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      notify('Rejection reason is required');
      return;
    }
    try {
      await rejectDeliveryApi(rejectTarget, rejectReason.trim());
      notify('Delivery rejected');
      setRejectTarget(null);
      setRejectReason('');
      await loadAvailable();
      await loadDeliveries();
    } catch (e) {
      notify(e?.message || 'Reject failed');
    }
  };

  const advanceStatus = async (delivery, nextStatus) => {
    try {
      if (nextStatus === 'picked_up') {
        await confirmPickupApi(delivery._id || delivery.id);
      } else {
        await patchDeliveryStatusApi(delivery._id || delivery.id, nextStatus);
      }
      notify(`Status: ${STATUS_LABELS[nextStatus] || nextStatus}`);
      await loadDeliveries();
      await loadStats();
    } catch (e) {
      notify(e?.message || 'Status update failed');
    }
  };

  const openOtpModal = (deliveryId) => {
    setOtpDeliveryId(deliveryId);
    setOtpValue('');
    setOtpOpen(true);
  };

  const submitOtp = async () => {
    const otp = otpValue.replace(/\D/g, '');
    if (![4, 6].includes(otp.length)) {
      notify('Enter a 4 or 6 digit OTP');
      return;
    }
    try {
      await verifyDeliveryOtpApi(otpDeliveryId, otp);
      notify('Delivery completed successfully');
      setOtpOpen(false);
      setOtpValue('');
      await loadDeliveries();
      await loadProfile();
      await loadStats();
      setTab('dashboard');
    } catch (e) {
      notify(e?.message || 'OTP verification failed');
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm) return;
    const payload = { ...profileForm };
    delete payload._id;
    delete payload.id;
    delete payload.role;
    delete payload.status;
    try {
      const res = await patchRiderProfile(payload);
      setProfile(pickData(res));
      notify('Profile updated');
    } catch (err) {
      notify(err?.message || 'Profile save failed');
    }
  };

  const onProfileFile = async (field, file) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setProfileForm((p) => ({ ...p, [field]: url }));
    } catch {
      notify('Could not read file');
    }
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!reqForm.message.trim()) {
      notify('Message is required');
      return;
    }
    if (reqForm.type === 'leave' || reqForm.type === 'holiday') {
      notify('Leave/holiday requests are not supported');
      return;
    }
    try {
      await createRiderRequest(reqForm);
      notify('Request submitted');
      setReqForm({
        type: 'general',
        message: '',
        sellerName: '',
        sellerPhone: '',
        shopName: '',
        shopAddress: '',
        shopInfo: ''
      });
      await loadRequests();
    } catch (e) {
      notify(e?.message || 'Request failed');
    }
  };

  const markRead = async (id) => {
    try {
      await markRiderNotificationRead(id);
      await loadNotifications();
    } catch {
      /* ignore */
    }
  };

  const nextStatusAction = (d) => {
    const s = d.status;
    if (s === 'accepted' || s === 'assigned') {
      return { label: 'Reached Pickup', status: 'reached_pickup' };
    }
    if (s === 'reached_pickup' || s === 'arrived_at_store') {
      return { label: 'Picked Up', status: 'picked_up' };
    }
    if (s === 'picked_up') {
      return { label: 'On the Way', status: 'on_the_way' };
    }
    if (s === 'on_the_way' || s === 'out_for_delivery') {
      return { label: 'Reached Customer', status: 'reached_customer' };
    }
    if (s === 'reached_customer') {
      return { label: 'Deliver — enter OTP', otp: true };
    }
    return null;
  };

  const renderAccessGate = () => (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-black text-slate-900">Japto Delivery Boy Panel</h1>
        <p className="text-xs font-semibold text-slate-600 mt-2">
          {!user
            ? 'Sign in as a delivery partner to access this panel.'
            : `Signed in as ${user.role}. This area is for delivery partners only.`}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Btn variant="primary" onClick={onNavigateCustomer}>
            Storefront
          </Btn>
          {onNavigateAdmin ? (
            <Btn onClick={onNavigateAdmin}>Admin</Btn>
          ) : null}
          {onLogout ? (
            <Btn onClick={onLogout}>Logout</Btn>
          ) : null}
        </div>
        {!user ? (
          <PartnerSignupHint notify={notify} sendRiderOtp={sendRiderOtp} registerDeliveryBoy={registerDeliveryBoy} />
        ) : null}
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-bold">
        Loading…
      </div>
    );
  }

  if (!user || user.role !== 'driver') {
    return renderAccessGate();
  }

  const historyRows = deliveries.filter((d) => HISTORY_DONE.has(d.status));

  const renderDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Today" value={stats?.todayDeliveries ?? 0} sub="Deliveries" />
        <StatCard label="Successful" value={stats?.totalSuccessful ?? 0} sub="All time" />
        <StatCard label="Pending" value={stats?.pending ?? 0} sub="In progress" />
        <StatCard label="Cancelled" value={stats?.cancelled ?? 0} sub="Rejected / cancelled" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Earnings today" value={money(stats?.todayEarnings ?? profile?.todayEarnings)} />
        <StatCard label="Earnings this month" value={money(stats?.monthEarnings ?? profile?.monthEarnings)} />
        <StatCard
          label="Account"
          value={profile?.status || '—'}
          sub={profile?.isOnline ? 'On duty' : 'Off duty'}
        />
      </div>
      {activeRun ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          Active run: {activeRun.orderNumber || activeRun._id} — {STATUS_LABELS[activeRun.status] || activeRun.status}
          <Btn className="ml-2" variant="primary" onClick={() => setTab('active')}>
            Open
          </Btn>
        </div>
      ) : null}
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-3">
      {ordersLocked ? (
        <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Order acceptance disabled until your account is approved.
        </p>
      ) : null}
      {!profile?.isOnline ? (
        <p className="text-xs font-semibold text-slate-500">Turn on duty in the header to receive and accept offers.</p>
      ) : null}
      <PanelTable
        cols={[
          { key: 'orderNumber', label: 'Order' },
          { key: 'storeName', label: 'Store' },
          { key: 'customerName', label: 'Customer' },
          { key: 'deliveryCharge', label: 'Fee', render: (r) => money(r.deliveryCharge) },
          { key: 'status', label: 'Status', render: (r) => STATUS_LABELS[r.status] || r.status },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Btn
                  variant="ok"
                  disabled={ordersLocked || !profile?.isOnline}
                  onClick={() => acceptOrder(r._id || r.id)}
                >
                  Accept
                </Btn>
                <Btn
                  variant="danger"
                  disabled={ordersLocked}
                  onClick={() => {
                    setRejectTarget(r._id || r.id);
                    setRejectReason('');
                  }}
                >
                  Reject
                </Btn>
              </div>
            )
          }
        ]}
        rows={available}
      />
    </div>
  );

  const renderActive = () => {
    if (!activeRun) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-xs font-bold">
          No active delivery. Accept an order from the Orders tab.
          <Btn className="mt-3" onClick={() => setTab('orders')}>
            View orders
          </Btn>
        </div>
      );
    }

    const action = nextStatusAction(activeRun);
    const storeNav = gmapsDir(activeRun.storeLat, activeRun.storeLng, activeRun.storeName);
    const custNav = gmapsDir(
      activeRun.customerLat || activeRun.deliveryLat,
      activeRun.customerLng || activeRun.deliveryLng,
      activeRun.deliveryAddress
    );

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2 items-start">
            <div>
              <p className="text-xs font-black text-slate-900">{activeRun.orderNumber}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                Status: {STATUS_LABELS[activeRun.status] || activeRun.status}
              </p>
              <p className="text-[10px] font-semibold text-slate-600 mt-1">
                Payment: {activeRun.paymentMode || '—'} · {money(activeRun.grandTotal)}
              </p>
            </div>
            {action ? (
              <Btn
                variant="primary"
                onClick={() => {
                  if (action.otp) openOtpModal(activeRun._id || activeRun.id);
                  else advanceStatus(activeRun, action.status);
                }}
              >
                {action.label}
              </Btn>
            ) : null}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] font-black text-slate-700 uppercase">Pickup — Store</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{activeRun.storeName || 'Store'}</p>
              <p className="text-[10px] text-slate-600">{activeRun.storeAddress}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {activeRun.storePhone ? (
                  <a href={`tel:${activeRun.storePhone}`} className="text-[11px] font-bold text-emerald-700">
                    Call store
                  </a>
                ) : null}
                {storeNav ? (
                  <a href={storeNav} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-slate-700">
                    Navigate
                  </a>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] font-black text-slate-700 uppercase">Drop — Customer</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{activeRun.customerName}</p>
              <p className="text-[10px] text-slate-600">{activeRun.deliveryAddress}</p>
              <p className="text-[10px] text-slate-500">{activeRun.pincode}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {activeRun.customerPhone ? (
                  <a href={`tel:${activeRun.customerPhone}`} className="text-[11px] font-bold text-emerald-700">
                    Call customer
                  </a>
                ) : null}
                {custNav ? (
                  <a href={custNav} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-slate-700">
                    Navigate
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {['reached_pickup', 'picked_up', 'on_the_way', 'reached_customer'].map((st) => (
              <Btn
                key={st}
                disabled={activeRun.status === st}
                onClick={() => advanceStatus(activeRun, st)}
              >
                {STATUS_LABELS[st]}
              </Btn>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-3">
      <motionControl
        historyDate={historyDate}
        onChange={(v) => setHistoryDate(v)}
        onApply={() => loadDeliveries({ date: historyDate })}
        onClear={() => {
          setHistoryDate('');
          loadDeliveries({ date: '' });
        }}
      />
      <PanelTable
        cols={[
          { key: 'orderNumber', label: 'Order' },
          { key: 'storeName', label: 'Store' },
          { key: 'customerName', label: 'Customer' },
          { key: 'status', label: 'Status', render: (r) => STATUS_LABELS[r.status] || r.status },
          { key: 'updatedAt', label: 'When', render: (r) => fmtDate(r.updatedAt || r.createdAt) },
          { key: 'deliveryCharge', label: 'Fee', render: (r) => money(r.deliveryCharge) }
        ]}
        rows={historyRows.length ? historyRows : deliveries}
      />
    </div>
  );

  const renderEarnings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Today" value={money(stats?.todayEarnings ?? profile?.todayEarnings)} />
        <StatCard label="This month" value={money(stats?.monthEarnings ?? profile?.monthEarnings)} />
        <StatCard label="Pending payout" value={money(stats?.pendingPayment ?? profile?.pendingPayout)} />
        <StatCard label="Paid out" value={money(stats?.paidPayment ?? profile?.paidPayout)} />
      </div>
      <h3 className="text-xs font-black text-slate-800">Payout history</h3>
      <PanelTable
        cols={[
          { key: 'at', label: 'Date', render: (r) => fmtDate(r.at || r.createdAt) },
          { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
          { key: 'note', label: 'Note', render: (r) => r.note || r.status || '—' }
        ]}
        rows={stats?.payoutHistory || profile?.payoutHistory || []}
      />
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-2">
      {notifications.map((n) => (
        <button
          key={n._id}
          type="button"
          onClick={() => markRead(n._id)}
          className={`w-full text-left rounded-xl border p-3 ${
            n.read ? 'border-slate-100 bg-slate-50 opacity-75' : 'border-slate-200 bg-white'
          }`}
        >
          <p className="text-xs font-black text-slate-900">{n.title}</p>
          <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{n.body}</p>
          <p className="text-[10px] text-slate-400 mt-1">{fmtDate(n.createdAt)}</p>
        </button>
      ))}
      {!notifications.length ? (
        <p className="text-xs font-bold text-slate-400 text-center py-8">No notifications</p>
      ) : null}
    </div>
  );

  const renderRequests = () => (
    <div className="grid lg:grid-cols-2 gap-4">
      <form onSubmit={submitRequest} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-xs font-black text-slate-900">New request</h3>
        <label className="block text-[10px] font-bold text-slate-600">
          Type
          <select
            className={`${inputCls} mt-1`}
            value={reqForm.type}
            onChange={(e) => setReqForm((f) => ({ ...f, type: e.target.value }))}
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-bold text-slate-600">
          Message
          <textarea
            className={`${inputCls} mt-1 min-h-[72px]`}
            value={reqForm.message}
            onChange={(e) => setReqForm((f) => ({ ...f, message: e.target.value }))}
            required
          />
        </label>
        {reqForm.type === 'seller_onboarding' ? (
          <motionSellerFields reqForm={reqForm} setReqForm={setReqForm} inputCls={inputCls} />
        ) : null}
        <Btn type="submit" variant="primary">
          Submit request
        </Btn>
      </form>
      <div>
        <h3 className="text-xs font-black text-slate-900 mb-2">Your requests</h3>
        <PanelTable
          cols={[
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'message', label: 'Message' },
            { key: 'createdAt', label: 'When', render: (r) => fmtDate(r.createdAt) }
          ]}
          rows={requests}
        />
      </div>
    </div>
  );

  const renderProfile = () => {
    if (!profileForm) return null;
    const docFields = [
      ['idProofUrl', 'ID proof URL'],
      ['rcDocUrl', 'RC document'],
      ['licenseDocUrl', 'License'],
      ['insuranceDocUrl', 'Insurance'],
      ['bikePhotoUrl', 'Bike photo'],
      ['bankProofUrl', 'Bank proof'],
      ['avatarUrl', 'Profile photo']
    ];
    return (
      <form onSubmit={saveProfile} className="max-w-2xl space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-500">Status</p>
          <p className="text-sm font-black text-slate-900">{profile?.status}</p>
          {profile?.statusReason ? (
            <p className="text-xs text-slate-600 mt-1">{profile.statusReason}</p>
          ) : null}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ['name', 'Name'],
            ['email', 'Email'],
            ['phone', 'Phone'],
            ['fullAddress', 'Address'],
            ['city', 'City'],
            ['aadhaarNo', 'Aadhaar'],
            ['vehicleType', 'Vehicle type'],
            ['vehicleModel', 'Vehicle model'],
            ['plateNumber', 'Plate number'],
            ['licenseNo', 'License number'],
            ['bankAccount', 'Bank account'],
            ['ifsc', 'IFSC']
          ].map(([key, label]) => (
            <label key={key} className="block text-[10px] font-bold text-slate-600">
              {label}
              <input
                className={`${inputCls} mt-1`}
                value={profileForm[key] || ''}
                disabled={key === 'phone'}
                onChange={(e) => setProfileForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-black text-slate-800">Documents</p>
          {docFields.map(([field, label]) => (
            <label key={field} className="block text-[10px] font-bold text-slate-600">
              {label}
              <input
                className={`${inputCls} mt-1`}
                value={profileForm[field] || ''}
                onChange={(e) => setProfileForm((p) => ({ ...p, [field]: e.target.value }))}
                placeholder="https://… or upload below"
              />
              <input
                type="file"
                accept="image/*,.pdf"
                className="mt-1 text-[10px]"
                onChange={(e) => onProfileFile(field, e.target.files?.[0])}
              />
            </label>
          ))}
        </div>
        <Btn type="submit" variant="primary">
          Save profile
        </Btn>
      </form>
    );
  };

  const renderMain = () => {
    if (busy && !profile) {
      return <p className="text-xs font-bold text-slate-500">Loading panel data…</p>;
    }
    switch (tab) {
      case 'dashboard':
        return renderDashboard();
      case 'orders':
        return renderOrders();
      case 'active':
        return renderActive();
      case 'history':
        return renderHistory();
      case 'earnings':
        return renderEarnings();
      case 'notifications':
        return renderNotifications();
      case 'requests':
        return renderRequests();
      case 'profile':
        return renderProfile();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <h1 className="font-black text-slate-900 text-sm">Japto Delivery</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1">{profile?.name || user.name}</p>
        </div>
        <nav className="p-2 flex-1 space-y-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition ${
                tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex justify-between items-center gap-2 flex-wrap">
          <h2 className="font-black text-slate-900 text-sm capitalize">
            {TABS.find((t) => t.id === tab)?.label}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Btn
              variant={profile?.isOnline ? 'ok' : 'default'}
              disabled={dutyBusy || !canWork}
              onClick={toggleDuty}
              title={!canWork ? 'Awaiting admin approval' : ''}
            >
              {profile?.isOnline ? 'On duty' : 'Off duty'}
            </Btn>
            {!canWork ? (
              <span className="text-[10px] font-bold text-amber-700 max-w-[140px]">
                Admin approval required to go on duty
              </span>
            ) : null}
            <Btn onClick={onNavigateCustomer}>Storefront</Btn>
            {onNavigateAdmin ? <Btn onClick={onNavigateAdmin}>Admin</Btn> : null}
            <Btn onClick={refresh}>Refresh</Btn>
            <Btn variant="primary" onClick={onLogout}>
              Logout
            </Btn>
          </div>
        </header>

        <main className="p-4 sm:p-6 flex-1">
          {accountPending ? (
            <div className="mb-4 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              Your account is pending Admin approval. You can update your profile, but order acceptance is
              disabled until approved.
            </div>
          ) : null}
          {flash ? (
            <div className="mb-4 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {flash}
            </div>
          ) : null}
          {renderMain()}
        </main>
      </div>

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-4 shadow-xl">
            <h3 className="text-sm font-black text-slate-900">Reject delivery</h3>
            <p className="text-[11px] text-slate-600 mt-1">Reason is required.</p>
            <textarea
              className={`${inputCls} mt-3 min-h-[80px]`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. too far, vehicle issue…"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <Btn onClick={() => setRejectTarget(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={submitReject}>
                Reject
              </Btn>
            </div>
          </div>
        </div>
      ) : null}

      {otpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-4 shadow-xl">
            <h3 className="text-sm font-black text-slate-900">Customer OTP</h3>
            <p className="text-[11px] text-slate-600 mt-1">Enter the 4 or 6 digit code from the customer.</p>
            <input
              className={`${inputCls} mt-3 text-center text-lg tracking-widest`}
              inputMode="numeric"
              maxLength={6}
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="····"
              autoFocus
            />
            <div className="flex gap-2 mt-3 justify-end">
              <Btn onClick={() => setOtpOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={submitOtp}>
                Verify &amp; deliver
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function motionControl({ historyDate, onChange, onApply, onClear }) {
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <label className="text-[10px] font-bold text-slate-600">
        Filter by date
        <input
          type="date"
          className={`${inputCls} mt-1 w-auto`}
          value={historyDate}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <Btn onClick={onApply}>Apply</Btn>
      <Btn onClick={onClear}>Clear</Btn>
    </div>
  );
}

function motionSellerFields({ reqForm, setReqForm, inputCls }) {
  return (
    <div className="space-y-2 border-t border-slate-100 pt-2">
      <p className="text-[10px] font-black text-slate-700">Seller onboarding details</p>
      {[
        ['sellerName', 'Seller name'],
        ['sellerPhone', 'Seller phone'],
        ['shopName', 'Shop name'],
        ['shopAddress', 'Shop address']
      ].map(([key, label]) => (
        <label key={key} className="block text-[10px] font-bold text-slate-600">
          {label}
          <input
            className={`${inputCls} mt-1`}
            value={reqForm[key]}
            onChange={(e) => setReqForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </label>
      ))}
      <label className="block text-[10px] font-bold text-slate-600">
        Additional shop info
        <textarea
          className={`${inputCls} mt-1 min-h-[60px]`}
          value={reqForm.shopInfo}
          onChange={(e) => setReqForm((f) => ({ ...f, shopInfo: e.target.value }))}
        />
      </label>
    </div>
  );
}

function PartnerSignupHint({ notify, sendRiderOtp, registerDeliveryBoy }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', otp: '', email: '' });
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = async () => {
    if (!form.phone.trim()) {
      notify('Phone required');
      return;
    }
    try {
      await sendRiderOtp({ phone: form.phone, purpose: 'register' });
      setOtpSent(true);
      notify('OTP sent (check demo OTP in dev)');
    } catch (e) {
      notify(e?.message || 'OTP send failed');
    }
  };

  const register = async (e) => {
    e.preventDefault();
    try {
      await registerDeliveryBoy(form);
      notify('Registration submitted — await Admin approval');
      setOpen(false);
    } catch (err) {
      notify(err?.message || 'Registration failed');
    }
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-bold text-slate-700 underline"
      >
        {open ? 'Hide' : 'Apply as delivery partner'}
      </button>
      {open ? (
        <form onSubmit={register} className="mt-3 space-y-2">
          <input
            className={inputCls}
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className={inputCls}
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            required
          />
          <input
            className={inputCls}
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="flex gap-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder="OTP"
              value={form.otp}
              onChange={(e) => setForm((f) => ({ ...f, otp: e.target.value }))}
              required
            />
            <Btn type="button" onClick={sendOtp}>
              {otpSent ? 'Resend OTP' : 'Send OTP'}
            </Btn>
          </div>
          <Btn type="submit" variant="primary" className="w-full">
            Register
          </Btn>
        </form>
      ) : null}
    </div>
  );
}