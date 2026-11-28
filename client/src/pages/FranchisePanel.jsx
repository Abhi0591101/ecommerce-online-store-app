import { useCallback, useEffect, useState } from 'react';
import NotificationBell from '../components/NotificationBell';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { useAuth } from '../context/AuthContext';
import {
  addFranchisePartner,
  changeFranchisePassword,
  contactFranchiseHeadOffice,
  getFranchiseBank,
  getFranchiseCommission,
  getFranchiseDashboard,
  getFranchiseMe,
  getFranchiseNotices,
  getFranchisePartners,
  getFranchisePayments,
  getFranchisePins,
  markAllFranchiseNoticesRead,
  markFranchiseNoticeRead,
  patchFranchiseMe,
  requestFranchiseBankChange,
  requestFranchisePin,
  sendFranchiseOtp
} from '../services/api';

const TAB_KEY = 'japto_franchise_tab';
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'partners', label: 'Delivery partners' },
  { id: 'pins', label: 'PIN codes' },
  { id: 'commission', label: 'Commission' },
  { id: 'payments', label: 'Payments' },
  { id: 'profile', label: 'Profile' },
  { id: 'bank', label: 'Bank' },
  { id: 'notices', label: 'Notices' },
  { id: 'contact', label: 'Head Office' },
  { id: 'security', label: 'Security' }
];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pickData = (res) => res?.data ?? res;
const pickList = (res) => {
  const d = pickData(res);
  return Array.isArray(d) ? d : d?.data ?? d?.rows ?? [];
};
const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-white';

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

