import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminCategoryMaster from '../components/AdminCategoryMaster';
import FormField from '../components/FormField';
import SearchableSelect from '../components/SearchableSelect';
import UnitPackFields from '../components/UnitPackFields';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import {
  ensureAudioUnlockedOnGesture,
  playNotificationChime,
  unlockAudio
} from '../utils/audio';
import {
  addFranchisePayment,
  createAdminBanner,
  createAdminCity,
  createAdminFranchise,
  createAdminCoupon,
  createProduct,
  deleteAdminBanner,
  deleteAdminCoupon,
  deleteProduct,
  downloadAdminReportCsv,
  getAdminBanners,
  getAdminCities,
  getAdminCommission,
  getAdminComplaints,
  getAdminCustomer,
  getAdminCustomers,
  getAdminDashboard,
  getAdminDeliveryCharges,
  getAdminDeliveryPartners,
  getAdminEmailQueue,
  getAdminEmailSettings,
  getAdminFranchises,
  getAdminAlerts,
  getAdminNotifications,
  getAdminOrders,
  getAdminPayments,
  getAdminProducts,
  getAdminReports,
  getAdminSeller,
  getAdminSellers,
  getAdminSettings,
  getAdminTax,
  getAdminCoupons,
  markAdminAlertRead,
  markAllAdminAlertsRead,
  patchAdminEmailSettings,
  processAdminEmailQueue,
  getCategoryTree,
  getPendingProducts,
  markCommissionPaid,
  patchAdminCommissionConfig,
  patchAdminCustomer,
  patchAdminDeliveryPartner,
  patchAdminFranchise,
  patchAdminOrder,
  patchAdminSeller,
  patchAdminSettings,
  patchAdminBanner,
  patchAdminCity,
  patchAdminCoupon,
  patchAdminTax,
  patchProductApproval,
  replyAdminComplaint,
  saveAdminDeliveryCharges,
  sendAdminNotification,
  updateProduct
} from '../services/api';

/** Grouped main menu → submenu pages (one job per page) */
const NAV_GROUPS = [
  {
    id: 'home',
    label: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard' }]
  },
  {
    id: 'users',
    label: 'Users',
    items: [
      { id: 'customers', label: 'Customers' },
      { id: 'sellers', label: 'Sellers' },
      { id: 'delivery', label: 'Delivery partners' }
    ]
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      { id: 'products', label: 'All products' },
      { id: 'products_pending', label: 'Pending approvals' },
      { id: 'products_create', label: 'Add product' },
      { id: 'categories_ops', label: 'Category Master' }
    ]
  },
  {
    id: 'commerce',
    label: 'Orders & finance',
    items: [
      { id: 'orders', label: 'Orders' },
      { id: 'payments', label: 'Payments' },
      { id: 'commission', label: 'Commission' },
      { id: 'reports', label: 'Reports' },
      { id: 'complaints', label: 'Complaints' }
    ]
  },
  {
    id: 'franchise',
    label: 'Franchise',
    items: [
      { id: 'franchises', label: 'All franchises', badge: 'franchiseApps' },
      { id: 'franchises_pins', label: 'PIN approvals', badge: 'pins' },
      { id: 'franchises_create', label: 'Add franchise' }
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { id: 'coupons', label: 'Coupons' },
      { id: 'banners', label: 'Banners' },
      { id: 'notifications', label: 'Notifications' }
    ]
  },
  {
    id: 'email',
    label: 'Email',
    items: [
      { id: 'email_smtp', label: 'SMTP setup' },
      { id: 'email_template_applicant', label: 'Applicant template' },
      { id: 'email_template_admin', label: 'Admin alert template' },
      { id: 'email_queue', label: 'Queue & send' }
    ]
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'settings', label: 'Site settings' },
      { id: 'cities', label: 'Cities' },
      { id: 'delivery_charges', label: 'Delivery charges' },
      { id: 'tax', label: 'Tax / GST' }
    ]
  }
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, groupId: g.id, groupLabel: g.label }))
);
const normalizeTabId = (id) => {
  if (id === 'email') return 'email_smtp';
  return id;
};
const findNavItem = (id) => ALL_NAV_ITEMS.find((i) => i.id === normalizeTabId(id));
const groupIdForTab = (tabId) => findNavItem(tabId)?.groupId || 'home';
const isEmailTab = (id) =>
  id === 'email' ||
  id === 'email_smtp' ||
  id === 'email_template_applicant' ||
  id === 'email_template_admin' ||
  id === 'email_queue';

const ORDER_STATUSES = [
  'placed',
  'accepted',
  'packing',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'cancelled',
  'rejected'
];

const REPORT_TYPES = ['sales', 'order', 'payment', 'commission', 'seller', 'city', 'franchise', 'delivery', 'gst'];

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pickData = (res) => res?.data ?? res;

function Btn({ children, onClick, variant = 'default', className = '', disabled, type = 'button' }) {
  const base =
    'px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none';
  const styles =
    variant === 'primary'
      ? 'bg-slate-900 text-white border-slate-900'
      : variant === 'danger'
        ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
        : variant === 'ok'
          ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function ConfirmModal({ open, title, message, onYes, onNo, confirmLabel = 'OK', cancelLabel = 'Cancel', danger }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40"
      onClick={onNo}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div>
          <h3 id="confirm-title" className="font-black text-slate-900 text-sm">
            {title || 'Are you sure?'}
          </h3>
          <p className="mt-1.5 text-xs font-semibold text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Btn type="button" onClick={onNo}>
            {cancelLabel}
          </Btn>
          <Btn type="button" variant={danger ? 'danger' : 'ok'} onClick={onYes}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/**
 * Clear Approve + Reject buttons with confirm popups.
 * - Approved → Approve disabled, Reject still active
 * - Rejected → Reject disabled, Approve active
 * - Status label shown beside buttons
 * Keeps optimistic local status so buttons update even if parent detail state is stale.
 */
function ApproveRejectControls({
  status,
  onApprove,
  onReject,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  entityName = 'this item',
  className = '',
  stopPropagation = false
}) {
  const [dialog, setDialog] = useState(null); // 'approve' | 'reject' | null
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const normalized = String(localStatus || status || 'pending').toLowerCase();
  const isApproved = normalized === 'approved';
  const isRejected = normalized === 'rejected';
  const statusText = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending';
  const statusCls = isApproved
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : isRejected
      ? 'bg-rose-100 text-rose-800 border-rose-200'
      : 'bg-amber-100 text-amber-900 border-amber-200';

  const close = () => {
    setDialog(null);
    setReason('');
  };

  const runApprove = async () => {
    setBusy(true);
    try {
      await onApprove?.();
      setLocalStatus('approved');
      close();
    } catch {
      /* parent notifies; keep dialog open */
    } finally {
      setBusy(false);
    }
  };

  const runReject = async () => {
    const note = reason.trim();
    if (!note) return;
    setBusy(true);
    try {
      await onReject?.(note);
      setLocalStatus('rejected');
      close();
    } catch {
      /* parent notifies; keep dialog open */
    } finally {
      setBusy(false);
    }
  };

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-2 ${className}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <Btn
        variant="ok"
        disabled={busy || isApproved}
        title={isApproved ? 'Already approved' : approveLabel}
        onClick={() => {
          if (busy || isApproved) return;
          setDialog('approve');
        }}
        className={isApproved ? 'grayscale' : ''}
      >
        {approveLabel}
      </Btn>
      <Btn
        variant="danger"
        disabled={busy || isRejected}
        title={isRejected ? 'Already rejected' : rejectLabel}
        onClick={() => {
          if (busy || isRejected) return;
          setReason('');
          setDialog('reject');
        }}
        className={isRejected ? 'grayscale' : ''}
      >
        {rejectLabel}
      </Btn>
      <span
        className={`text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md border ${statusCls}`}
      >
        {statusText}
      </span>

      {dialog === 'approve' ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/45"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div>
              <h3 className="font-black text-slate-900 text-sm">Confirm approval</h3>
              <p className="mt-1.5 text-xs font-semibold text-slate-600 leading-relaxed">
                Do you really want to approve {entityName}?
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Btn type="button" disabled={busy} onClick={close}>
                Cancel
              </Btn>
              <Btn type="button" variant="ok" disabled={busy} onClick={runApprove}>
                {busy ? 'Please wait…' : 'OK'}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}

      {dialog === 'reject' ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/45"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div>
              <h3 className="font-black text-slate-900 text-sm">Confirm rejection</h3>
              <p className="mt-1.5 text-xs font-semibold text-slate-600 leading-relaxed">
                Please write the reason for rejecting {entityName}.
              </p>
            </div>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 min-h-[88px] focus:outline-none focus:ring-2 focus:ring-rose-500"
              placeholder="Rejection reason *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Btn type="button" disabled={busy} onClick={close}>
                Cancel
              </Btn>
              <Btn
                type="button"
                variant="danger"
                disabled={busy || !reason.trim()}
                onClick={runReject}
              >
                {busy ? 'Please wait…' : 'OK'}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}

/** Admin Add Franchise — exact same fields as public Franchise registration; auto-approved */
function AdminCreateFranchiseForm({ notify, goTo, createAdminFranchise: createFn }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs font-semibold text-slate-600">
        Same form as public Franchise registration. Whatever Admin creates here is auto-approved.
      </p>
      <form
        className="grid sm:grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200 bg-white"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const pw = String(fd.get('password') || password || '');
          if (pw.length < 6) {
            notify('Password required (min 6 characters)');
            return;
          }
          setBusy(true);
          try {
            await createFn({
              ownerName: fd.get('ownerName'),
              phone: fd.get('phone'),
              email: fd.get('email'),
              password: pw,
              city: fd.get('city'),
              pincode: fd.get('pincode'),
              state: fd.get('state'),
              houseNo: fd.get('houseNo'),
              streetArea: fd.get('streetArea'),
              businessExperience: fd.get('businessExperience'),
              message: fd.get('message'),
              promoter1Name: fd.get('promoter1Name'),
              promoter1Phone: fd.get('promoter1Phone'),
              promoter2Name: fd.get('promoter2Name'),
              promoter2Phone: fd.get('promoter2Phone'),
              name: fd.get('ownerName') ? `${fd.get('ownerName')} Franchise` : undefined,
              status: 'approved'
            });
            notify('Franchise created (approved)');
            e.target.reset();
            setPassword('');
            goTo('franchises');
          } catch (err) {
            notify(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormField label="Applicant name *">
          <input name="ownerName" className={inputCls} required />
        </FormField>
        <FormField label="Mobile *">
          <input name="phone" className={inputCls} required autoComplete="tel" />
        </FormField>
        <FormField label="Email * (confirmation यहीं जाएगा)">
          <input name="email" type="email" className={inputCls} required autoComplete="email" />
        </FormField>
        <FormField label="Create password * (OTP या password से login)" className="sm:col-span-2">
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={`${inputCls} pr-14`}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-700 px-2"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <PasswordStrengthMeter password={password} />
        </FormField>
        <FormField label="City *">
          <input name="city" className={inputCls} required />
        </FormField>
        <FormField label="PIN code *">
          <input name="pincode" className={inputCls} required maxLength={6} />
        </FormField>
        <FormField label="Business experience *">
          <select name="businessExperience" className={inputCls} defaultValue="new" required>
            <option value="experienced">अनुभव है</option>
            <option value="new">नया व्यवसाय</option>
          </select>
        </FormField>
        <FormField label="House / building">
          <input name="houseNo" className={inputCls} />
        </FormField>
        <FormField label="Street / area">
          <input name="streetArea" className={inputCls} />
        </FormField>
        <FormField label="State">
          <input name="state" className={inputCls} defaultValue="UP" />
        </FormField>
        <FormField label="Message" className="sm:col-span-2">
          <textarea name="message" className={inputCls} rows={2} />
        </FormField>
        <FormField label="Promoter 1 name">
          <input name="promoter1Name" className={inputCls} />
        </FormField>
        <FormField label="Promoter 1 mobile">
          <input name="promoter1Phone" className={inputCls} />
        </FormField>
        <FormField label="Promoter 2 name">
          <input name="promoter2Name" className={inputCls} />
        </FormField>
        <FormField label="Promoter 2 mobile">
          <input name="promoter2Phone" className={inputCls} />
        </FormField>

        <div className="sm:col-span-2 flex gap-2">
          <Btn type="submit" variant="primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create franchise'}
          </Btn>
          <Btn type="button" onClick={() => goTo('franchises')}>
            Cancel
          </Btn>
        </div>
      </form>
    </div>
  );
}

/** Shared on/off switcher — use everywhere instead of Toggle / Activate text buttons */
function OnOffSwitch({ checked, onChange, disabled, title }) {
  const on = !!checked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title || (on ? 'On' : 'Off')}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange?.(!on);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40 ${
        on ? 'bg-emerald-500 border-emerald-600' : 'bg-slate-300 border-slate-400'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
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

export default function AdminPanel({ onNavigateCustomer, onLogout }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => {
    try {
      const saved = normalizeTabId(sessionStorage.getItem('japto_admin_tab') || 'dashboard');
      return findNavItem(saved) ? saved : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [openGroups, setOpenGroups] = useState(() => {
    const g = groupIdForTab(
      (() => {
        try {
          return normalizeTabId(sessionStorage.getItem('japto_admin_tab') || 'dashboard');
        } catch {
          return 'dashboard';
        }
      })()
    );
    return { [g]: true };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('japto_admin_tab', tab);
    } catch {
      /* ignore */
    }
    const g = groupIdForTab(tab);
    setOpenGroups((prev) => (prev[g] ? prev : { ...prev, [g]: true }));
  }, [tab]);

  const goTo = (id) => {
    setFranchiseDetail(null);
    setCustomerDetail(null);
    setSellerDetail(null);
    setRiderDetail(null);
    setOrderDetail(null);
    setTab(id);
  };

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const activeNav = findNavItem(tab);
  const [flash, setFlash] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState(null);

  const askConfirm = useCallback((message, title = 'Confirm delete') => {
    return new Promise((resolve) => {
      setConfirmState({ title, message, resolve });
    });
  }, []);

  const closeConfirm = (yes) => {
    confirmState?.resolve?.(!!yes);
    setConfirmState(null);
  };

  const [dashboard, setDashboard] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [sellerFilter, setSellerFilter] = useState('');
  const [sellerDetail, setSellerDetail] = useState(null);
  const [riders, setRiders] = useState([]);
  const [riderDetail, setRiderDetail] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [franchiseDetail, setFranchiseDetail] = useState(null);
  const [products, setProducts] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [productFilter, setProductFilter] = useState({
    q: '',
    approvalStatus: '',
    isActive: '',
    sellerId: ''
  });
  const [productSearchInput, setProductSearchInput] = useState('');
  const [productSearching, setProductSearching] = useState(false);
  const productSearchSeq = useRef(0);
  const productsSearchReady = useRef(false);
  const [orders, setOrders] = useState([]);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderFilter, setOrderFilter] = useState({ status: '', paymentMode: '' });
  const [payments, setPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState({ paymentMode: '', paymentStatus: '', refundStatus: '' });
  const [commission, setCommission] = useState(null);
  const [commissionPct, setCommissionPct] = useState('');
  const [franchiseCommissionPct, setFranchiseCommissionPct] = useState('');
  const [sellerRegistrationFee, setSellerRegistrationFee] = useState('');
  const [franchiseRegistrationFee, setFranchiseRegistrationFee] = useState('');
  const [franchiseFeeMin, setFranchiseFeeMin] = useState('');
  const [franchiseFeeMax, setFranchiseFeeMax] = useState('');
  const [reports, setReports] = useState({ type: 'sales', range: 'monthly', rows: [] });
  const [complaints, setComplaints] = useState([]);
  const [complaintFilter, setComplaintFilter] = useState({ source: '', status: '' });
  /** Admin review drawer for seller support requests (approve/reject + note) */
  const [supportReview, setSupportReview] = useState(null);
  const [settings, setSettings] = useState(null);
  const [emailSettings, setEmailSettings] = useState(null);
  const [emailQueueStats, setEmailQueueStats] = useState(null);
  const [emailQueueRows, setEmailQueueRows] = useState([]);
  const [emailForm, setEmailForm] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [banners, setBanners] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [cities, setCities] = useState([]);
  const [pendingPinCount, setPendingPinCount] = useState(0);
  const [adminBadges, setAdminBadges] = useState({
    unreadAlerts: 0,
    franchisePendingApps: 0,
    franchisePendingBank: 0,
    franchisePendingPins: 0,
    franchiseTotal: 0,
    pendingSellers: 0,
    pendingRiders: 0,
    pendingProducts: 0
  });
  const [inboxAlerts, setInboxAlerts] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const unreadAlertsRef = useRef(0);
  const inboxPrimedRef = useRef(false);
  const [deliveryRules, setDeliveryRules] = useState([]);
  const [taxInfo, setTaxInfo] = useState(null);
  const [categoryTree, setCategoryTree] = useState([]);
  const [prodCatId, setProdCatId] = useState('');
  const [prodSubId, setProdSubId] = useState('');
  const [prodPhoto, setProdPhoto] = useState('');

  const notify = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2800);
  };

  const loadAdminInbox = useCallback(async () => {
    try {
      const res = await getAdminAlerts();
      const rows = pickData(res) || [];
      const unread = Number(res?.unread ?? rows.filter((a) => !a.read).length);
      const badges = res?.badges || {};
      setInboxAlerts(rows);
      setAdminBadges((prev) => ({
        ...prev,
        ...badges,
        unreadAlerts: unread,
        franchisePendingPins: badges.franchisePendingPins ?? prev.franchisePendingPins
      }));
      if (badges.franchisePendingPins != null) {
        setPendingPinCount(Number(badges.franchisePendingPins) || 0);
      }
      if (inboxPrimedRef.current && unread > unreadAlertsRef.current) {
        playNotificationChime();
      }
      inboxPrimedRef.current = true;
      unreadAlertsRef.current = unread;
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    const cleanup = ensureAudioUnlockedOnGesture();
    loadAdminInbox();
    const t = setInterval(loadAdminInbox, 20000);
    return () => {
      cleanup();
      clearInterval(t);
    };
  }, [loadAdminInbox]);

  // getCategoryTree returns nested mains with `.subcategories`
  const mainCategories = useMemo(() => categoryTree || [], [categoryTree]);
  const subForMain = useMemo(() => {
    const main = mainCategories.find((c) => String(c._id) === String(prodCatId));
    return main?.subcategories || [];
  }, [mainCategories, prodCatId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'dashboard') {
        const [r, citiesRes] = await Promise.all([getAdminDashboard(), getAdminCities()]);
        setDashboard(pickData(r));
        const rows = pickData(citiesRes) || [];
        setCities(rows);
        setPendingPinCount(
          Number(
            citiesRes?.pendingFranchisePins ??
              rows.filter((c) => c.franchiseId && c.pinCodeStatus === 'pending').length
          )
        );
      } else if (tab === 'customers') {
        const r = await getAdminCustomers();
        setCustomers(pickData(r) || []);
        setCustomerDetail(null);
      } else if (tab === 'sellers') {
        const r = await getAdminSellers(sellerFilter ? { status: sellerFilter } : {});
        setSellers(pickData(r) || []);
        // Keep open seller detail in sync via loadSeller — do not wipe it here
      } else if (tab === 'delivery') {
        const r = await getAdminDeliveryPartners();
        const rows = pickData(r) || [];
        setRiders(rows);
        setRiderDetail((prev) => {
          if (!prev?._id) return null;
          return rows.find((x) => String(x._id) === String(prev._id)) || prev;
        });
      } else if (tab === 'franchises' || tab === 'franchises_pins' || tab === 'franchises_create') {
        const [r, citiesRes] = await Promise.all([getAdminFranchises(), getAdminCities()]);
        const rows = pickData(r) || [];
        setFranchises(rows);
        if (tab !== 'franchises') {
          setFranchiseDetail(null);
        } else {
          setFranchiseDetail((prev) => {
            if (!prev?._id) return prev;
            const next = rows.find((x) => String(x._id) === String(prev._id));
            return next || prev;
          });
        }
        setCities(pickData(citiesRes) || []);
        setPendingPinCount(
          Number(
            citiesRes?.pendingFranchisePins ??
              (pickData(citiesRes) || []).filter(
                (c) => c.franchiseId && c.pinCodeStatus === 'pending'
              ).length
          )
        );
      } else if (tab === 'products' || tab === 'products_pending' || tab === 'products_create') {
        const params = {};
        if (productFilter.q) params.q = productFilter.q;
        if (productFilter.approvalStatus) params.approvalStatus = productFilter.approvalStatus;
        if (productFilter.isActive) params.isActive = productFilter.isActive;
        if (productFilter.sellerId) params.sellerId = productFilter.sellerId;
        const [all, pending, tree, sellerRows] = await Promise.all([
          getAdminProducts(params),
          getPendingProducts(),
          getCategoryTree(true),
          getAdminSellers({})
        ]);
        setProducts(pickData(all) || []);
        setPendingProducts(pickData(pending) || []);
        setCategoryTree(pickData(tree) || []);
        setSellers(pickData(sellerRows) || []);
      } else if (tab === 'orders') {
        const r = await getAdminOrders(orderFilter);
        setOrders(pickData(r) || []);
        setOrderDetail(null);
      } else if (tab === 'payments') {
        const r = await getAdminPayments(paymentFilter);
        setPayments(pickData(r) || []);
      } else if (tab === 'commission') {
        const r = await getAdminCommission();
        const d = pickData(r);
        setCommission(d);
        setCommissionPct(String(d?.config?.sellerCommissionPct ?? ''));
        setFranchiseCommissionPct(String(d?.config?.franchiseDeliveryCommissionPct ?? ''));
        setSellerRegistrationFee(String(d?.config?.sellerRegistrationFee ?? 216));
        setFranchiseRegistrationFee(String(d?.config?.franchiseRegistrationFee ?? 500));
        setFranchiseFeeMin(String(d?.config?.franchiseFeeMin ?? 200000));
        setFranchiseFeeMax(String(d?.config?.franchiseFeeMax ?? 500000));
      } else if (tab === 'reports') {
        const r = await getAdminReports({ type: reports.type, range: reports.range });
        const d = pickData(r);
        setReports((prev) => ({ ...prev, rows: d?.rows || [] }));
      } else if (tab === 'complaints') {
        const r = await getAdminComplaints(complaintFilter);
        setComplaints(pickData(r) || []);
      } else if (tab === 'settings') {
        const r = await getAdminSettings();
        setSettings(pickData(r));
      } else if (isEmailTab(tab)) {
        const [cfg, q] = await Promise.all([getAdminEmailSettings(), getAdminEmailQueue()]);
        const d = pickData(cfg);
        setEmailSettings(d);
        setEmailQueueStats(cfg?.queue || null);
        setEmailForm({
          adminEmail: d?.adminEmail || '',
          smtpHost: d?.smtpHost || 'smtp.gmail.com',
          smtpPort: d?.smtpPort ?? 587,
          smtpUser: d?.smtpUser || '',
          smtpPass: '',
          smtpFrom: d?.smtpFrom || '',
          smtpSecure: !!d?.smtpSecure,
          applicantSubject: d?.templates?.franchiseApplicant?.subject || '',
          applicantHtml: d?.templates?.franchiseApplicant?.html || '',
          adminSubject: d?.templates?.franchiseAdmin?.subject || '',
          adminHtml: d?.templates?.franchiseAdmin?.html || ''
        });
        setEmailQueueRows(pickData(q) || []);
      } else if (tab === 'coupons') {
        const r = await getAdminCoupons();
        setCoupons(pickData(r) || []);
      } else if (tab === 'banners') {
        const r = await getAdminBanners();
        setBanners(pickData(r) || []);
      } else if (tab === 'notifications') {
        const r = await getAdminNotifications();
        setNotifications(pickData(r) || []);
      } else if (tab === 'cities') {
        const citiesRes = await getAdminCities();
        const rows = pickData(citiesRes) || [];
        setCities(rows);
        setPendingPinCount(
          Number(
            citiesRes?.pendingFranchisePins ??
              rows.filter((c) => c.franchiseId && c.pinCodeStatus === 'pending').length
          )
        );
      } else if (tab === 'delivery_charges') {
        const r = await getAdminDeliveryCharges();
        setDeliveryRules(pickData(r) || []);
      } else if (tab === 'tax') {
        const r = await getAdminTax();
        setTaxInfo(pickData(r));
      } else if (tab === 'categories_ops') {
        const r = await getCategoryTree(true);
        setCategoryTree(pickData(r) || []);
      }
    } catch (err) {
      notify(err.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    sellerFilter,
    orderFilter,
    paymentFilter,
    complaintFilter,
    reports.type,
    reports.range
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** AJAX product search — debounced; does not remount whole Admin tab */
  const fetchProductsAjax = useCallback(async (filters = {}) => {
    const seq = ++productSearchSeq.current;
    setProductSearching(true);
    try {
      const params = {};
      const q = String(filters.q ?? '').trim();
      if (q.length >= 2) params.q = q;
      if (filters.approvalStatus) params.approvalStatus = filters.approvalStatus;
      if (filters.isActive) params.isActive = filters.isActive;
      if (filters.sellerId) params.sellerId = filters.sellerId;
      const r = await getAdminProducts(params);
      if (seq !== productSearchSeq.current) return;
      setProducts(pickData(r) || []);
    } catch (err) {
      if (seq !== productSearchSeq.current) return;
      notify(err.message || 'Search failed');
    } finally {
      if (seq === productSearchSeq.current) setProductSearching(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'products') {
      productsSearchReady.current = false;
      return undefined;
    }
    // First paint on this tab: list already loaded by refresh()
    if (!productsSearchReady.current) {
      productsSearchReady.current = true;
      return undefined;
    }
    const handle = setTimeout(() => {
      const q = productSearchInput.trim();
      setProductFilter((prev) => (prev.q === q ? prev : { ...prev, q }));
      fetchProductsAjax({
        q,
        approvalStatus: productFilter.approvalStatus,
        isActive: productFilter.isActive,
        sellerId: productFilter.sellerId
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [
    productSearchInput,
    tab,
    fetchProductsAjax,
    productFilter.approvalStatus,
    productFilter.isActive,
    productFilter.sellerId
  ]);

  const loadCustomer = async (id) => {
    try {
      const r = await getAdminCustomer(id);
      setCustomerDetail(pickData(r));
    } catch (err) {
      notify(err.message);
    }
  };

  const loadSeller = async (id) => {
    try {
      const r = await getAdminSeller(id);
      setSellerDetail(pickData(r));
    } catch (err) {
      notify(err.message);
    }
  };

  const pendingFranchisePinRows = cities.filter(
    (c) => c.franchiseId && c.pinCodeStatus === 'pending'
  );

  const decideFranchisePin = async (row, pinCodeStatus, reason = '') => {
    try {
      await patchAdminCity(row._id, {
        pinCodeStatus,
        isActive: pinCodeStatus === 'approved',
        ...(reason ? { decisionNote: reason } : {})
      });
      notify(
        pinCodeStatus === 'approved'
          ? `PIN ${row.pincode} approved`
          : `PIN ${row.pincode} rejected${reason ? `: ${reason}` : ''}`
      );
      refresh();
    } catch (err) {
      notify(err.message);
    }
  };

  const PendingFranchisePinsBox = () => (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-black text-sm text-amber-950">Franchise PIN approval</h3>
          <p className="text-[11px] font-semibold text-amber-800">
            Franchise panel से आने वाली PIN requests — सिर्फ यहीं Approve / Reject
          </p>
        </div>
        <span className="text-[11px] font-black px-2 py-1 rounded-full bg-amber-200 text-amber-950">
          {pendingFranchisePinRows.length} pending
        </span>
      </div>
      {pendingFranchisePinRows.length === 0 ? (
        <p className="text-xs font-semibold text-amber-800/80">No pending PIN requests right now.</p>
      ) : (
        <PanelTable
          cols={[
            {
              key: 'franchise',
              label: 'Franchise',
              render: (r) =>
                r.franchiseId?.name ||
                r.franchiseId?.ownerName ||
                r.franchiseId?.applicationId ||
                String(r.franchiseId?._id || r.franchiseId || '—')
            },
            { key: 'phone', label: 'Phone', render: (r) => r.franchiseId?.phone || '—' },
            { key: 'city', label: 'City' },
            { key: 'pincode', label: 'PIN' },
            { key: 'area', label: 'Area', render: (r) => r.area || '—' },
            {
              key: 'createdAt',
              label: 'Requested',
              render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—')
            },
            {
              key: 'actions',
              label: 'Decision',
              render: (r) => (
                <ApproveRejectControls
                  status="pending"
                  entityName={`PIN ${r.pincode}`}
                  stopPropagation
                  onApprove={async () => decideFranchisePin(r, 'approved')}
                  onReject={async (reason) => decideFranchisePin(r, 'rejected', reason)}
                />
              )
            }
          ]}
          rows={pendingFranchisePinRows}
        />
      )}
    </div>
  );

  const kpis = dashboard
    ? [
        ['Customers', dashboard.customers],
        ['Sellers', dashboard.sellers],
        ['Delivery partners', dashboard.deliveryPartners],
        ['Franchises', dashboard.franchises],
        ['Products', dashboard.products],
        ['Orders', dashboard.orders],
        ['Pending orders', dashboard.pendingOrders],
        ['Completed', dashboard.completedOrders],
        ['Cancelled', dashboard.cancelledOrders],
        ['Total sales', money(dashboard.totalSales)],
        ['Commission', money(dashboard.totalCommission)]
      ]
    : [];

  const renderMain = () => {
    if (loading) {
      return <p className="text-sm font-bold text-slate-500 py-12 text-center">Loading…</p>;
    }

    if (tab === 'dashboard') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {kpis.map(([label, val]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
              <p className="text-lg font-black text-slate-900 mt-1">{val}</p>
            </div>
          ))}
        </div>
      );
    }

    if (tab === 'customers') {
      if (customerDetail) {
        const { customer, orders: custOrders, complaints: custComplaints } = customerDetail;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Btn onClick={() => setCustomerDetail(null)}>← Back</Btn>
              <h2 className="font-black text-slate-900">{customer?.name}</h2>
              <OnOffSwitch
                checked={customer.isActive !== false}
                title={customer.isActive === false ? 'Activate customer' : 'Suspend customer'}
                onChange={(next) =>
                  patchAdminCustomer(customer._id, { isActive: next }).then(() => {
                    notify(next ? 'Activated' : 'Suspended');
                    loadCustomer(customer._id);
                  })
                }
              />
            </div>
            <PanelTable
              cols={[
                { key: 'orderNumber', label: 'Order #' },
                { key: 'status', label: 'Status' },
                { key: 'grandTotal', label: 'Total', render: (r) => money(r.grandTotal) },
                { key: 'createdAt', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() }
              ]}
              rows={custOrders}
            />
            <PanelTable
              cols={[
                { key: 'subject', label: 'Complaint' },
                { key: 'status', label: 'Status' },
                { key: 'message', label: 'Message' }
              ]}
              rows={custComplaints}
            />
          </div>
        );
      }
      return (
        <PanelTable
          cols={[
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'fullAddress', label: 'Address' },
            { key: 'totalOrders', label: 'Orders' },
            { key: 'status', label: 'Status' },
            { key: 'complaintCount', label: 'Complaints' },
            {
              key: 'active',
              label: 'Active',
              render: (r) => (
                <OnOffSwitch
                  checked={r.isActive !== false}
                  title={r.isActive === false ? 'Activate' : 'Suspend'}
                  onChange={(next) => patchAdminCustomer(r._id, { isActive: next }).then(refresh)}
                />
              )
            }
          ]}
          rows={customers}
          onRowClick={(r) => loadCustomer(r._id)}
        />
      );
    }

    if (tab === 'sellers') {
      if (sellerDetail) {
        const { store, products: sProds, orders: sOrders, complaints: sComplaints } = sellerDetail;
        const coords = Array.isArray(store?.location?.coordinates) ? store.location.coordinates : [];
        const kycDocs = [
          ['PAN', store?.panNumber, store?.panDocUrl],
          ['GST', store?.gstNumber || store?.gstin, store?.gstDocUrl],
          ['Enrollment', store?.enrollmentNumber, store?.enrollmentDocUrl],
          ['Bank proof', store?.bankAccount, store?.bankProofUrl],
          ['FSSAI', store?.fssai, store?.fssaiDocUrl]
        ];
        const detailRow = (label, value) => (
          <div key={label} className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-xs font-semibold text-slate-800 break-words mt-0.5">{value || '—'}</p>
          </div>
        );
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={() => setSellerDetail(null)}>← Back to sellers</Btn>
              <h2 className="font-black text-slate-900">{store?.name}</h2>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  store?.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : store?.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {store?.status || '—'}
              </span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  store?.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {store?.isOnline ? 'Online' : 'Offline'}
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                Active: {store?.isActive ? 'Yes' : 'No'}
              </span>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-black text-slate-900">Store & contact</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {detailRow('Store name', store?.name)}
                {detailRow('Category', store?.category)}
                {detailRow('Owner name', store?.ownerName || store?.ownerId?.name)}
                {detailRow('Store phone', store?.phone)}
                {detailRow('Owner phone', store?.ownerId?.phone)}
                {detailRow('Email', store?.ownerId?.email || store?.email)}
                {detailRow('Opening hours', store?.openingTime)}
                {detailRow(
                  'Registration fee',
                  store?.registrationFeePaid
                    ? `Paid ₹${store?.registrationFeeAmount ?? '—'}${
                        store?.registrationFeeTxnId
                          ? ` · ${store.registrationFeeTxnId}`
                          : ''
                      }`
                    : 'Not paid'
                )}
                {detailRow('Phone verified', store?.phoneVerified ? 'Yes' : 'No')}
                {detailRow(
                  'Promoter 1',
                  store?.promoters?.[0]
                    ? `${store.promoters[0].name || '—'} · ${store.promoters[0].phone || '—'}`
                    : '—'
                )}
                {detailRow(
                  'Promoter 2',
                  store?.promoters?.[1]
                    ? `${store.promoters[1].name || '—'} · ${store.promoters[1].phone || '—'}`
                    : '—'
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-black text-slate-900">Address</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {detailRow('Full address', store?.address || store?.fullAddress)}
                {detailRow('City', store?.city)}
                {detailRow('Pincode', store?.pincode)}
                {detailRow('Latitude', coords[1] ?? store?.lat)}
                {detailRow('Longitude', coords[0] ?? store?.lng)}
                {detailRow('Decision note', store?.decisionNote)}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-black text-slate-900">KYC & bank</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {detailRow('PAN number', store?.panNumber)}
                {detailRow('GST / GSTIN', store?.gstNumber || store?.gstin)}
                {detailRow('Enrollment no.', store?.enrollmentNumber)}
                {detailRow('Bank account', store?.bankAccount)}
                {detailRow('IFSC', store?.ifsc)}
                {detailRow('FSSAI', store?.fssai)}
                {detailRow('Deals in food', store?.dealsInFood ? 'Yes' : 'No')}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {kycDocs.map(([label, , url]) =>
                  url ? (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-800 hover:bg-slate-100"
                    >
                      View {label}
                    </a>
                  ) : (
                    <span
                      key={label}
                      className="px-2.5 py-1 rounded-lg border border-dashed border-slate-200 text-[11px] font-bold text-slate-400"
                    >
                      {label}: missing
                    </span>
                  )
                )}
              </div>
            </section>

            <form
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 max-w-xl"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                try {
                  await patchAdminSeller(store._id, {
                    address: fd.get('address'),
                    pincode: fd.get('pincode'),
                    city: fd.get('city'),
                    lat: fd.get('lat'),
                    lng: fd.get('lng')
                  });
                  notify('Seller store address updated by Admin');
                  loadSeller(store._id);
                } catch (err) {
                  notify(err.message);
                }
              }}
            >
              <p className="text-xs font-black text-slate-800">Edit store address</p>
              <p className="text-[10px] font-semibold text-slate-500">
                Direct Admin update. Seller address Support Requests under Complaints also apply on
                Approve.
              </p>
              <FormField label="Address">
                <input
                  name="address"
                  className={inputCls}
                  defaultValue={store?.address || store?.fullAddress || ''}
                  required
                />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Pincode">
                  <input
                    name="pincode"
                    className={inputCls}
                    defaultValue={store?.pincode || ''}
                    required
                    maxLength={6}
                  />
                </FormField>
                <FormField label="City">
                  <input name="city" className={inputCls} defaultValue={store?.city || ''} required />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Latitude (optional)">
                  <input name="lat" className={inputCls} defaultValue={coords[1] ?? ''} />
                </FormField>
                <FormField label="Longitude (optional)">
                  <input name="lng" className={inputCls} defaultValue={coords[0] ?? ''} />
                </FormField>
              </div>
              <Btn type="submit" variant="primary">
                Save address
              </Btn>
            </form>

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="text-sm font-black text-slate-900">Actions</h3>
              <div className="flex flex-wrap items-center gap-2">
                <ApproveRejectControls
                  status={store?.status}
                  entityName={`seller “${store?.name || 'store'}”`}
                  onApprove={async () => {
                    await patchAdminSeller(store._id, {
                      status: 'approved',
                      decisionNote: 'Approved by admin'
                    });
                    notify('Seller approved');
                    loadSeller(store._id);
                  }}
                  onReject={async (decisionNote) => {
                    await patchAdminSeller(store._id, { status: 'rejected', decisionNote });
                    notify('Seller rejected');
                    loadSeller(store._id);
                  }}
                />
                <OnOffSwitch
                  checked={!!store?.isActive}
                  title={store?.isActive ? 'Deactivate store' : 'Activate store'}
                  onChange={(next) =>
                    patchAdminSeller(store._id, { isActive: next }).then(() => {
                      notify(next ? 'Store activated' : 'Store deactivated');
                      loadSeller(store._id);
                    })
                  }
                />
                <span className="text-[11px] font-bold text-slate-500">
                  {store?.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </section>

            <h3 className="font-black text-sm">Products ({sProds?.length || 0})</h3>
            <PanelTable
              cols={[
                { key: 'name', label: 'Product' },
                { key: 'approvalStatus', label: 'Approval' },
                {
                  key: 'isActive',
                  label: 'Active',
                  render: (r) => (
                    <OnOffSwitch
                      checked={!!r.isActive}
                      onChange={(next) =>
                        updateProduct(r._id, { isActive: next }).then(() => loadSeller(store._id))
                      }
                    />
                  )
                }
              ]}
              rows={sProds}
            />
            <h3 className="font-black text-sm">Orders ({sOrders?.length || 0})</h3>
            <PanelTable
              cols={[
                { key: 'orderNumber', label: 'Order' },
                { key: 'status', label: 'Status' },
                { key: 'grandTotal', label: 'Total', render: (r) => money(r.grandTotal) }
              ]}
              rows={sOrders}
            />
            <h3 className="font-black text-sm">Complaints ({sComplaints?.length || 0})</h3>
            <PanelTable
              cols={[
                { key: 'subject', label: 'Subject' },
                { key: 'status', label: 'Status' },
                { key: 'message', label: 'Message' }
              ]}
              rows={sComplaints || []}
            />
          </div>
        );
      }
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black text-slate-900 text-sm">All sellers</h2>
            <select
              className={inputCls + ' max-w-xs'}
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <PanelTable
            cols={[
              {
                key: 'name',
                label: 'Store',
                render: (r) => (
                  <span className="font-black text-slate-900">{r.name || '—'}</span>
                )
              },
              {
                key: 'phone',
                label: 'Store phone',
                render: (r) => r.phone || r.ownerId?.phone || '—'
              },
              {
                key: 'address',
                label: 'Address',
                render: (r) => {
                  const line = [r.address || r.fullAddress, r.city, r.pincode]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <span className="max-w-[220px] truncate block" title={line || ''}>
                      {line || '—'}
                    </span>
                  );
                }
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      r.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {r.status || '—'}
                  </span>
                )
              },
              {
                key: 'docs',
                label: 'KYC',
                render: (r) => {
                  const docs = [
                    ['PAN', r.panDocUrl],
                    ['GST', r.gstDocUrl],
                    ['Bank', r.bankProofUrl],
                    ['FSSAI', r.fssaiDocUrl]
                  ].filter(([, u]) => u);
                  if (!docs.length) {
                    return <span className="text-rose-600 font-bold">Missing</span>;
                  }
                  return (
                    <span className="flex flex-wrap gap-1">
                      {docs.map(([label, url]) => (
                        <a
                          key={label}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-slate-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {label}
                        </a>
                      ))}
                    </span>
                  );
                }
              },
              {
                key: 'actions',
                label: 'Edit',
                render: (r) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    <Btn variant="primary" onClick={() => loadSeller(r._id)}>
                      Edit
                    </Btn>
                  </span>
                )
              }
            ]}
            rows={sellers}
          />
        </div>
      );
    }

    if (tab === 'delivery') {
      if (riderDetail) {
        const d = riderDetail;
        const docs = d.docs || {};
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Btn onClick={() => setRiderDetail(null)}>← Back</Btn>
              <h2 className="font-black text-slate-900">{d.name}</h2>
              <span className="text-xs font-bold text-slate-500">{d.status}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-xs font-semibold text-slate-700">
              <p>Phone: {d.phone}</p>
              <p>Email: {d.email || '—'}</p>
              <p className="sm:col-span-2">Address: {d.fullAddress || d.city || '—'}</p>
              <p>Vehicle: {d.vehicleType || '—'} {d.vehicleModel || ''}</p>
              <p>Plate: {d.plateNumber || '—'}</p>
              <p>License: {d.licenseNo || '—'}</p>
              <p>Aadhaar: {docs.aadhaarNo || d.aadhaarNo || '—'}</p>
              <p>Successful: {d.successfulDeliveries}</p>
              <p>Failed: {d.failedDeliveries}</p>
              <p>COD orders: {d.codOrders}</p>
              <p>Complaints: {d.complaintCount || 0}</p>
              <p className="sm:col-span-2">Status reason: {d.statusReason || '—'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries({
                idProofUrl: 'ID proof',
                rcDocUrl: 'RC',
                licenseDocUrl: 'Licence',
                insuranceDocUrl: 'Insurance',
                bikePhotoUrl: 'Bike photo',
                bankProofUrl: 'Bank proof'
              }).map(([k, label]) =>
                docs[k] || d[k] ? (
                  <a
                    key={k}
                    href={docs[k] || d[k]}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded-lg border text-[10px] font-bold text-emerald-700 bg-white"
                  >
                    {label}
                  </a>
                ) : (
                  <span key={k} className="px-2 py-1 rounded-lg border text-[10px] font-bold text-slate-400">
                    {label}: —
                  </span>
                )
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <ApproveRejectControls
                status={d.status}
                entityName={`delivery partner “${d.name || d.phone || 'rider'}”`}
                onApprove={async () => {
                  const res = await patchAdminDeliveryPartner(d._id, {
                    status: 'approved',
                    statusReason: 'Approved by admin'
                  });
                  setRiderDetail(pickData(res) || { ...d, status: 'approved' });
                  notify('Rider approved');
                  refresh();
                }}
                onReject={async (statusReason) => {
                  const res = await patchAdminDeliveryPartner(d._id, {
                    status: 'rejected',
                    statusReason
                  });
                  setRiderDetail(pickData(res) || { ...d, status: 'rejected' });
                  notify('Rider rejected');
                  refresh();
                }}
              />
              <div className="flex items-center gap-2 px-2">
                <span className="text-[10px] font-black text-slate-500 uppercase">Active</span>
                <OnOffSwitch
                  checked={d.isActive !== false && d.status !== 'inactive'}
                  title={d.isActive === false || d.status === 'inactive' ? 'Reactivate' : 'Set inactive'}
                  onChange={(next) => {
                    if (!next) {
                      const reason = prompt('Inactive reason') || 'Deactivated by admin';
                      return patchAdminDeliveryPartner(d._id, {
                        status: 'inactive',
                        isActive: false,
                        statusReason: reason
                      }).then(refresh);
                    }
                    return patchAdminDeliveryPartner(d._id, {
                      status: 'approved',
                      isActive: true,
                      statusReason: 'Reactivated'
                    }).then(refresh);
                  }}
                />
              </div>
            </div>
          </div>
        );
      }
      return (
        <PanelTable
          cols={[
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'fullAddress', label: 'Address', render: (r) => r.fullAddress || r.city || '—' },
            { key: 'status', label: 'Status' },
            { key: 'successfulDeliveries', label: 'OK' },
            { key: 'failedDeliveries', label: 'Failed' },
            { key: 'codOrders', label: 'COD' },
            { key: 'complaintCount', label: 'Complaints' },
            {
              key: 'actions',
              label: 'Actions',
              render: (r) => (
                <span className="flex gap-1 flex-wrap items-center" onClick={(e) => e.stopPropagation()}>
                  <Btn onClick={() => setRiderDetail(r)}>Details / docs</Btn>
                  <ApproveRejectControls
                    status={r.status}
                    entityName={`delivery partner “${r.name || r.phone || 'rider'}”`}
                    stopPropagation
                    onApprove={async () => {
                      await patchAdminDeliveryPartner(r._id, {
                        status: 'approved',
                        statusReason: 'Approved by admin'
                      });
                      notify('Rider approved');
                      refresh();
                    }}
                    onReject={async (statusReason) => {
                      await patchAdminDeliveryPartner(r._id, {
                        status: 'rejected',
                        statusReason
                      });
                      notify('Rider rejected');
                      refresh();
                    }}
                  />
                  <OnOffSwitch
                    checked={r.isActive !== false}
                    title={r.isActive === false ? 'Activate rider' : 'Deactivate rider'}
                    onChange={(next) =>
                      patchAdminDeliveryPartner(r._id, {
                        isActive: next,
                        status: next ? 'approved' : 'inactive'
                      }).then(refresh)
                    }
                  />
                </span>
              )
            }
          ]}
          rows={riders}
          onRowClick={(r) => setRiderDetail(r)}
        />
      );
    }

    if (tab === 'franchises_pins') {
      return (
        <div className="space-y-4 max-w-5xl">
          <PendingFranchisePinsBox />
        </div>
      );
    }

    if (tab === 'franchises_create') {
      return (
        <AdminCreateFranchiseForm
          notify={notify}
          goTo={goTo}
          createAdminFranchise={createAdminFranchise}
        />
      );
    }

    if (tab === 'franchises') {
      if (franchiseDetail) {
        const f = franchiseDetail;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Btn onClick={() => setFranchiseDetail(null)}>← Back</Btn>
              <h2 className="font-black text-slate-900">{f.name}</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
              <p>Application ID: {f.applicationId || '—'}</p>
              <p>Applied: {f.createdAt ? new Date(f.createdAt).toLocaleString() : '—'}</p>
              <p>Owner: {f.ownerName || '—'}</p>
              <p>Phone: {f.phone}</p>
              <p>Email: {f.email || '—'}</p>
              <p>City: {f.city}</p>
              <p className="sm:col-span-2">Address: {f.address || '—'}</p>
              <p>Experience: {f.businessExperience || '—'}</p>
              <p>Message: {f.message || '—'}</p>
              <p className="sm:col-span-2">
                Promoters:{' '}
                {(f.promoters || [])
                  .map((p) => `${p.name || '—'} (${p.phone || '—'})`)
                  .join(' · ') || '—'}
              </p>
              <p className="flex items-center gap-2">
                Status: {f.status} · Active:{' '}
                <OnOffSwitch
                  checked={!!f.isActive}
                  onChange={(next) =>
                    patchAdminFranchise(f._id, { isActive: next }).then(() => {
                      notify(next ? 'Franchise activated' : 'Franchise deactivated');
                      refresh();
                    })
                  }
                />
              </p>
              <p>Fee: {money(f.franchiseFee)} · GST: {money(f.gstAmount)}</p>
              <p>Delivery commission: {f.deliveryCommissionPct ?? 0}%</p>
              <p>
                Bank: {f.bankAccountHolder || '—'} / {f.bankAccountNumber || '—'} / {f.bankIfsc || '—'}
              </p>
              <p>
                Bank change: {f.pendingBankChange?.status || 'none'}
                {f.pendingBankChange?.status === 'pending'
                  ? ` → ${f.pendingBankChange.accountHolder} ${f.pendingBankChange.accountNumber}`
                  : ''}
              </p>
              <p className="sm:col-span-2">PINs: {(f.pinCodes || []).join(', ') || '—'}</p>
              <p className="sm:col-span-2">
                Agreement:{' '}
                {f.agreementUrl ? (
                  <a href={f.agreementUrl} target="_blank" rel="noreferrer" className="text-emerald-700 font-black">
                    Open
                  </a>
                ) : (
                  '—'
                )}
              </p>
            </div>
            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="text-sm font-black text-slate-900">1. Application decision</h3>
              <p className="text-[11px] font-semibold text-slate-500">
                Franchise registration approve / reject
              </p>
              <ApproveRejectControls
                status={f.status}
                approveLabel="Approve application"
                rejectLabel="Reject application"
                entityName={`franchise “${f.name || f.ownerName || f.applicationId || 'application'}”`}
                onApprove={async () => {
                  const res = await patchAdminFranchise(f._id, { status: 'approved' });
                  const updated = pickData(res) || { ...f, status: 'approved', isActive: true };
                  setFranchiseDetail(updated);
                  notify('Franchise approved');
                  refresh();
                  loadAdminInbox();
                }}
                onReject={async (decisionNote) => {
                  const res = await patchAdminFranchise(f._id, {
                    status: 'rejected',
                    decisionNote
                  });
                  const updated = pickData(res) || { ...f, status: 'rejected', isActive: false };
                  setFranchiseDetail(updated);
                  notify('Franchise rejected');
                  refresh();
                  loadAdminInbox();
                }}
              />
            </section>

            <section
              className={`rounded-xl border p-4 space-y-2 ${
                f.pendingBankChange?.status === 'pending'
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <h3 className="text-sm font-black text-slate-900">2. Bank change decision</h3>
              {f.pendingBankChange?.status === 'pending' ? (
                <>
                  <p className="text-[11px] font-semibold text-amber-900">
                    Pending request → {f.pendingBankChange.accountHolder || '—'} ·{' '}
                    {f.pendingBankChange.accountNumber || '—'} · {f.pendingBankChange.ifsc || '—'}
                  </p>
                  <ApproveRejectControls
                    status="pending"
                    approveLabel="Approve bank change"
                    rejectLabel="Reject bank change"
                    entityName="this bank change request"
                    onApprove={async () => {
                      const res = await patchAdminFranchise(f._id, { bankDecision: 'approved' });
                      setFranchiseDetail(pickData(res) || f);
                      notify('Bank change approved');
                      refresh();
                      loadAdminInbox();
                    }}
                    onReject={async (decisionNote) => {
                      const res = await patchAdminFranchise(f._id, {
                        bankDecision: 'rejected',
                        decisionNote
                      });
                      setFranchiseDetail(pickData(res) || f);
                      notify('Bank change rejected');
                      refresh();
                      loadAdminInbox();
                    }}
                  />
                </>
              ) : (
                <p className="text-[11px] font-semibold text-slate-500">
                  No pending bank change
                  {f.pendingBankChange?.status && f.pendingBankChange.status !== 'none'
                    ? ` (last: ${f.pendingBankChange.status})`
                    : ''}
                  .
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h3 className="text-sm font-black text-slate-900">3. Other actions</h3>
              <div className="flex flex-wrap gap-2">
                <Btn
                  onClick={() => {
                    const pct = prompt(
                      'Delivery commission %',
                      String(f.deliveryCommissionPct ?? 0)
                    );
                    if (pct == null) return;
                    patchAdminFranchise(f._id, { deliveryCommissionPct: Number(pct) }).then(() => {
                      notify('Commission updated');
                      refresh();
                    });
                  }}
                >
                  Set commission %
                </Btn>
                <Btn
                  onClick={() => {
                    const url = prompt('Agreement URL / file link', f.agreementUrl || '');
                    if (url == null) return;
                    patchAdminFranchise(f._id, { agreementUrl: url }).then(() => {
                      notify('Agreement saved');
                      refresh();
                    });
                  }}
                >
                  Set agreement
                </Btn>
                <Btn
                  onClick={() => {
                    const amount = prompt('Payment amount ₹');
                    if (!amount) return;
                    addFranchisePayment(f._id, {
                      amount: Number(amount),
                      note: 'Admin payment'
                    }).then(() => {
                      notify('Payment recorded');
                      refresh();
                    });
                  }}
                >
                  Add payment
                </Btn>
              </div>
            </section>
            <h3 className="font-black text-sm">Payment history</h3>
            <PanelTable
              cols={[
                { key: 'paidAt', label: 'Date', render: (r) => (r.paidAt ? new Date(r.paidAt).toLocaleString() : '—') },
                { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
                { key: 'note', label: 'Note' }
              ]}
              rows={f.paymentHistory || []}
            />
          </div>
        );
      }
      return (
        <div className="space-y-4">
          {Number(adminBadges.franchisePendingBank || 0) > 0 ? (
            <div className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
              {adminBadges.franchisePendingBank} bank change request
              {adminBadges.franchisePendingBank === 1 ? '' : 's'} waiting — open franchise Details to Approve /
              Reject
            </div>
          ) : null}
          {pendingPinCount > 0 ? (
            <button
              type="button"
              onClick={() => goTo('franchises_pins')}
              className="w-full text-left rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              {pendingPinCount} PIN approval request{pendingPinCount === 1 ? '' : 's'} waiting → open PIN approvals
            </button>
          ) : null}
          <PanelTable
            cols={[
              { key: 'applicationId', label: 'App ID', render: (r) => r.applicationId || '—' },
              { key: 'name', label: 'Name' },
              { key: 'ownerName', label: 'Applicant' },
              { key: 'phone', label: 'Phone' },
              { key: 'city', label: 'City' },
              { key: 'status', label: 'Status' },
              { key: 'franchiseFee', label: 'Fee', render: (r) => money(r.franchiseFee) },
              { key: 'gstAmount', label: 'GST', render: (r) => money(r.gstAmount) },
              {
                key: 'comm',
                label: 'Del %',
                render: (r) => `${r.deliveryCommissionPct ?? 0}%`
              },
              {
                key: 'pins',
                label: 'PINs',
                render: (r) => (r.pinCodes || []).slice(0, 3).join(', ') + ((r.pinCodes?.length || 0) > 3 ? '…' : '')
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  <span className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Btn onClick={() => setFranchiseDetail(r)}>Details</Btn>
                    <Btn
                      onClick={() => {
                        const amount = prompt('Payment amount ₹');
                        if (!amount) return;
                        addFranchisePayment(r._id, { amount: Number(amount), note: 'Admin' }).then(refresh);
                      }}
                    >
                      Payment
                    </Btn>
                    <OnOffSwitch
                      checked={!!r.isActive}
                      title={r.isActive ? 'Deactivate franchise' : 'Activate franchise'}
                      onChange={(next) => patchAdminFranchise(r._id, { isActive: next }).then(refresh)}
                    />
                  </span>
                )
              }
            ]}
            rows={franchises}
            onRowClick={(r) => setFranchiseDetail(r)}
          />
        </div>
      );
    }

    if (tab === 'products_pending') {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-900">Pending product approvals</p>
              <p className="text-xs font-semibold text-slate-600">
                Seller-submitted products — review seller & store before approve / reject.
              </p>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
              {pendingProducts.length} pending
            </span>
          </div>
          {pendingProducts.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center text-xs font-bold text-slate-400">
              No products awaiting approval
            </div>
          ) : (
            <div className="space-y-3">
              {pendingProducts.map((r) => (
                <div
                  key={r._id}
                  className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap gap-3 items-start"
                >
                  <img
                    src={r.photoUrl || r.photos?.[0] || ''}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover border border-slate-100 bg-slate-50"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-black text-sm text-slate-900">{r.name}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {r.brand || 'No brand'} · {r.unit} · MRP {money(r.mrp)}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {r.categoryId?.name || '—'} / {r.subcategoryId?.name || '—'}
                    </p>
                    <div className="mt-1 rounded-lg border border-indigo-100 bg-indigo-50/70 px-2.5 py-2 text-[11px]">
                      <p className="font-black text-indigo-950">
                        Seller: {r.sellerName || r.submittedBy?.name || 'Unknown seller'}
                      </p>
                      <p className="font-semibold text-indigo-800">
                        Phone: {r.sellerPhone || r.submittedBy?.phone || '—'}
                        {r.submittedBy?.email ? ` · ${r.submittedBy.email}` : ''}
                      </p>
                      <p className="font-semibold text-indigo-800">
                        Store: {r.storeName || r.sellerStore?.name || '—'}
                        {r.storeCity || r.sellerStore?.city
                          ? ` · ${r.storeCity || r.sellerStore?.city}`
                          : ''}
                      </p>
                      {r.stock != null ? (
                        <p className="font-semibold text-indigo-700">Initial stock: {r.stock}</p>
                      ) : null}
                    </div>
                    {r.description ? (
                      <p className="text-[11px] text-slate-500 line-clamp-2">{r.description}</p>
                    ) : null}
                  </div>
                  <ApproveRejectControls
                    className="flex-col items-stretch sm:items-end"
                    status={r.approvalStatus || 'pending'}
                    entityName={`product “${r.name || 'item'}”`}
                    onApprove={async () => {
                      await patchProductApproval(r._id, 'approved');
                      notify(
                        `Approved “${r.name}” for ${r.storeName || r.sellerName || 'seller'}`
                      );
                      refresh();
                    }}
                    onReject={async (reason) => {
                      await patchProductApproval(r._id, 'rejected', reason);
                      notify(`Rejected “${r.name}”: ${reason}`);
                      refresh();
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (tab === 'products_create') {
      return (
        <div className="space-y-4 max-w-3xl">
          <form
            className="grid sm:grid-cols-2 gap-2 p-4 rounded-xl border border-slate-200 bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!prodCatId || !prodSubId || !prodPhoto) {
                notify('Category, subcategory & photo required');
                return;
              }
              const fd = new FormData(e.target);
              const unit = String(fd.get('unit') || '').trim();
              if (!unit) {
                notify('Enter quantity and select unit type');
                return;
              }
              try {
                await createProduct({
                  name: fd.get('name'),
                  brand: fd.get('brand') || '',
                  unit,
                  mrp: Number(fd.get('mrp')),
                  description: fd.get('description') || '',
                  photoUrl: prodPhoto,
                  photos: [prodPhoto],
                  categoryId: prodCatId,
                  subcategoryId: prodSubId,
                  approvalStatus: 'approved',
                  isActive: true
                });
                notify('Master product created');
                e.target.reset();
                setProdPhoto('');
                goTo('products');
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <h3 className="sm:col-span-2 font-black text-sm text-slate-800">Create master product</h3>
            <FormField label="Product name *">
              <input name="name" className={inputCls} required />
            </FormField>
            <FormField label="Brand">
              <input name="brand" className={inputCls} />
            </FormField>
            <FormField label="MRP *">
              <input name="mrp" className={inputCls} required />
            </FormField>
            <div className="sm:col-span-2">
              <UnitPackFields
                required
                defaultUnit="1 pc"
                inputClassName={inputCls}
                labelClassName="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1"
              />
            </div>
            <FormField label="Category *">
              <SearchableSelect
                options={mainCategories.map((c) => ({ value: c._id, label: c.name }))}
                value={prodCatId}
                onChange={(v) => {
                  setProdCatId(v);
                  setProdSubId('');
                }}
                placeholder="Search category…"
                required
              />
            </FormField>
            <FormField label="Subcategory *">
              <SearchableSelect
                options={subForMain.map((c) => ({ value: c._id, label: c.name }))}
                value={prodSubId}
                onChange={setProdSubId}
                placeholder="Search subcategory…"
                required
              />
            </FormField>
            <FormField label="Product photo" className="sm:col-span-2">
              <input
                type="file"
                accept="image/*"
                className="text-xs w-full"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setProdPhoto(await fileToDataUrl(f));
                }}
              />
            </FormField>
            <FormField label="Description" className="sm:col-span-2">
              <textarea name="description" className={inputCls} rows={2} />
            </FormField>
            <div className="sm:col-span-2 flex gap-2">
              <Btn type="submit" variant="primary">
                Create
              </Btn>
              <Btn type="button" onClick={() => goTo('products')}>
                Cancel
              </Btn>
            </div>
          </form>
        </div>
      );
    }

    if (tab === 'products') {
      const sellerOptions = [
        { value: '', label: 'All sellers' },
        ...sellers
          .map((s) => {
            const ownerId = s.ownerId?._id || s.ownerId;
            if (!ownerId) return null;
            const ownerName = s.ownerId?.name || s.ownerName || '';
            const phone = s.ownerId?.phone || s.phone || '';
            return {
              value: String(ownerId),
              label: `${s.name || 'Store'}${ownerName ? ` · ${ownerName}` : ''}${phone ? ` · ${phone}` : ''}`,
              keywords: `${s.name || ''} ${ownerName} ${phone} ${s.city || ''}`
            };
          })
          .filter(Boolean)
      ].filter((o, i, arr) => arr.findIndex((x) => String(x.value) === String(o.value)) === i);

      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <FormField label="Search name / brand" className="max-w-[220px]">
              <input
                className={inputCls}
                value={productSearchInput}
                onChange={(e) => setProductSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const q = productSearchInput.trim();
                  setProductFilter((p) => ({ ...p, q }));
                  fetchProductsAjax({
                    q,
                    approvalStatus: productFilter.approvalStatus,
                    isActive: productFilter.isActive,
                    sellerId: productFilter.sellerId
                  });
                }}
              />
            </FormField>
            <FormField label="Seller / store" className="min-w-[200px] max-w-[260px]">
              <SearchableSelect
                options={sellerOptions}
                value={productFilter.sellerId}
                onChange={(sellerId) => {
                  setProductFilter((p) => ({ ...p, sellerId }));
                  fetchProductsAjax({
                    q: productSearchInput.trim(),
                    approvalStatus: productFilter.approvalStatus,
                    isActive: productFilter.isActive,
                    sellerId
                  });
                }}
                placeholder="Filter by seller…"
              />
            </FormField>
            <FormField label="Approval" className="max-w-[140px]">
              <select
                className={inputCls}
                value={productFilter.approvalStatus}
                onChange={(e) => {
                  const approvalStatus = e.target.value;
                  setProductFilter((p) => ({ ...p, approvalStatus }));
                  fetchProductsAjax({
                    q: productSearchInput.trim(),
                    approvalStatus,
                    isActive: productFilter.isActive,
                    sellerId: productFilter.sellerId
                  });
                }}
              >
                <option value="">All</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </FormField>
            <Btn
              onClick={() => {
                const q = productSearchInput.trim();
                setProductFilter((p) => ({ ...p, q }));
                fetchProductsAjax({
                  q,
                  approvalStatus: productFilter.approvalStatus,
                  isActive: productFilter.isActive,
                  sellerId: productFilter.sellerId
                });
              }}
            >
              Apply filter
            </Btn>
            {productSearching ? (
              <span className="text-[10px] font-bold text-slate-500">Searching…</span>
            ) : productSearchInput.trim().length === 1 ? (
              <span className="text-[10px] font-bold text-amber-700">Type at least 2 characters</span>
            ) : null}
            {pendingProducts.length > 0 ? (
              <Btn onClick={() => goTo('products_pending')}>{pendingProducts.length} pending →</Btn>
            ) : null}
            <Btn variant="primary" onClick={() => goTo('products_create')}>
              Add product
            </Btn>
          </div>
          <PanelTable
            cols={[
              {
                key: 'photo',
                label: 'Photo',
                render: (r) => (
                  <img
                    src={r.photoUrl || r.photos?.[0] || ''}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover border bg-slate-50"
                  />
                )
              },
              {
                key: 'name',
                label: 'Product',
                render: (r) => (
                  <span>
                    <span className="font-black text-slate-900 block">{r.name}</span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {r.brand || '—'} · {r.unit || '—'} ·{' '}
                      {r.categoryId?.name || '—'}/{r.subcategoryId?.name || '—'}
                    </span>
                  </span>
                )
              },
              {
                key: 'seller',
                label: 'Seller / Store',
                render: (r) => (
                  <span className="text-[11px] font-semibold text-slate-700">
                    <span className="block font-black text-slate-900">
                      {r.sellerName || r.submittedBy?.name || 'Admin / Master'}
                    </span>
                    <span className="block text-slate-500">
                      {r.storeName || r.sellerStore?.name || '—'}
                      {r.storeCity || r.sellerStore?.city
                        ? ` · ${r.storeCity || r.sellerStore?.city}`
                        : ''}
                    </span>
                    <span className="block text-slate-400">
                      {r.sellerPhone || r.submittedBy?.phone || ''}
                    </span>
                  </span>
                )
              },
              { key: 'mrp', label: 'MRP', render: (r) => money(r.mrp ?? r.price) },
              { key: 'stock', label: 'Stock', render: (r) => r.stock ?? r.inventory ?? '—' },
              { key: 'approvalStatus', label: 'Approval' },
              {
                key: 'isActive',
                label: 'Active',
                render: (r) => (
                  <OnOffSwitch
                    checked={!!r.isActive}
                    title={r.isActive ? 'Turn off' : 'Turn on'}
                    onChange={(next) => updateProduct(r._id, { isActive: next }).then(refresh)}
                  />
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  <span className="flex gap-1 flex-wrap items-center">
                    <ApproveRejectControls
                      status={r.approvalStatus || 'pending'}
                      entityName={`product “${r.name || 'item'}”`}
                      stopPropagation
                      onApprove={async () => {
                        await patchProductApproval(r._id, 'approved');
                        notify(`Approved “${r.name}”`);
                        refresh();
                      }}
                      onReject={async (reason) => {
                        await patchProductApproval(r._id, 'rejected', reason);
                        notify(`Rejected “${r.name}”: ${reason}`);
                        refresh();
                      }}
                    />
                    <Btn
                      onClick={() => {
                        const name = prompt('Product name', r.name || '');
                        if (name == null) return;
                        const mrp = prompt('MRP / price', String(r.mrp ?? r.price ?? ''));
                        if (mrp == null) return;
                        const description = prompt('Description', r.description || '');
                        updateProduct(r._id, {
                          name,
                          mrp: Number(mrp),
                          description: description ?? r.description
                        }).then(() => {
                          notify('Product updated');
                          refresh();
                        });
                      }}
                    >
                      Edit
                    </Btn>
                    <Btn
                      variant="danger"
                      onClick={async () => {
                        const ok = await askConfirm(
                          `Delete product "${r.name || 'this item'}"? This cannot be undone.`,
                          'Delete product'
                        );
                        if (!ok) return;
                        try {
                          await deleteProduct(r._id);
                          notify('Product deleted');
                          refresh();
                        } catch (err) {
                          notify(err.message);
                        }
                      }}
                    >
                      Delete
                    </Btn>
                  </span>
                )
              }
            ]}
            rows={products}
          />
        </div>
      );
    }

    if (tab === 'orders') {
      if (orderDetail) {
        const o = orderDetail;
        const cancel = o.cancellationRequest || {};
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={() => setOrderDetail(null)}>← Back</Btn>
              <h2 className="font-black text-slate-900">{o.orderNumber}</h2>
              <span className="text-xs font-bold text-slate-500">{o.status}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
              <p>Customer: {o.customerName} · {o.customerPhone}</p>
              <p>Store: {o.storeId?.name || '—'}</p>
              <p className="sm:col-span-2">Address: {o.deliveryAddress}</p>
              <p>Pay: {o.paymentMode} / {o.paymentStatus}</p>
              <p>Txn: {o.paymentTxnId || '—'}</p>
              <p>Items: {money(o.itemsTotal)} · Delivery: {money(o.deliveryFee)}</p>
              <p>
                GST: {money(o.gstAmount)} ({o.gstPct || 0}%) · Seller fee: {money(o.platformFee)} · Delivery:{' '}
                {money(o.deliveryFee)}
              </p>
              <p>
                Franchise commission: {money(o.franchiseCommission)}
                {o.franchiseCommissionPct ? ` (${o.franchiseCommissionPct}%)` : ''}
                {o.franchiseCommissionPosted ? ' · posted' : o.franchiseCommission ? ' · pending complete' : ''}
              </p>
              <p>Discount: {money(o.discountAmount)} · Wallet: {money(o.walletUsed)}</p>
              <p className="font-black">Grand total: {money(o.grandTotal)}</p>
              <p>OTP on file: {o.otpCode ? '••••' : '—'}</p>
            </div>
            <PanelTable
              cols={[
                { key: 'productName', label: 'Item' },
                { key: 'quantity', label: 'Qty' },
                { key: 'unitPrice', label: 'Unit', render: (r) => money(r.unitPrice) },
                { key: 'totalPrice', label: 'Total', render: (r) => money(r.totalPrice) }
              ]}
              rows={o.items || []}
            />
            {cancel.requested || cancel.status === 'pending' || cancel.status === 'approved' || cancel.status === 'rejected' ? (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                <p className="text-xs font-black text-amber-900">Cancellation request</p>
                <p className="text-xs font-semibold text-amber-800">{cancel.reason || '—'}</p>
                <ApproveRejectControls
                  status={cancel.status || 'pending'}
                  approveLabel="Approve cancel"
                  rejectLabel="Reject cancel"
                  entityName="this cancellation request"
                  onApprove={async () => {
                    await patchAdminOrder(o._id, {
                      cancellationDecision: 'approved',
                      adminNote: 'Approved by admin'
                    });
                    notify('Cancellation approved');
                    refresh();
                  }}
                  onReject={async (adminNote) => {
                    await patchAdminOrder(o._id, {
                      cancellationDecision: 'rejected',
                      adminNote
                    });
                    notify('Cancellation rejected');
                    refresh();
                  }}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase">Update status</span>
              <select
                className={inputCls + ' max-w-[180px]'}
                defaultValue={o.status}
                onChange={(e) =>
                  patchAdminOrder(o._id, { status: e.target.value }).then(() => {
                    notify('Status updated');
                    refresh();
                  })
                }
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          <select
            className={inputCls + ' max-w-xs'}
            value={orderFilter.status}
            onChange={(e) => setOrderFilter((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <PanelTable
            cols={[
              { key: 'orderNumber', label: 'Order #' },
              { key: 'customerName', label: 'Customer' },
              { key: 'status', label: 'Status' },
              {
                key: 'cancel',
                label: 'Cancel req',
                render: (r) =>
                  r.cancellationRequest?.status && r.cancellationRequest.status !== 'none'
                    ? r.cancellationRequest.status
                    : '—'
              },
              { key: 'paymentMode', label: 'Pay mode' },
              { key: 'paymentStatus', label: 'Pay status' },
              { key: 'grandTotal', label: 'Total', render: (r) => money(r.grandTotal) },
              {
                key: 'statusUpd',
                label: 'Update',
                render: (r) => (
                  <select
                    className="border rounded px-1 py-0.5 text-[10px]"
                    defaultValue={r.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => patchAdminOrder(r._id, { status: e.target.value }).then(refresh)}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )
              }
            ]}
            rows={orders}
            onRowClick={(r) => setOrderDetail(r)}
          />
        </div>
      );
    }

    if (tab === 'payments') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              className={inputCls + ' max-w-xs'}
              value={paymentFilter.paymentMode}
              onChange={(e) => setPaymentFilter((p) => ({ ...p, paymentMode: e.target.value }))}
            >
              <option value="">All modes</option>
              <option value="COD">COD</option>
              <option value="UPI">UPI</option>
              <option value="CARD">CARD</option>
            </select>
            <select
              className={inputCls + ' max-w-xs'}
              value={paymentFilter.paymentStatus}
              onChange={(e) => setPaymentFilter((p) => ({ ...p, paymentStatus: e.target.value }))}
            >
              <option value="">All pay status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid / success</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <PanelTable
            cols={[
              { key: 'orderNumber', label: 'Order' },
              { key: 'paymentMode', label: 'Mode' },
              { key: 'paymentStatus', label: 'Status' },
              {
                key: 'txn',
                label: 'Txn ID',
                render: (r) => r.paymentTxnId || r.transactionId || r.razorpayPaymentId || '—'
              },
              { key: 'storeId', label: 'Seller', render: (r) => r.storeId?.name || '—' },
              { key: 'grandTotal', label: 'Amount', render: (r) => money(r.grandTotal) },
              { key: 'refundStatus', label: 'Refund' },
              {
                key: 'refund',
                label: 'Set refund',
                render: (r) => (
                  <select
                    className="border rounded px-1 text-[10px]"
                    defaultValue={r.refundStatus || 'none'}
                    onChange={(e) => patchAdminOrder(r._id, { refundStatus: e.target.value }).then(refresh)}
                  >
                    <option value="none">none</option>
                    <option value="requested">requested</option>
                    <option value="processed">processed</option>
                    <option value="rejected">rejected</option>
                  </select>
                )
              }
            ]}
            rows={payments}
          />
        </div>
      );
    }

    if (tab === 'commission') {
      const cfg = commission?.config;
      const ordRows = commission?.orders || [];
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl border border-slate-200 bg-white">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Seller commission %</p>
              <input className={inputCls + ' w-24'} value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Franchise delivery %</p>
              <input
                className={inputCls + ' w-24'}
                value={franchiseCommissionPct}
                onChange={(e) => setFranchiseCommissionPct(e.target.value)}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Seller registration fee ₹</p>
              <input
                className={inputCls + ' w-28'}
                type="number"
                min="0"
                step="1"
                value={sellerRegistrationFee}
                onChange={(e) => setSellerRegistrationFee(e.target.value)}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Franchise registration fee ₹</p>
              <input
                className={inputCls + ' w-28'}
                type="number"
                min="0"
                step="1"
                value={franchiseRegistrationFee}
                onChange={(e) => setFranchiseRegistrationFee(e.target.value)}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Franchise fee min ₹</p>
              <input
                className={inputCls + ' w-32'}
                type="number"
                min="0"
                step="1"
                value={franchiseFeeMin}
                onChange={(e) => setFranchiseFeeMin(e.target.value)}
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Franchise fee max ₹</p>
              <input
                className={inputCls + ' w-32'}
                type="number"
                min="0"
                step="1"
                value={franchiseFeeMax}
                onChange={(e) => setFranchiseFeeMax(e.target.value)}
              />
            </div>
            <Btn
              variant="primary"
              onClick={() =>
                patchAdminCommissionConfig({
                  sellerCommissionPct: Number(commissionPct),
                  franchiseDeliveryCommissionPct: Number(franchiseCommissionPct),
                  sellerRegistrationFee: Number(sellerRegistrationFee),
                  franchiseRegistrationFee: Number(franchiseRegistrationFee),
                  franchiseFeeMin: Number(franchiseFeeMin),
                  franchiseFeeMax: Number(franchiseFeeMax)
                }).then(() => {
                  notify('Config saved');
                  refresh();
                })
              }
            >
              Save config
            </Btn>
            <Btn
              onClick={() =>
                downloadAdminReportCsv({ type: 'commission', range: 'monthly' }).then(() =>
                  notify('Commission CSV downloaded')
                )
              }
            >
              Download report
            </Btn>
            <p className="text-xs font-bold text-slate-600">
              Seller pending: {money(commission?.pendingCommission)} · Paid: {money(commission?.paidCommission)}
            </p>
            <p className="text-xs font-bold text-slate-600">
              Franchise delivery earned: {money(commission?.franchiseCommissionEarned)} · Posted to ledger:{' '}
              {money(commission?.franchiseCommissionPosted)}
            </p>
          </div>
          <p className="text-[11px] font-semibold text-slate-500">
            Franchise commission = delivery fee × franchise % (per-franchise or default). Credits to franchise ledger when
            order is completed.
          </p>
          <PanelTable
            cols={[
              { key: 'orderNumber', label: 'Order' },
              { key: 'storeId', label: 'Store', render: (r) => r.storeId?.name || '—' },
              { key: 'platformFee', label: 'Seller fee', render: (r) => money(r.platformFee) },
              {
                key: 'franchise',
                label: 'Franchise',
                render: (r) => r.franchiseId?.name || '—'
              },
              {
                key: 'franchiseCommission',
                label: 'Franchise ₹',
                render: (r) =>
                  r.franchiseCommission
                    ? `${money(r.franchiseCommission)}${r.franchiseCommissionPosted ? '' : ' (pending)'}`
                    : '—'
              },
              { key: 'commissionPaid', label: 'Seller paid', render: (r) => (r.commissionPaid ? 'Yes' : 'No') },
              {
                key: 'mark',
                label: 'Mark paid',
                render: (r) =>
                  !r.commissionPaid ? (
                    <Btn variant="ok" onClick={() => markCommissionPaid([r._id]).then(refresh)}>
                      Mark paid
                    </Btn>
                  ) : (
                    '—'
                  )
              }
            ]}
            rows={ordRows}
          />
        </div>
      );
    }

    if (tab === 'reports') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              className={inputCls + ' max-w-[160px]'}
              value={reports.type}
              onChange={(e) => setReports((p) => ({ ...p, type: e.target.value }))}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              className={inputCls + ' max-w-[120px]'}
              value={reports.range}
              onChange={(e) => setReports((p) => ({ ...p, range: e.target.value }))}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <Btn onClick={refresh}>Run report</Btn>
            <Btn
              variant="primary"
              onClick={() =>
                downloadAdminReportCsv({ type: reports.type, range: reports.range }).then(() =>
                  notify('Excel/CSV downloaded')
                )
              }
            >
              Download Excel/CSV
            </Btn>
            <Btn
              onClick={() => {
                const w = window.open('', '_blank');
                if (!w) return;
                const keys = Object.keys(reports.rows[0] || {});
                const head = keys.map((k) => `<th>${k}</th>`).join('');
                const body = reports.rows
                  .map(
                    (r) =>
                      `<tr>${keys.map((k) => `<td>${r[k] != null ? String(r[k]).replace(/</g, '') : ''}</td>`).join('')}</tr>`
                  )
                  .join('');
                w.document.write(
                  `<html><head><title>Japto ${reports.type} report</title><style>body{font-family:sans-serif;padding:16px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f1f5f9}</style></head><body><h2>Japto ${reports.type} · ${reports.range}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><script>window.print()</script></body></html>`
                );
                w.document.close();
              }}
            >
              Print / PDF
            </Btn>
          </div>
          <PanelTable
            cols={Object.keys(reports.rows[0] || { period: '—' }).map((k) => ({ key: k, label: k }))}
            rows={reports.rows}
          />
        </div>
      );
    }

    if (tab === 'complaints') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              className={inputCls + ' max-w-xs'}
              value={complaintFilter.source}
              onChange={(e) => setComplaintFilter((p) => ({ ...p, source: e.target.value }))}
            >
              <option value="">All sources</option>
              <option value="customer">Customer</option>
              <option value="seller">Seller</option>
              <option value="delivery">Delivery</option>
              <option value="franchise">Franchise</option>
            </select>
            <select
              className={inputCls + ' max-w-xs'}
              value={complaintFilter.status}
              onChange={(e) => setComplaintFilter((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="">All status</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <PanelTable
            cols={[
              { key: 'source', label: 'Source' },
              {
                key: 'raisedByName',
                label: 'From',
                render: (r) => (
                  <span className="text-[11px] font-semibold">
                    <span className="block font-black text-slate-900">{r.raisedByName || '—'}</span>
                    <span className="block text-slate-500">{r.raisedByPhone || ''}</span>
                    {r.storeName ? (
                      <span className="block text-slate-500">Store: {r.storeName}</span>
                    ) : null}
                  </span>
                )
              },
              {
                key: 'subject',
                label: 'Subject / request',
                render: (r) => (
                  <span className="text-[11px]">
                    <span className="font-black text-slate-900 block">{r.subject}</span>
                    <span className="text-slate-600 whitespace-pre-wrap">{r.message}</span>
                    {r.supportType === 'address' && r.requestedChanges ? (
                      <span className="mt-1 block rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 font-semibold text-indigo-900">
                        New address pending approval:
                        <br />
                        {r.requestedChanges.address}
                        <br />
                        {r.requestedChanges.city} · {r.requestedChanges.pincode}
                      </span>
                    ) : null}
                    {r.supportType === 'promoters' && r.requestedChanges ? (
                      <span className="mt-1 block rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 font-semibold text-indigo-900">
                        New promoters pending approval:
                        <br />
                        P1:{' '}
                        {r.requestedChanges.promoter1Name ||
                          r.requestedChanges.promoters?.[0]?.name ||
                          '—'}{' '}
                        ·{' '}
                        {r.requestedChanges.promoter1Phone ||
                          r.requestedChanges.promoters?.[0]?.phone ||
                          '—'}
                        <br />
                        P2:{' '}
                        {r.requestedChanges.promoter2Name ||
                          r.requestedChanges.promoters?.[1]?.name ||
                          '—'}{' '}
                        ·{' '}
                        {r.requestedChanges.promoter2Phone ||
                          r.requestedChanges.promoters?.[1]?.phone ||
                          '—'}
                      </span>
                    ) : null}
                  </span>
                )
              },
              { key: 'status', label: 'Status' },
              {
                key: 'history',
                label: 'Replies',
                render: (r) =>
                  (r.replies || []).length
                    ? (r.replies || []).map((x) => x.message).join(' · ')
                    : '—'
              },
              {
                key: 'reply',
                label: 'Actions',
                render: (r) => (
                  <span className="flex flex-col gap-1">
                    <Btn
                      variant="ok"
                      onClick={() =>
                        setSupportReview({
                          row: r,
                          mode: 'approve',
                          note:
                            r.supportType === 'address'
                              ? 'Address change approved and applied to store'
                              : r.supportType === 'promoters'
                                ? 'Promoter change approved and applied to store'
                                : 'Resolved',
                          address: {
                            address: r.requestedChanges?.address || '',
                            pincode: r.requestedChanges?.pincode || '',
                            city: r.requestedChanges?.city || '',
                            lat: r.requestedChanges?.lat ?? '',
                            lng: r.requestedChanges?.lng ?? ''
                          },
                          promoters: {
                            promoter1Name:
                              r.requestedChanges?.promoter1Name ||
                              r.requestedChanges?.promoters?.[0]?.name ||
                              '',
                            promoter1Phone:
                              r.requestedChanges?.promoter1Phone ||
                              r.requestedChanges?.promoters?.[0]?.phone ||
                              '',
                            promoter2Name:
                              r.requestedChanges?.promoter2Name ||
                              r.requestedChanges?.promoters?.[1]?.name ||
                              '',
                            promoter2Phone:
                              r.requestedChanges?.promoter2Phone ||
                              r.requestedChanges?.promoters?.[1]?.phone ||
                              ''
                          }
                        })
                      }
                    >
                      {r.supportType === 'address'
                        ? 'Approve address'
                        : r.supportType === 'promoters'
                          ? 'Approve promoters'
                          : 'Reply & resolve'}
                    </Btn>
                    {r.isSupportRequest ? (
                      <Btn
                        variant="danger"
                        onClick={() =>
                          setSupportReview({
                            row: r,
                            mode: 'reject',
                            note: '',
                            address: null
                          })
                        }
                      >
                        Reject
                      </Btn>
                    ) : null}
                  </span>
                )
              }
            ]}
            rows={complaints}
          />

          {supportReview ? (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
              <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {supportReview.mode === 'approve' ? 'Approve request' : 'Reject request'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {supportReview.row.subject} · {supportReview.row.raisedByName || 'Seller'}
                      {supportReview.row.storeName ? ` · ${supportReview.row.storeName}` : ''}
                    </p>
                  </div>
                  <Btn type="button" onClick={() => setSupportReview(null)}>
                    Close
                  </Btn>
                </div>

                {supportReview.row.supportType === 'address' ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] space-y-1">
                    <p className="font-black text-slate-800">How address update works</p>
                    <p className="font-semibold text-slate-600">
                      Seller sent a new address via Support Request. On <strong>Approve</strong>, that
                      address is written to the seller&apos;s store automatically (no separate screen
                      required). You can edit the fields below before approving. On{' '}
                      <strong>Reject</strong>, store address stays unchanged.
                    </p>
                    {supportReview.row.currentAddress ? (
                      <p className="font-semibold text-slate-500">
                        Current store: {supportReview.row.currentAddress.address || '—'},{' '}
                        {supportReview.row.currentAddress.city || '—'}{' '}
                        {supportReview.row.currentAddress.pincode || ''}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {supportReview.row.supportType === 'promoters' ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] space-y-1">
                    <p className="font-black text-slate-800">How promoter update works</p>
                    <p className="font-semibold text-slate-600">
                      Seller requested Promoter 1 / Promoter 2 changes. On <strong>Approve</strong>,
                      those details are written to the store. You can edit fields below before
                      approving. On <strong>Reject</strong>, store promoters stay unchanged.
                    </p>
                    {(supportReview.row.currentPromoters || []).length ? (
                      <p className="font-semibold text-slate-500">
                        Current:{' '}
                        {(supportReview.row.currentPromoters || [])
                          .map(
                            (p, i) =>
                              `P${i + 1} ${p.name || '—'} (${p.phone || '—'})`
                          )
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {supportReview.mode === 'approve' &&
                supportReview.row.supportType === 'address' &&
                supportReview.address ? (
                  <div className="space-y-2">
                    <FormField label="Address to apply *">
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={supportReview.address.address}
                        onChange={(e) =>
                          setSupportReview((p) => ({
                            ...p,
                            address: { ...p.address, address: e.target.value }
                          }))
                        }
                        required
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="Pincode *">
                        <input
                          className={inputCls}
                          maxLength={6}
                          value={supportReview.address.pincode}
                          onChange={(e) =>
                            setSupportReview((p) => ({
                              ...p,
                              address: { ...p.address, pincode: e.target.value }
                            }))
                          }
                        />
                      </FormField>
                      <FormField label="City *">
                        <input
                          className={inputCls}
                          value={supportReview.address.city}
                          onChange={(e) =>
                            setSupportReview((p) => ({
                              ...p,
                              address: { ...p.address, city: e.target.value }
                            }))
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                ) : null}

                {supportReview.mode === 'approve' &&
                supportReview.row.supportType === 'promoters' &&
                supportReview.promoters ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="Promoter 1 name">
                        <input
                          className={inputCls}
                          value={supportReview.promoters.promoter1Name}
                          onChange={(e) =>
                            setSupportReview((p) => ({
                              ...p,
                              promoters: { ...p.promoters, promoter1Name: e.target.value }
                            }))
                          }
                        />
                      </FormField>
                      <FormField label="Promoter 1 mobile">
                        <input
                          className={inputCls}
                          value={supportReview.promoters.promoter1Phone}
                          onChange={(e) =>
                            setSupportReview((p) => ({
                              ...p,
                              promoters: { ...p.promoters, promoter1Phone: e.target.value }
                            }))
                          }
                        />
                      </FormField>
                      <FormField label="Promoter 2 name">
                        <input
                          className={inputCls}
                          value={supportReview.promoters.promoter2Name}
                          onChange={(e) =>
                            setSupportReview((p) => ({
                              ...p,
                              promoters: { ...p.promoters, promoter2Name: e.target.value }
                            }))
                          }
                        />
                      </FormField>
                      <FormField label="Promoter 2 mobile">
                        <input
                          className={inputCls}
                          value={supportReview.promoters.promoter2Phone}
                          onChange={(e) =>
                            setSupportReview((p) => ({
                              ...p,
                              promoters: { ...p.promoters, promoter2Phone: e.target.value }
                            }))
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                ) : null}

                <FormField
                  label={
                    supportReview.mode === 'approve'
                      ? 'Approval message *'
                      : 'Rejection message *'
                  }
                >
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={supportReview.note}
                    onChange={(e) => setSupportReview((p) => ({ ...p, note: e.target.value }))}
                    placeholder={
                      supportReview.mode === 'approve'
                        ? 'Message shown on the request after approval…'
                        : 'Tell the seller why this request is rejected…'
                    }
                  />
                </FormField>

                <div className="flex flex-wrap gap-2 justify-end">
                  <Btn type="button" onClick={() => setSupportReview(null)}>
                    Cancel
                  </Btn>
                  {supportReview.mode === 'reject' ? (
                    <Btn
                      type="button"
                      variant="danger"
                      onClick={async () => {
                        const note = String(supportReview.note || '').trim();
                        if (!note) {
                          notify('Rejection message is required');
                          return;
                        }
                        try {
                          await replyAdminComplaint(supportReview.row._id, {
                            message: note,
                            status: 'closed',
                            isSupportRequest: true
                          });
                          notify('Request rejected with message');
                          setSupportReview(null);
                          refresh();
                        } catch (err) {
                          notify(err.message);
                        }
                      }}
                    >
                      Reject with message
                    </Btn>
                  ) : (
                    <Btn
                      type="button"
                      variant="ok"
                      onClick={async () => {
                        const note = String(supportReview.note || '').trim();
                        if (!note) {
                          notify('Approval message is required');
                          return;
                        }
                        const payload = {
                          message: note,
                          status: 'resolved',
                          isSupportRequest: supportReview.row.isSupportRequest
                        };
                        if (
                          supportReview.row.supportType === 'address' &&
                          supportReview.address
                        ) {
                          const a = supportReview.address;
                          if (!a.address?.trim() || !a.pincode?.trim() || !a.city?.trim()) {
                            notify('Address, pincode and city are required to approve');
                            return;
                          }
                          payload.requestedChanges = {
                            address: a.address.trim(),
                            pincode: a.pincode.trim(),
                            city: a.city.trim(),
                            lat: a.lat !== '' ? Number(a.lat) : undefined,
                            lng: a.lng !== '' ? Number(a.lng) : undefined
                          };
                        }
                        if (
                          supportReview.row.supportType === 'promoters' &&
                          supportReview.promoters
                        ) {
                          const p = supportReview.promoters;
                          if (
                            !p.promoter1Name?.trim() &&
                            !p.promoter1Phone?.trim() &&
                            !p.promoter2Name?.trim() &&
                            !p.promoter2Phone?.trim()
                          ) {
                            notify('At least one promoter name or mobile is required');
                            return;
                          }
                          payload.requestedChanges = {
                            promoter1Name: p.promoter1Name.trim(),
                            promoter1Phone: p.promoter1Phone.trim(),
                            promoter2Name: p.promoter2Name.trim(),
                            promoter2Phone: p.promoter2Phone.trim()
                          };
                        }
                        try {
                          await replyAdminComplaint(supportReview.row._id, payload);
                          notify(
                            supportReview.row.supportType === 'address'
                              ? 'Approved — seller store address updated'
                              : supportReview.row.supportType === 'promoters'
                                ? 'Approved — store promoters updated'
                                : 'Request resolved'
                          );
                          setSupportReview(null);
                          refresh();
                        } catch (err) {
                          notify(err.message);
                        }
                      }}
                    >
                      {supportReview.row.supportType === 'address'
                        ? 'Approve & update store address'
                        : supportReview.row.supportType === 'promoters'
                          ? 'Approve & update promoters'
                          : 'Approve / resolve'}
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (tab === 'settings' && settings) {
      return (
        <form
          className="grid sm:grid-cols-2 gap-2 max-w-3xl"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const payload = Object.fromEntries(fd.entries());
            try {
              await patchAdminSettings(payload);
              notify('Settings saved');
              refresh();
            } catch (err) {
              notify(err.message);
            }
          }}
        >
          {[
            ['siteName', 'Site name'],
            ['logoUrl', 'Logo URL'],
            ['bannerUrl', 'Banner URL'],
            ['homepageHeadline', 'Homepage headline'],
            ['homepageSubtext', 'Homepage subtext'],
            ['contactPhone', 'Contact phone'],
            ['contactEmail', 'Contact email'],
            ['contactAddress', 'Contact address']
          ].map(([name, label]) => (
            <label key={name} className="block">
              <span className="text-[10px] font-black text-slate-500">{label}</span>
              <input name={name} defaultValue={settings[name] || ''} className={inputCls} />
            </label>
          ))}
          <label className="sm:col-span-2 block">
            <span className="text-[10px] font-black text-slate-500">Terms HTML</span>
            <textarea name="termsHtml" defaultValue={settings.termsHtml || ''} className={inputCls} rows={2} />
          </label>
          <label className="sm:col-span-2 block">
            <span className="text-[10px] font-black text-slate-500">Privacy HTML</span>
            <textarea name="privacyHtml" defaultValue={settings.privacyHtml || ''} className={inputCls} rows={2} />
          </label>
          <label className="sm:col-span-2 block">
            <span className="text-[10px] font-black text-slate-500">Shipping / returns</span>
            <textarea name="shippingReturnHtml" defaultValue={settings.shippingReturnHtml || ''} className={inputCls} rows={2} />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const url = await fileToDataUrl(f);
                  await patchAdminSettings({ logoUrl: url });
                  notify('Logo uploaded');
                  refresh();
                }
              }}
            />
            <span className="text-[10px] text-slate-500 font-bold">Quick logo upload</span>
          </div>

          <div className="sm:col-span-2 mt-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-indigo-950">Razorpay (payments)</p>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  settings.razorpayConfigured
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {settings.razorpayConfigured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-600">
              Checkout, seller registration fee and franchise registration fee use these keys. Leave
              secret fields blank to keep the saved value.
            </p>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Key Id (rzp_test_… / rzp_live_…)</span>
              <input
                name="razorpayKeyId"
                defaultValue={settings.razorpayKeyId || ''}
                className={inputCls}
                autoComplete="off"
                placeholder="rzp_test_xxxxxxxx"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">
                Key Secret {settings.razorpayKeySecretSet ? '(saved — enter new to replace)' : ''}
              </span>
              <input
                name="razorpayKeySecret"
                type="password"
                defaultValue=""
                className={inputCls}
                autoComplete="new-password"
                placeholder={settings.razorpayKeySecretSet ? '•••••••• (unchanged if blank)' : 'Key secret'}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">
                Webhook secret {settings.razorpayWebhookSecretSet ? '(saved — enter new to replace)' : '(optional)'}
              </span>
              <input
                name="razorpayWebhookSecret"
                type="password"
                defaultValue=""
                className={inputCls}
                autoComplete="new-password"
                placeholder={
                  settings.razorpayWebhookSecretSet ? '•••••••• (unchanged if blank)' : 'Optional'
                }
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Checkout company name</span>
              <input
                name="razorpayCompanyName"
                defaultValue={settings.razorpayCompanyName || 'Japto.in'}
                className={inputCls}
              />
            </label>
          </div>

          <Btn type="submit" variant="primary">Save settings</Btn>
        </form>
      );
    }

    if (isEmailTab(tab) && emailForm) {
      const setF = (key, val) => setEmailForm((p) => ({ ...p, [key]: val }));

      if (tab === 'email_smtp' || tab === 'email') {
        return (
          <div className="space-y-4 max-w-3xl">
            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
              {emailSettings?.smtpPassSet ? (
                <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">SMTP password saved</span>
              ) : (
                <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200">SMTP password missing</span>
              )}
              <button type="button" className="underline font-black text-slate-800" onClick={() => goTo('email_queue')}>
                Queue: {emailQueueStats?.queued ?? 0} →
              </button>
            </div>
            <section className="p-4 rounded-xl border bg-white space-y-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-500">Head Office / Admin email</span>
                  <input
                    className={inputCls}
                    value={emailForm.adminEmail}
                    onChange={(e) => setF('adminEmail', e.target.value)}
                  />
                </label>
                <FormField label="From (display)" hint="Example: Japto.in <you@gmail.com>">
                  <input
                    className={inputCls}
                    value={emailForm.smtpFrom}
                    onChange={(e) => setF('smtpFrom', e.target.value)}
                  />
                </FormField>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-500">SMTP host</span>
                  <input
                    className={inputCls}
                    value={emailForm.smtpHost}
                    onChange={(e) => setF('smtpHost', e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-500">SMTP port</span>
                  <input
                    className={inputCls}
                    type="number"
                    value={emailForm.smtpPort}
                    onChange={(e) => setF('smtpPort', Number(e.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-500">SMTP user (Gmail)</span>
                  <input
                    className={inputCls}
                    value={emailForm.smtpUser}
                    onChange={(e) => setF('smtpUser', e.target.value)}
                  />
                </label>
                <FormField
                  label="SMTP App Password"
                  hint={
                    emailSettings?.smtpPassSet
                      ? 'Leave blank to keep the saved password'
                      : 'Use a Gmail App Password'
                  }
                >
                  <input
                    className={inputCls}
                    type="password"
                    value={emailForm.smtpPass}
                    onChange={(e) => setF('smtpPass', e.target.value)}
                  />
                </FormField>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={emailForm.smtpSecure}
                  onChange={(e) => setF('smtpSecure', e.target.checked)}
                />
                Secure (port 465)
              </label>
              <Btn
                variant="primary"
                onClick={() =>
                  patchAdminEmailSettings({
                    adminEmail: emailForm.adminEmail,
                    smtpHost: emailForm.smtpHost,
                    smtpPort: emailForm.smtpPort,
                    smtpUser: emailForm.smtpUser,
                    smtpFrom: emailForm.smtpFrom,
                    smtpSecure: emailForm.smtpSecure,
                    ...(emailForm.smtpPass ? { smtpPass: emailForm.smtpPass } : {})
                  }).then(() => {
                    notify('Email SMTP settings saved');
                    refresh();
                  })
                }
              >
                Save SMTP settings
              </Btn>
            </section>
          </div>
        );
      }

      if (tab === 'email_template_applicant') {
        return (
          <div className="space-y-4 max-w-3xl">
            <section className="p-4 rounded-xl border bg-white space-y-3">
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <p className="text-xs font-semibold text-slate-600">
                  Franchise apply करने पर applicant को confirmation mail
                </p>
                <Btn
                  onClick={() =>
                    patchAdminEmailSettings({ resetApplicantTemplate: true }).then(() => {
                      notify('Applicant template reset to default');
                      refresh();
                    })
                  }
                >
                  Reset default
                </Btn>
              </div>
              <p className="text-[10px] font-semibold text-slate-500">
                Template variables:{' '}
                {
                  '{{applicationId}} {{ownerName}} {{phone}} {{email}} {{city}} {{pincode}} {{address}} {{businessExperience}} {{message}} {{promoters}} {{submittedAt}}'
                }
              </p>
              <FormField label="Email subject">
                <input
                  className={inputCls}
                  value={emailForm.applicantSubject}
                  onChange={(e) => setF('applicantSubject', e.target.value)}
                />
              </FormField>
              <FormField label="Email body (HTML)">
                <textarea
                  className={inputCls + ' font-mono text-[11px]'}
                  rows={14}
                  value={emailForm.applicantHtml}
                  onChange={(e) => setF('applicantHtml', e.target.value)}
                />
              </FormField>
              <Btn
                variant="primary"
                onClick={() =>
                  patchAdminEmailSettings({
                    templates: {
                      franchiseApplicant: {
                        subject: emailForm.applicantSubject,
                        html: emailForm.applicantHtml
                      }
                    }
                  }).then(() => {
                    notify('Applicant template saved');
                    refresh();
                  })
                }
              >
                Save applicant template
              </Btn>
            </section>
          </div>
        );
      }

      if (tab === 'email_template_admin') {
        return (
          <div className="space-y-4 max-w-3xl">
            <section className="p-4 rounded-xl border bg-white space-y-3">
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <p className="text-xs font-semibold text-slate-600">
                  नई franchise application पर Head Office / Admin को alert
                </p>
                <Btn
                  onClick={() =>
                    patchAdminEmailSettings({ resetAdminTemplate: true }).then(() => {
                      notify('Admin template reset to default');
                      refresh();
                    })
                  }
                >
                  Reset default
                </Btn>
              </div>
              <FormField label="Email subject">
                <input
                  className={inputCls}
                  value={emailForm.adminSubject}
                  onChange={(e) => setF('adminSubject', e.target.value)}
                />
              </FormField>
              <FormField label="Email body (HTML)">
                <textarea
                  className={inputCls + ' font-mono text-[11px]'}
                  rows={14}
                  value={emailForm.adminHtml}
                  onChange={(e) => setF('adminHtml', e.target.value)}
                />
              </FormField>
              <Btn
                variant="primary"
                onClick={() =>
                  patchAdminEmailSettings({
                    templates: {
                      franchiseAdmin: {
                        subject: emailForm.adminSubject,
                        html: emailForm.adminHtml
                      }
                    }
                  }).then(() => {
                    notify('Admin template saved');
                    refresh();
                  })
                }
              >
                Save admin template
              </Btn>
            </section>
          </div>
        );
      }

      if (tab === 'email_queue') {
        return (
          <div className="space-y-4 max-w-5xl">
            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600 items-center">
              <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
                Queued: {emailQueueStats?.queued ?? 0}
              </span>
              <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                Sent: {emailQueueStats?.sent ?? 0}
              </span>
              <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200">
                Failed: {emailQueueStats?.failed ?? 0}
              </span>
              <Btn
                variant="ok"
                onClick={() =>
                  processAdminEmailQueue()
                    .then((r) => {
                      notify(r.message || `Sent ${r.data?.sent || 0}`);
                      refresh();
                    })
                    .catch((e) => notify(e.message))
                }
              >
                Send queued emails now
              </Btn>
            </div>
            <PanelTable
              cols={[
                { key: 'to', label: 'To' },
                { key: 'subject', label: 'Subject' },
                { key: 'template', label: 'Template' },
                { key: 'status', label: 'Status' },
                { key: 'attempts', label: 'Tries' },
                {
                  key: 'createdAt',
                  label: 'When',
                  render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—')
                },
                {
                  key: 'err',
                  label: 'Error',
                  render: (r) => r.lastError || '—'
                }
              ]}
              rows={emailQueueRows}
            />
          </div>
        );
      }
    }

    if (tab === 'coupons') {
      return (
        <div className="space-y-4">
          <form
            className="grid sm:grid-cols-3 gap-2 p-3 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await createAdminCoupon({
                  code: fd.get('code'),
                  discountType: fd.get('discountType'),
                  discountValue: Number(fd.get('discountValue')),
                  minOrderValue: Number(fd.get('minOrderValue')) || 0,
                  validFrom: fd.get('validFrom') || undefined,
                  validTo: fd.get('validTo') || undefined,
                  isActive: true
                });
                notify('Coupon created');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <FormField label="Coupon code *">
              <input name="code" className={inputCls} required />
            </FormField>
            <FormField label="Discount type">
              <select name="discountType" className={inputCls}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed ₹</option>
              </select>
            </FormField>
            <FormField label="Discount value *">
              <input name="discountValue" className={inputCls} required />
            </FormField>
            <FormField label="Min order (₹)">
              <input name="minOrderValue" className={inputCls} />
            </FormField>
            <FormField label="Valid from">
              <input name="validFrom" type="date" className={inputCls} />
            </FormField>
            <FormField label="Valid to">
              <input name="validTo" type="date" className={inputCls} />
            </FormField>
            <div className="flex items-end">
              <Btn type="submit" variant="primary">
                Add coupon
              </Btn>
            </div>
          </form>
          <PanelTable
            cols={[
              { key: 'code', label: 'Code' },
              { key: 'discountType', label: 'Type' },
              { key: 'discountValue', label: 'Value' },
              { key: 'minOrderValue', label: 'Min order' },
              { key: 'usageCount', label: 'Used' },
              {
                key: 'isActive',
                label: 'Active',
                render: (r) => (
                  <OnOffSwitch
                    checked={!!r.isActive}
                    onChange={(next) => patchAdminCoupon(r._id, { isActive: next }).then(refresh)}
                  />
                )
              },
              {
                key: 'del',
                label: '',
                render: (r) => (
                  <Btn
                    variant="danger"
                    onClick={async () => {
                      const ok = await askConfirm(
                        `Delete coupon "${r.code || 'this coupon'}"? This cannot be undone.`,
                        'Delete coupon'
                      );
                      if (!ok) return;
                      try {
                        await deleteAdminCoupon(r._id);
                        notify('Coupon deleted');
                        refresh();
                      } catch (err) {
                        notify(err.message);
                      }
                    }}
                  >
                    Delete
                  </Btn>
                )
              }
            ]}
            rows={coupons}
          />
        </div>
      );
    }

    if (tab === 'banners') {
      return (
        <div className="space-y-4">
          <form
            className="grid sm:grid-cols-2 gap-2 p-3 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                const imageUrl = String(fd.get('imageUrl') || '').trim();
                if (!imageUrl) {
                  notify('Banner image URL or upload required');
                  return;
                }
                await createAdminBanner({
                  imageUrl,
                  title: fd.get('title'),
                  linkUrl: fd.get('linkUrl'),
                  city: fd.get('city') || '',
                  startDate: fd.get('startDate') || null,
                  endDate: fd.get('endDate') || null,
                  isActive: true
                });
                notify('Banner added');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <FormField label="Image URL">
              <input name="imageUrl" className={inputCls} id="banner-url" />
            </FormField>
            <FormField label="Upload image">
              <input
                type="file"
                accept="image/*"
                className="text-xs w-full"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await fileToDataUrl(f);
                  const el = document.getElementById('banner-url');
                  if (el) el.value = url;
                }}
              />
            </FormField>
            <FormField label="Banner text">
              <input name="title" className={inputCls} />
            </FormField>
            <FormField label="Link URL">
              <input name="linkUrl" className={inputCls} />
            </FormField>
            <FormField label="City" hint="Leave blank for all cities">
              <input name="city" className={inputCls} />
            </FormField>
            <FormField label="Start date">
              <input name="startDate" type="date" className={inputCls} />
            </FormField>
            <FormField label="End date">
              <input name="endDate" type="date" className={inputCls} />
            </FormField>
            <div className="flex items-end">
              <Btn type="submit" variant="primary">
                Add banner
              </Btn>
            </div>
          </form>
          <PanelTable
            cols={[
              { key: 'title', label: 'Text' },
              { key: 'city', label: 'City' },
              {
                key: 'dates',
                label: 'Schedule',
                render: (r) =>
                  `${r.startDate ? new Date(r.startDate).toLocaleDateString() : '—'} → ${
                    r.endDate ? new Date(r.endDate).toLocaleDateString() : '—'
                  }`
              },
              {
                key: 'isActive',
                label: 'Active',
                render: (r) => (
                  <OnOffSwitch
                    checked={!!r.isActive}
                    onChange={(next) => patchAdminBanner(r._id, { isActive: next }).then(refresh)}
                  />
                )
              },
              {
                key: 'del',
                label: '',
                render: (r) => (
                  <Btn
                    variant="danger"
                    onClick={async () => {
                      const ok = await askConfirm(
                        `Delete banner "${r.title || r.name || 'this banner'}"? This cannot be undone.`,
                        'Delete banner'
                      );
                      if (!ok) return;
                      try {
                        await deleteAdminBanner(r._id);
                        notify('Banner deleted');
                        refresh();
                      } catch (err) {
                        notify(err.message);
                      }
                    }}
                  >
                    Delete
                  </Btn>
                )
              }
            ]}
            rows={banners}
          />
        </div>
      );
    }

    if (tab === 'notifications') {
      return (
        <div className="space-y-4">
          <form
            className="grid gap-2 max-w-lg p-3 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await sendAdminNotification({
                  title: fd.get('title'),
                  body: fd.get('body'),
                  audience: fd.get('audience') || 'all',
                  channels: { app: true, email: fd.get('email') === '1' }
                });
                notify('Notification sent');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <FormField label="Title *">
              <input name="title" className={inputCls} required />
            </FormField>
            <FormField label="Message *">
              <textarea name="body" className={inputCls} rows={2} required />
            </FormField>
            <FormField label="Audience">
              <select name="audience" className={inputCls}>
                <option value="all">All</option>
                <option value="customers">Customers</option>
                <option value="sellers">Sellers</option>
                <option value="delivery">Delivery</option>
                <option value="franchise">Franchise</option>
              </select>
            </FormField>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" name="email" value="1" />
              Also queue email channel (SMTP later)
            </label>
            <Btn type="submit" variant="primary">
              Send
            </Btn>
          </form>
          <PanelTable
            cols={[
              { key: 'title', label: 'Title' },
              { key: 'audience', label: 'Audience' },
              { key: 'sentCount', label: 'Sent' },
              { key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString() }
            ]}
            rows={notifications}
          />
        </div>
      );
    }

    if (tab === 'cities') {
      // Cities = live coverage only. Franchise pending/rejected PINs stay under PIN approvals — never here.
      const serviceAreas = cities.filter((c) => {
        if (!c.franchiseId) return true;
        return c.pinCodeStatus === 'approved';
      });
      return (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-600">
            Platform delivery coverage only. Franchise PIN approve:{' '}
            <button
              type="button"
              className="underline font-black text-slate-900"
              onClick={() => goTo('franchises_pins')}
            >
              Franchise → PIN approvals
            </button>
          </p>
          <form
            className="grid sm:grid-cols-3 gap-2 p-3 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await createAdminCity({
                  city: fd.get('city'),
                  pincode: fd.get('pincode'),
                  area: fd.get('area') || fd.get('city'),
                  state: fd.get('state') || 'UP',
                  lat: Number(fd.get('lat')) || 28.5,
                  lng: Number(fd.get('lng')) || 77.3,
                  isActive: true,
                  pinCodeStatus: 'approved'
                });
                notify('Service area added');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <FormField label="City *">
              <input name="city" className={inputCls} required />
            </FormField>
            <FormField label="Pincode *">
              <input name="pincode" className={inputCls} required />
            </FormField>
            <FormField label="Area">
              <input name="area" className={inputCls} />
            </FormField>
            <FormField label="State">
              <input name="state" className={inputCls} defaultValue="UP" />
            </FormField>
            <div className="flex items-end">
              <Btn type="submit" variant="primary">
                Add city
              </Btn>
            </div>
          </form>
          <PanelTable
            cols={[
              { key: 'city', label: 'City' },
              { key: 'pincode', label: 'PIN' },
              { key: 'area', label: 'Area' },
              {
                key: 'isActive',
                label: 'Active',
                render: (r) => (
                  <OnOffSwitch
                    checked={!!r.isActive}
                    onChange={(next) => patchAdminCity(r._id, { isActive: next }).then(refresh)}
                  />
                )
              }
            ]}
            rows={serviceAreas}
          />
        </div>
      );
    }

    if (tab === 'delivery_charges') {
      return (
        <div className="space-y-3">
          <Btn
            variant="primary"
            onClick={() =>
              setDeliveryRules((rules) => [
                ...rules,
                {
                  name: 'New rule',
                  city: '',
                  pincode: '',
                  charge: 20,
                  minOrderValue: 0,
                  freeDeliveryAbove: 300,
                  isActive: true
                }
              ])
            }
          >
            Add rule
          </Btn>
          {deliveryRules.map((rule, idx) => (
            <div key={idx} className="grid sm:grid-cols-4 lg:grid-cols-7 gap-2 p-2 rounded-lg border bg-white items-center">
              {[
                ['name', 'Name', (r) => r.name ?? r.label ?? ''],
                ['city', 'City', (r) => r.city ?? ''],
                ['pincode', 'PIN', (r) => r.pincode ?? ''],
                ['charge', 'Charge (₹)', (r) => r.charge ?? r.fee ?? 0],
                ['minOrderValue', 'Min order', (r) => r.minOrderValue ?? r.minOrder ?? 0],
                ['freeDeliveryAbove', 'Free above', (r) => r.freeDeliveryAbove ?? 300]
              ].map(([f, label, getVal]) => (
                <FormField key={f} label={label}>
                  <input
                    className={inputCls}
                    value={getVal(rule)}
                    onChange={(e) => {
                      const num = ['charge', 'minOrderValue', 'freeDeliveryAbove'].includes(f);
                      const v = num ? Number(e.target.value) : e.target.value;
                      setDeliveryRules((arr) =>
                        arr.map((r, i) => (i === idx ? { ...r, [f]: v } : r))
                      );
                    }}
                  />
                </FormField>
              ))}
              <div className="flex items-center gap-2">
                <OnOffSwitch
                  checked={rule.isActive !== false}
                  onChange={(next) =>
                    setDeliveryRules((arr) => arr.map((r, i) => (i === idx ? { ...r, isActive: next } : r)))
                  }
                />
                <span className="text-[10px] font-bold text-slate-600">Active</span>
              </div>
            </div>
          ))}
          <Btn
            variant="primary"
            onClick={() =>
              saveAdminDeliveryCharges({
                deliveryCharges: deliveryRules.map((r) => ({
                  name: r.name || r.label || 'Rule',
                  city: r.city || '',
                  pincode: r.pincode || '',
                  charge: Number(r.charge ?? r.fee ?? 20),
                  minOrderValue: Number(r.minOrderValue ?? r.minOrder ?? 0),
                  freeDeliveryAbove: Number(r.freeDeliveryAbove ?? r.maxOrder ?? 300),
                  isActive: r.isActive !== false
                }))
              }).then(() => notify('Delivery charges saved'))
            }
          >
            Save all rules
          </Btn>
        </div>
      );
    }

    if (tab === 'tax') {
      const catRows = taxInfo?.gstByCategory || [];
      return (
        <div className="space-y-4">
          <div className="max-w-lg space-y-3 p-4 rounded-xl border bg-white">
            <p className="text-xs font-bold text-slate-600">
              GST collected: {money(taxInfo?.collection?.gstCollected)} · Invoices:{' '}
              {taxInfo?.collection?.invoices || 0}
            </p>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Default GST %</span>
              <input className={inputCls} defaultValue={taxInfo?.defaultGstPct ?? 5} id="gst-pct" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="primary"
                onClick={() => {
                  const el = document.getElementById('gst-pct');
                  patchAdminTax({ defaultGstPct: Number(el?.value) }).then(() => {
                    notify('Tax config saved');
                    refresh();
                  });
                }}
              >
                Save GST
              </Btn>
              <Btn
                onClick={() =>
                  downloadAdminReportCsv({ type: 'gst', range: 'yearly' }).then(() =>
                    notify('GST report downloaded')
                  )
                }
              >
                Download GST report
              </Btn>
            </div>
            <form
              className="grid sm:grid-cols-3 gap-2 pt-2 border-t"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const slug = String(fd.get('categorySlug') || '').trim();
                const gstPct = Number(fd.get('gstPct'));
                if (!slug) return;
                const next = [
                  ...(taxInfo?.gstByCategory || []).filter((x) => x.categorySlug !== slug),
                  { categorySlug: slug, gstPct }
                ];
                patchAdminTax({ gstByCategory: next }).then(() => {
                  notify('Category GST saved');
                  e.target.reset();
                  refresh();
                });
              }}
            >
              <FormField label="Category slug *">
                <input name="categorySlug" className={inputCls} required />
              </FormField>
              <FormField label="GST % *">
                <input name="gstPct" className={inputCls} required />
              </FormField>
              <div className="flex items-end">
                <Btn type="submit" variant="primary">
                  Add / update category GST
                </Btn>
              </div>
            </form>
          </div>
          <PanelTable
            cols={[
              { key: 'categorySlug', label: 'Category' },
              { key: 'gstPct', label: 'GST %' },
              {
                key: 'del',
                label: '',
                render: (r) => (
                  <Btn
                    variant="danger"
                    onClick={async () => {
                      const ok = await askConfirm(
                        `Remove GST rule for "${r.categorySlug}"?`,
                        'Remove GST rule'
                      );
                      if (!ok) return;
                      try {
                        await patchAdminTax({
                          gstByCategory: (taxInfo?.gstByCategory || []).filter(
                            (x) => x.categorySlug !== r.categorySlug
                          )
                        });
                        notify('GST rule removed');
                        refresh();
                      } catch (err) {
                        notify(err.message);
                      }
                    }}
                  >
                    Remove
                  </Btn>
                )
              }
            ]}
            rows={catRows}
          />
          <h3 className="font-black text-sm text-slate-800">GST invoices (recent)</h3>
          <PanelTable
            cols={[
              { key: 'orderNumber', label: 'Invoice / Order' },
              { key: 'customerName', label: 'Customer' },
              { key: 'gstPct', label: 'GST %' },
              { key: 'gstAmount', label: 'GST', render: (r) => money(r.gstAmount) },
              { key: 'grandTotal', label: 'Total', render: (r) => money(r.grandTotal) },
              {
                key: 'createdAt',
                label: 'Date',
                render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—')
              }
            ]}
            rows={taxInfo?.invoices || []}
          />
        </div>
      );
    }

    if (tab === 'categories_ops') {
      return <AdminCategoryMaster onNotify={notify} askConfirm={askConfirm} />;
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <h1 className="font-black text-slate-900 text-sm">Japto Admin</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1">{user?.name || 'Super Admin'}</p>
        </div>
        <nav className="p-2 flex-1 space-y-1">
          {NAV_GROUPS.map((group) => {
            const isOpen = !!openGroups[group.id];
            const hasActive = group.items.some((i) => i.id === tab);
            const groupBadge =
              group.id === 'franchise'
                ? Number(adminBadges.franchiseTotal || 0) ||
                  pendingPinCount +
                    Number(adminBadges.franchisePendingApps || 0) +
                    Number(adminBadges.franchisePendingBank || 0)
                : group.id === 'users'
                  ? Number(adminBadges.pendingSellers || 0) + Number(adminBadges.pendingRiders || 0)
                  : group.id === 'catalog'
                    ? Number(adminBadges.pendingProducts || 0)
                    : group.id === 'commerce'
                      ? Number(adminBadges.pendingSupport || 0) +
                        Number(adminBadges.pendingCancels || 0)
                      : 0;
            return (
              <div key={group.id} className="rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    if (group.items.length === 1) {
                      goTo(group.items[0].id);
                      return;
                    }
                    toggleGroup(group.id);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[11px] font-black transition ${
                    hasActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-1.5">
                    {groupBadge > 0 ? (
                      <span className="min-w-[1.15rem] text-center rounded-full px-1 py-0.5 text-[10px] bg-amber-500 text-white">
                        {groupBadge}
                      </span>
                    ) : null}
                    {group.items.length > 1 ? (
                      <span className="text-slate-400 text-[10px]">{isOpen ? '▾' : '▸'}</span>
                    ) : null}
                  </span>
                </button>
                {group.items.length > 1 && isOpen ? (
                  <div className="mt-0.5 ml-2 pl-2 border-l border-slate-200 space-y-0.5">
                    {group.items.map((item) => {
                      const active = tab === item.id;
                      const itemBadge =
                        item.badge === 'pins'
                          ? pendingPinCount || Number(adminBadges.franchisePendingPins || 0)
                          : item.badge === 'franchiseApps'
                            ? Number(adminBadges.franchisePendingApps || 0) +
                              Number(adminBadges.franchisePendingBank || 0)
                            : item.id === 'sellers'
                              ? Number(adminBadges.pendingSellers || 0)
                              : item.id === 'delivery'
                                ? Number(adminBadges.pendingRiders || 0)
                                : item.id === 'products_pending'
                                  ? Number(adminBadges.pendingProducts || 0)
                                  : item.id === 'orders'
                                    ? Number(adminBadges.pendingCancels || 0)
                                    : item.id === 'complaints'
                                      ? Number(adminBadges.pendingSupport || 0)
                                      : 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => goTo(item.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-bold transition ${
                            active
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span>{item.label}</span>
                            {itemBadge > 0 ? (
                              <span
                                className={`min-w-[1.15rem] text-center rounded-full px-1 py-0.5 text-[10px] ${
                                  active ? 'bg-white text-slate-900' : 'bg-amber-500 text-white'
                                }`}
                              >
                                {itemBadge}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex justify-between items-center gap-2 flex-wrap">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {activeNav?.groupLabel || 'Admin'}
            </p>
            <h2 className="font-black text-slate-900 text-sm">{activeNav?.label || 'Dashboard'}</h2>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  setBellOpen((o) => !o);
                  loadAdminInbox();
                }}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                title="Notifications (click once to enable sound)"
                aria-label="Notifications"
              >
                <span className="text-base leading-none" aria-hidden>
                  🔔
                </span>
                {Number(adminBadges.unreadAlerts || 0) > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-full bg-rose-600 px-1 text-center text-[10px] font-black text-white">
                    {adminBadges.unreadAlerts > 99 ? '99+' : adminBadges.unreadAlerts}
                  </span>
                ) : null}
              </button>
              {bellOpen ? (
                <div className="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-black text-slate-900">Admin notifications</p>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-emerald-700 underline"
                      onClick={async () => {
                        try {
                          await markAllAdminAlertsRead();
                          await loadAdminInbox();
                        } catch (err) {
                          notify(err.message);
                        }
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {inboxAlerts.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs font-semibold text-slate-500">
                        No pending notifications
                      </p>
                    ) : (
                      inboxAlerts.map((a) => (
                        <button
                          key={a._id}
                          type="button"
                          className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 ${
                            a.read ? 'opacity-70' : 'bg-amber-50/40'
                          }`}
                          onClick={async () => {
                            try {
                              if (!a.read) await markAdminAlertRead(a._id);
                              setBellOpen(false);
                              if (a.linkTab) goTo(a.linkTab);
                              if (a.entityType === 'franchise' && a.entityId) {
                                const list = await getAdminFranchises();
                                const rows = pickData(list) || [];
                                const hit = rows.find(
                                  (x) => String(x._id) === String(a.entityId)
                                );
                                if (hit) setFranchiseDetail(hit);
                              }
                              await loadAdminInbox();
                            } catch (err) {
                              notify(err.message);
                            }
                          }}
                        >
                          <p className="text-[11px] font-black text-slate-900">{a.title}</p>
                          <p className="text-[10px] font-semibold text-slate-600 mt-0.5 line-clamp-2">
                            {a.body}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 mt-1">
                            {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                            {!a.read ? ' · New' : ''}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <Btn onClick={onNavigateCustomer}>Storefront</Btn>
            <Btn
              onClick={() => {
                refresh();
                loadAdminInbox();
              }}
            >
              Refresh
            </Btn>
            <Btn variant="primary" onClick={onLogout}>
              Logout
            </Btn>
          </div>
        </header>

        <main className="p-4 sm:p-6 flex-1">
          {loading ? (
            <p className="text-xs font-bold text-slate-500 mb-3">Loading…</p>
          ) : null}
          {flash && (
            <div className="mb-4 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {flash}
            </div>
          )}
          {renderMain()}
        </main>
      </div>

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        onYes={() => closeConfirm(true)}
        onNo={() => closeConfirm(false)}
      />
    </div>
  );
}