function PanelTable({ cols, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2 font-black text-slate-700 whitespace-nowrap">
                {c.label}
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
              <tr key={row._id || i} className="border-b border-slate-100">
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

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-black text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export default function FranchisePanel({ onNavigateCustomer, onLogout }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem(TAB_KEY) || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [flash, setFlash] = useState('');
  const [overview, setOverview] = useState(null);
  const [franchise, setFranchise] = useState(null);
  const [headOffice, setHeadOffice] = useState(null);
  const [partners, setPartners] = useState([]);
  const [pins, setPins] = useState({ approvedPins: [], requests: [] });
  const [commission, setCommission] = useState(null);
  const [payments, setPayments] = useState([]);
  const [bank, setBank] = useState(null);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  const notify = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  };

  const refresh = useCallback(async () => {
    try {
      if (tab === 'dashboard') {
        const r = await getFranchiseDashboard();
        const d = pickData(r);
        setOverview(d?.overview);
        setFranchise(d?.franchise);
      } else if (tab === 'partners') {
        const r = await getFranchisePartners();
        setPartners(pickList(r));
      } else if (tab === 'pins') {
        const r = await getFranchisePins();
        setPins(pickData(r) || { approvedPins: [], requests: [] });
      } else if (tab === 'commission') {
        const r = await getFranchiseCommission();
        setCommission(pickData(r));
      } else if (tab === 'payments') {
        const r = await getFranchisePayments();
        setPayments(pickList(r));
      } else if (tab === 'profile' || tab === 'contact' || tab === 'security') {
        const r = await getFranchiseMe();
        const d = pickData(r);
        setFranchise(d?.franchise);
        setHeadOffice(d?.headOffice);
      } else if (tab === 'bank') {
        const r = await getFranchiseBank();
        setBank(pickData(r));
      } else if (tab === 'notices') {
        const r = await getFranchiseNotices();
        setNotices(pickList(r));
      }
    } catch (e) {
      notify(e.message || 'Load failed');
    }
  }, [tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const renderMain = () => {
    if (tab === 'dashboard') {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Total delivery partners" value={overview?.totalPartners ?? 0} />
          <StatCard label="Active partners" value={overview?.activePartners ?? 0} />
          <StatCard label="Successful deliveries" value={overview?.totalSuccessfulDeliveries ?? 0} />
          <StatCard label="This week deliveries" value={overview?.weekDeliveries ?? 0} />
          <StatCard label="This week commission" value={money(overview?.weekCommission)} />
          <StatCard label="Total paid commission" value={money(overview?.totalPaidCommission)} />
        </div>
      );
    }

    if (tab === 'partners') {
      return (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            New partners need Admin approval before they can work. Active/Inactive is Admin-only.
          </p>
          <form
            className="grid sm:grid-cols-4 gap-2 p-3 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await addFranchisePartner({
                  name: fd.get('name'),
                  phone: fd.get('phone'),
                  city: fd.get('city') || franchise?.city,
                  pincode: fd.get('pincode')
                });
                notify('Partner submitted for Admin approval');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <input name="name" placeholder="Name" className={inputCls} required />
            <input name="phone" placeholder="Mobile" className={inputCls} required />
            <input name="pincode" placeholder="Work PIN" className={inputCls} />
            <Btn type="submit" variant="primary">
              Add partner
            </Btn>
          </form>
          <PanelTable
            cols={[
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Mobile' },
              {
                key: 'pins',
                label: 'Work area PINs',
                render: (r) => (r.workPins || []).join(', ') || '—'
              },
              { key: 'status', label: 'Status' },
              {
                key: 'active',
                label: 'Active',
                render: (r) => (r.isActive === false ? 'No (Admin)' : 'Yes')
              }
            ]}
            rows={partners}
          />
        </div>
      );
    }

    if (tab === 'pins') {
      return (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            Approved PINs: {(pins.approvedPins || []).join(', ') || '—'}
          </p>
          <form
            className="flex flex-wrap gap-2 p-3 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await requestFranchisePin({
                  pincode: fd.get('pincode'),
                  area: fd.get('area')
                });
                notify('PIN request sent to Admin');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <input name="pincode" placeholder="New PIN" className={inputCls + ' max-w-[140px]'} required />
            <input name="area" placeholder="Area name" className={inputCls + ' max-w-[180px]'} />
            <Btn type="submit" variant="primary">
              Request PIN
            </Btn>
          </form>
          <PanelTable
            cols={[
              { key: 'pincode', label: 'PIN' },
              { key: 'area', label: 'Area' },
              { key: 'pinCodeStatus', label: 'Status' },
              {
                key: 'active',
                label: 'Active',
                render: (r) => (r.isActive ? 'Yes' : 'No')
              }
            ]}
            rows={pins.requests || []}
          />
        </div>
      );
    }

    if (tab === 'commission') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total" value={money(commission?.total)} />
            <StatCard label="This week" value={money(commission?.week)} />
            <StatCard label="Paid" value={money(commission?.paid)} />
            <StatCard label="Pending" value={money(commission?.pending)} />
          </div>
          <PanelTable
            cols={[
              {
                key: 'at',
                label: 'Date',
                render: (r) => (r.at ? new Date(r.at).toLocaleString() : '—')
              },
              { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
              { key: 'note', label: 'Detail' },
              { key: 'status', label: 'Status' }
            ]}
            rows={commission?.rows || []}
          />
        </div>
      );
    }

    if (tab === 'payments') {
      return (
        <PanelTable
          cols={[
            {
              key: 'paidAt',
              label: 'Date',
              render: (r) => (r.paidAt ? new Date(r.paidAt).toLocaleString() : '—')
            },
            { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
            { key: 'note', label: 'Detail' },
            { key: 'status', label: 'Status' }
          ]}
          rows={payments}
        />
      );
    }

    if (tab === 'profile' && franchise) {
      return (
        <form
          className="max-w-lg grid sm:grid-cols-2 gap-2 p-4 rounded-xl border bg-white"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
              await patchFranchiseMe({
                name: fd.get('name'),
                ownerName: fd.get('ownerName'),
                email: fd.get('email'),
                address: fd.get('address')
              });
              notify('Profile saved');
              refresh();
            } catch (err) {
              notify(err.message);
            }
          }}
        >
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-black text-slate-500">Franchise name</span>
            <input name="name" defaultValue={franchise.name} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-[10px] font-black text-slate-500">Name</span>
            <input name="ownerName" defaultValue={franchise.ownerName} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-[10px] font-black text-slate-500">Mobile</span>
            <input value={franchise.phone} className={inputCls} disabled />
          </label>
          <label className="block">
            <span className="text-[10px] font-black text-slate-500">Email</span>
            <input name="email" defaultValue={franchise.email} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-black text-slate-500">Full address</span>
            <textarea name="address" defaultValue={franchise.address} className={inputCls} rows={2} />
          </label>
          <Btn type="submit" variant="primary">
            Save profile
          </Btn>
        </form>
      );
    }

    if (tab === 'bank') {
      return (
        <div className="space-y-4 max-w-lg">
          <div className="p-4 rounded-xl border bg-white text-xs font-semibold text-slate-700 space-y-1">
            <p>Account holder: {bank?.accountHolder || '—'}</p>
            <p>Account number: {bank?.accountNumber || '—'}</p>
            <p>IFSC: {bank?.ifsc || '—'}</p>
            <p>
              Pending change: {bank?.pendingBankChange?.status || 'none'}
              {bank?.pendingBankChange?.status === 'pending'
                ? ' — old details remain valid until Admin approves'
                : ''}
            </p>
          </div>
          <form
            className="grid gap-2 p-4 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await requestFranchiseBankChange({
                  accountHolder: fd.get('accountHolder'),
                  accountNumber: fd.get('accountNumber'),
                  ifsc: fd.get('ifsc')
                });
                notify('Bank change request sent');
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <input name="accountHolder" placeholder="Account holder" className={inputCls} required />
            <input name="accountNumber" placeholder="Account number" className={inputCls} required />
            <input name="ifsc" placeholder="IFSC" className={inputCls} required />
            <Btn type="submit" variant="primary">
              Request bank change
            </Btn>
          </form>
        </div>
      );
    }

    if (tab === 'notices') {
      return (
        <div className="space-y-2">
          {notices.map((n) => (
            <div
              key={n._id}
              className={`p-3 rounded-xl border ${n.read ? 'bg-white border-slate-200' : 'bg-emerald-50 border-emerald-200'}`}
            >
              <div className="flex justify-between gap-2">
                <p className="text-xs font-black text-slate-900">{n.title}</p>
                {!n.read ? (
                  <Btn onClick={() => markFranchiseNoticeRead(n._id).then(refresh)}>Mark read</Btn>
                ) : null}
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-1">{n.body}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
              </p>
            </div>
          ))}
          {!notices.length ? <p className="text-xs font-bold text-slate-400">No notices</p> : null}
        </div>
      );
    }

    if (tab === 'contact') {
      return (
        <div className="space-y-4 max-w-lg">
          <div className="p-4 rounded-xl border bg-white text-xs font-semibold text-slate-700 space-y-1">
            <p>Head Office phone: {headOffice?.phone || '—'}</p>
            <p>Email: {headOffice?.email || '—'}</p>
            <p>Address: {headOffice?.address || '—'}</p>
          </div>
          <form
            className="grid gap-2 p-4 rounded-xl border bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await contactFranchiseHeadOffice({
                  subject: fd.get('subject'),
                  message: fd.get('message')
                });
                notify('Message queued to Head Office');
                e.target.reset();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <input name="subject" placeholder="Subject" className={inputCls} />
            <textarea name="message" placeholder="Message" className={inputCls} rows={3} required />
            <Btn type="submit" variant="primary">
              Email Head Office
            </Btn>
          </form>
        </div>
      );
    }

    if (tab === 'security') {
      return (
        <SecurityPasswordForm
          phone={user?.phone || franchise?.phone}
          notify={notify}
          changeFranchisePassword={changeFranchisePassword}
          sendFranchiseOtp={sendFranchiseOtp}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <h1 className="font-black text-slate-900 text-sm">Franchise Panel</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1">{user?.name || franchise?.name}</p>
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
          <h2 className="font-black text-slate-900 text-sm">{TABS.find((t) => t.id === tab)?.label}</h2>
          <div className="flex gap-2 items-center">
            <NotificationBell
              title="Franchise notices"
              fetchInbox={async () => {
                const res = await getFranchiseNotices();
                const rows = res?.data ?? res ?? [];
                const list = Array.isArray(rows) ? rows : [];
                return {
                  items: list.map((n) => ({
                    ...n,
                    id: n._id,
                    body: n.body || ''
                  })),
                  unread: list.filter((n) => !n.read).length
                };
              }}
              onMarkRead={(n) => markFranchiseNoticeRead(n._id || n.id)}
              onMarkAllRead={markAllFranchiseNoticesRead}
            />
            <Btn onClick={onNavigateCustomer}>Storefront</Btn>
            <Btn onClick={refresh}>Refresh</Btn>
            <Btn variant="primary" onClick={onLogout}>
              Logout
            </Btn>
          </div>
        </header>
        <main className="p-4 sm:p-6 flex-1">
          {flash ? (
            <div className="mb-4 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {flash}
            </div>
          ) : null}
          {renderMain()}
        </main>
      </div>
    </div>
  );
}

function SecurityPasswordForm({
  phone,
  notify,
  changeFranchisePassword: changePw,
  sendFranchiseOtp: sendOtp
}) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      className="max-w-md grid gap-2 p-4 rounded-xl border bg-white"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        if (String(newPassword).length < 6) {
          notify('Password must be at least 6 characters');
          return;
        }
        try {
          await changePw({
            phone,
            otp: fd.get('otp'),
            newPassword
          });
          notify('Password updated');
          e.target.reset();
          setNewPassword('');
        } catch (err) {
          notify(err.message);
        }
      }}
    >
      <p className="text-xs font-semibold text-slate-500">
        OTP आपके registered mobile पर भेजा जाएगा
      </p>
      <div className="flex gap-2">
        <input name="otp" placeholder="OTP" className={inputCls} required />
        <Btn
          type="button"
          onClick={async () => {
            try {
              const r = await sendOtp({
                phone,
                purpose: 'reset'
              });
              notify(r.message || 'OTP sent');
            } catch (err) {
              notify(err.message);
            }
          }}
        >
          Send OTP
        </Btn>
      </div>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="New password"
          className={`${inputCls} pr-14`}
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-700 px-2"
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
      <PasswordStrengthMeter password={newPassword} />
      <Btn type="submit" variant="primary">
        Change password
      </Btn>
    </form>
  );
}
