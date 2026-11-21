import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  getAdminFranchises,
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

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customers', label: 'Customers' },
  { id: 'sellers', label: 'Sellers' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'franchises', label: 'Franchises' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'commission', label: 'Commission' },
  { id: 'reports', label: 'Reports' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'settings', label: 'Settings' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'banners', label: 'Banners' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'cities', label: 'Cities' },
  { id: 'delivery_charges', label: 'Delivery charges' },
  { id: 'tax', label: 'Tax' },
  { id: 'categories_ops', label: 'Category Master' }
];

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

export default function AdminPanel({ onNavigateCustomer, onLogout, onOpenLegacyOps }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem('japto_admin_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('japto_admin_tab', tab);
    } catch {
      /* ignore */
    }
  }, [tab]);
  const [flash, setFlash] = useState('');
  const [loading, setLoading] = useState(true);

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
  const [productFilter, setProductFilter] = useState({ q: '', approvalStatus: '', isActive: '' });
  const [orders, setOrders] = useState([]);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderFilter, setOrderFilter] = useState({ status: '', paymentMode: '' });
  const [payments, setPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState({ paymentMode: '', paymentStatus: '', refundStatus: '' });
  const [commission, setCommission] = useState(null);
  const [commissionPct, setCommissionPct] = useState('');
  const [franchiseCommissionPct, setFranchiseCommissionPct] = useState('');
  const [reports, setReports] = useState({ type: 'sales', range: 'monthly', rows: [] });
  const [complaints, setComplaints] = useState([]);
  const [complaintFilter, setComplaintFilter] = useState({ source: '', status: '' });
  const [settings, setSettings] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [banners, setBanners] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [cities, setCities] = useState([]);
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
        const r = await getAdminDashboard();
        setDashboard(pickData(r));
      } else if (tab === 'customers') {
        const r = await getAdminCustomers();
        setCustomers(pickData(r) || []);
        setCustomerDetail(null);
      } else if (tab === 'sellers') {
        const r = await getAdminSellers(sellerFilter ? { status: sellerFilter } : {});
        setSellers(pickData(r) || []);
        setSellerDetail(null);
      } else if (tab === 'delivery') {
        const r = await getAdminDeliveryPartners();
        setRiders(pickData(r) || []);
        setRiderDetail(null);
      } else if (tab === 'franchises') {
        const r = await getAdminFranchises();
        setFranchises(pickData(r) || []);
        setFranchiseDetail(null);
      } else if (tab === 'products') {
        const params = {};
        if (productFilter.q) params.q = productFilter.q;
        if (productFilter.approvalStatus) params.approvalStatus = productFilter.approvalStatus;
        if (productFilter.isActive) params.isActive = productFilter.isActive;
        const [all, pending, tree] = await Promise.all([
          getAdminProducts(params),
          getPendingProducts(),
          getCategoryTree(true)
        ]);
        setProducts(pickData(all) || []);
        setPendingProducts(pickData(pending) || []);
        setCategoryTree(pickData(tree) || []);
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
        const r = await getAdminCities();
        setCities(pickData(r) || []);
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
    productFilter,
    orderFilter,
    paymentFilter,
    complaintFilter,
    reports.type,
    reports.range
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
              <Btn
                variant="ok"
                onClick={() =>
                  patchAdminCustomer(customer._id, { isActive: !customer.isActive }).then(() => {
                    notify(customer.isActive ? 'Suspended' : 'Activated');
                    loadCustomer(customer._id);
                  })
                }
              >
                {customer.isActive === false ? 'Activate' : 'Suspend'}
              </Btn>
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
                <Btn
                  variant={r.isActive === false ? 'ok' : 'danger'}
                  onClick={(e) => {
                    e.stopPropagation();
                    patchAdminCustomer(r._id, { isActive: r.isActive === false }).then(refresh);
                  }}
                >
                  {r.isActive === false ? 'Activate' : 'Suspend'}
                </Btn>
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
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={() => setSellerDetail(null)}>← Back</Btn>
              <h2 className="font-black text-slate-900">{store?.name}</h2>
              <span className="text-xs font-bold text-slate-500">{store?.status}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
              <p>Owner: {store?.ownerId?.name || '—'}</p>
              <p>Phone: {store?.ownerId?.phone || store?.phone || '—'}</p>
              <p>Email: {store?.ownerId?.email || store?.email || '—'}</p>
              <p>City: {store?.city || '—'}</p>
              <p className="sm:col-span-2">Address: {store?.address || store?.fullAddress || '—'}</p>
              <p>Decision note: {store?.decisionNote || '—'}</p>
              <p>
                Bank: {store?.bankAccount || '—'} · IFSC: {store?.ifsc || '—'}
              </p>
            </div>
            <p className="text-xs font-bold text-slate-600">
              Docs:{' '}
              {[
                ['PAN', store?.panDocUrl],
                ['GST', store?.gstDocUrl],
                ['Bank', store?.bankProofUrl],
                ['FSSAI', store?.fssaiDocUrl]
              ]
                .filter(([, u]) => u)
                .map(([label, u]) => (
                  <a key={label} href={u} target="_blank" rel="noreferrer" className="text-slate-900 underline mr-2">
                    {label}
                  </a>
                ))}
              {![store?.panDocUrl, store?.gstDocUrl, store?.bankProofUrl, store?.fssaiDocUrl].some(Boolean) && '—'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="ok"
                onClick={() =>
                  patchAdminSeller(store._id, {
                    status: 'approved',
                    decisionNote: 'Approved by admin'
                  }).then(() => {
                    notify('Seller approved');
                    loadSeller(store._id);
                  })
                }
              >
                Approve
              </Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  const decisionNote = prompt('Reject reason') || 'Rejected by admin';
                  patchAdminSeller(store._id, { status: 'rejected', decisionNote }).then(() => {
                    notify('Seller rejected');
                    loadSeller(store._id);
                  });
                }}
              >
                Reject
              </Btn>
            </div>
            <h3 className="font-black text-sm">Products</h3>
            <PanelTable
              cols={[
                { key: 'name', label: 'Product' },
                { key: 'approvalStatus', label: 'Approval' },
                { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') }
              ]}
              rows={sProds}
            />
            <h3 className="font-black text-sm">Orders</h3>
            <PanelTable
              cols={[
                { key: 'orderNumber', label: 'Order' },
                { key: 'status', label: 'Status' },
                { key: 'grandTotal', label: 'Total', render: (r) => money(r.grandTotal) }
              ]}
              rows={sOrders}
            />
            <h3 className="font-black text-sm">Complaints</h3>
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
          <PanelTable
            cols={[
              { key: 'name', label: 'Store' },
              {
                key: 'phone',
                label: 'Phone',
                render: (r) => r.ownerId?.phone || r.phone || '—'
              },
              {
                key: 'address',
                label: 'Address',
                render: (r) => r.address || r.fullAddress || r.city || '—'
              },
              { key: 'status', label: 'Status' },
              { key: 'productCount', label: 'Products' },
              { key: 'orderCount', label: 'Orders' },
              { key: 'totalSales', label: 'Sales', render: (r) => money(r.totalSales) },
              { key: 'totalEarnings', label: 'Earnings', render: (r) => money(r.totalEarnings) },
              { key: 'complaintCount', label: 'Complaints' },
              {
                key: 'docs',
                label: 'KYC',
                render: (r) =>
                  [r.panDocUrl, r.gstDocUrl].filter(Boolean).length ? (
                    <a href={r.panDocUrl || r.gstDocUrl} target="_blank" rel="noreferrer" className="underline">
                      View
                    </a>
                  ) : (
                    '—'
                  )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  <span className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Btn
                      variant="ok"
                      onClick={() =>
                        patchAdminSeller(r._id, { status: 'approved', decisionNote: 'Approved' }).then(refresh)
                      }
                    >
                      Approve
                    </Btn>
                    <Btn
                      variant="danger"
                      onClick={() => {
                        const decisionNote = prompt('Reject reason') || 'Rejected';
                        patchAdminSeller(r._id, { status: 'rejected', decisionNote }).then(refresh);
                      }}
                    >
                      Reject
                    </Btn>
                    <Btn onClick={() => patchAdminSeller(r._id, { isActive: !r.isActive }).then(refresh)}>
                      {r.isActive ? 'Deactivate' : 'Activate'}
                    </Btn>
                  </span>
                )
              }
            ]}
            rows={sellers}
            onRowClick={(r) => loadSeller(r._id)}
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
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="ok"
                onClick={() =>
                  patchAdminDeliveryPartner(d._id, { status: 'approved', statusReason: 'Approved by admin' }).then(refresh)
                }
              >
                Approve
              </Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  const reason = prompt('Reject / suspend reason') || 'Rejected by admin';
                  patchAdminDeliveryPartner(d._id, { status: 'rejected', statusReason: reason }).then(refresh);
                }}
              >
                Reject
              </Btn>
              <Btn
                onClick={() => {
                  const reason = prompt('Inactive reason') || 'Deactivated by admin';
                  patchAdminDeliveryPartner(d._id, {
                    status: 'inactive',
                    isActive: false,
                    statusReason: reason
                  }).then(refresh);
                }}
              >
                Set inactive
              </Btn>
              <Btn
                onClick={() =>
                  patchAdminDeliveryPartner(d._id, {
                    status: 'approved',
                    isActive: true,
                    statusReason: 'Reactivated'
                  }).then(refresh)
                }
              >
                Reactivate
              </Btn>
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
                <span className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <Btn onClick={() => setRiderDetail(r)}>Details / docs</Btn>
                  <Btn variant="ok" onClick={() => patchAdminDeliveryPartner(r._id, { status: 'approved' }).then(refresh)}>
                    Approve
                  </Btn>
                  <Btn variant="danger" onClick={() => patchAdminDeliveryPartner(r._id, { status: 'rejected' }).then(refresh)}>
                    Reject
                  </Btn>
                  <Btn
                    onClick={() =>
                      patchAdminDeliveryPartner(r._id, {
                        isActive: r.isActive === false,
                        status: r.isActive === false ? 'approved' : 'inactive'
                      }).then(refresh)
                    }
                  >
                    {r.isActive === false ? 'Activate' : 'Deactivate'}
                  </Btn>
                </span>
              )
            }
          ]}
          rows={riders}
          onRowClick={(r) => setRiderDetail(r)}
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
              <p>Owner: {f.ownerName || '—'}</p>
              <p>Phone: {f.phone}</p>
              <p>City: {f.city}</p>
              <p>Status: {f.status} · Active: {f.isActive ? 'Yes' : 'No'}</p>
              <p>Fee: {money(f.franchiseFee)} · GST: {money(f.gstAmount)}</p>
              <p>Delivery commission: {f.deliveryCommissionPct ?? 0}%</p>
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
            <div className="flex flex-wrap gap-2">
              <Btn
                onClick={() => {
                  const pct = prompt('Delivery commission %', String(f.deliveryCommissionPct ?? 0));
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
                  addFranchisePayment(f._id, { amount: Number(amount), note: 'Admin payment' }).then(() => {
                    notify('Payment recorded');
                    refresh();
                  });
                }}
              >
                Add payment
              </Btn>
            </div>
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
          <form
            className="grid sm:grid-cols-3 gap-2 p-3 rounded-xl border border-slate-200 bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              try {
                await createAdminFranchise({
                  name: fd.get('name'),
                  ownerName: fd.get('ownerName'),
                  phone: fd.get('phone'),
                  city: fd.get('city'),
                  franchiseFee: Number(fd.get('franchiseFee')) || 0,
                  gstAmount: Number(fd.get('gstAmount')) || 0,
                  deliveryCommissionPct: Number(fd.get('deliveryCommissionPct')) || 0,
                  agreementUrl: fd.get('agreementUrl') || '',
                  pinCodes: String(fd.get('pinCodes') || '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                });
                notify('Franchise created');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <input name="name" placeholder="Name" className={inputCls} required />
            <input name="ownerName" placeholder="Owner" className={inputCls} />
            <input name="phone" placeholder="Phone" className={inputCls} required />
            <input name="city" placeholder="City" className={inputCls} required />
            <input name="franchiseFee" placeholder="Fee ₹" className={inputCls} />
            <input name="gstAmount" placeholder="GST ₹" className={inputCls} />
            <input name="deliveryCommissionPct" placeholder="Delivery commission %" className={inputCls} />
            <input name="agreementUrl" placeholder="Agreement URL" className={inputCls} />
            <input name="pinCodes" placeholder="PIN codes (comma)" className={inputCls + ' sm:col-span-2'} />
            <Btn type="submit" variant="primary">
              Add franchise
            </Btn>
          </form>
          <PanelTable
            cols={[
              { key: 'name', label: 'Name' },
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
                    <Btn variant="ok" onClick={() => patchAdminFranchise(r._id, { status: 'approved' }).then(refresh)}>
                      Approve
                    </Btn>
                    <Btn variant="danger" onClick={() => patchAdminFranchise(r._id, { status: 'rejected' }).then(refresh)}>
                      Reject
                    </Btn>
                    <Btn
                      onClick={() => {
                        const amount = prompt('Payment amount ₹');
                        if (!amount) return;
                        addFranchisePayment(r._id, { amount: Number(amount), note: 'Admin' }).then(refresh);
                      }}
                    >
                      Payment
                    </Btn>
                    <Btn onClick={() => patchAdminFranchise(r._id, { isActive: !r.isActive }).then(refresh)}>
                      {r.isActive ? 'Deactivate' : 'Activate'}
                    </Btn>
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

    if (tab === 'products') {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className={inputCls + ' max-w-[140px]'}
              placeholder="Search"
              value={productFilter.q}
              onChange={(e) => setProductFilter((p) => ({ ...p, q: e.target.value }))}
            />
            <select
              className={inputCls + ' max-w-[140px]'}
              value={productFilter.approvalStatus}
              onChange={(e) => setProductFilter((p) => ({ ...p, approvalStatus: e.target.value }))}
            >
              <option value="">Approval</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <Btn onClick={refresh}>Apply filter</Btn>
          </div>
          {pendingProducts.length > 0 && (
            <>
              <h3 className="font-black text-sm text-slate-800">Pending approval</h3>
              <PanelTable
                cols={[
                  { key: 'name', label: 'Product' },
                  { key: 'approvalStatus', label: 'Status' },
                  {
                    key: 'act',
                    label: 'Actions',
                    render: (r) => (
                      <span className="flex gap-1">
                        <Btn variant="ok" onClick={() => patchProductApproval(r._id, 'approved').then(refresh)}>
                          Approve
                        </Btn>
                        <Btn variant="danger" onClick={() => patchProductApproval(r._id, 'rejected').then(refresh)}>
                          Reject
                        </Btn>
                      </span>
                    )
                  }
                ]}
                rows={pendingProducts}
              />
            </>
          )}
          <PanelTable
            cols={[
              { key: 'name', label: 'Name' },
              { key: 'mrp', label: 'Price', render: (r) => money(r.mrp ?? r.price) },
              { key: 'stock', label: 'Stock', render: (r) => r.stock ?? r.inventory ?? '—' },
              { key: 'approvalStatus', label: 'Approval' },
              { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  <span className="flex gap-1 flex-wrap">
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
                    <Btn onClick={() => updateProduct(r._id, { isActive: !r.isActive }).then(refresh)}>
                      Toggle
                    </Btn>
                    <Btn variant="danger" onClick={() => deleteProduct(r._id).then(refresh)}>
                      Delete
                    </Btn>
                  </span>
                )
              }
            ]}
            rows={products}
          />
          <form
            className="grid sm:grid-cols-2 gap-2 p-3 rounded-xl border border-slate-200 bg-white"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!prodCatId || !prodSubId || !prodPhoto) {
                notify('Category, subcategory & photo required');
                return;
              }
              const fd = new FormData(e.target);
              try {
                await createProduct({
                  name: fd.get('name'),
                  brand: fd.get('brand') || '',
                  unit: fd.get('unit') || 'pc',
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
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <h3 className="sm:col-span-2 font-black text-sm text-slate-800">Create master product</h3>
            <input name="name" placeholder="Name" className={inputCls} required />
            <input name="brand" placeholder="Brand" className={inputCls} />
            <input name="mrp" placeholder="MRP" className={inputCls} required />
            <input name="unit" placeholder="Unit" className={inputCls} defaultValue="pc" />
            <select className={inputCls} value={prodCatId} onChange={(e) => { setProdCatId(e.target.value); setProdSubId(''); }} required>
              <option value="">Category</option>
              {mainCategories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <select className={inputCls} value={prodSubId} onChange={(e) => setProdSubId(e.target.value)} required>
              <option value="">Subcategory</option>
              {subForMain.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setProdPhoto(await fileToDataUrl(f));
              }}
            />
            <textarea name="description" placeholder="Description" className={inputCls + ' sm:col-span-2'} rows={2} />
            <Btn type="submit" variant="primary">Create</Btn>
          </form>
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
              <p>GST: {money(o.gstAmount)} ({o.gstPct || 0}%) · Fee: {money(o.platformFee)}</p>
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
            {cancel.requested || cancel.status === 'pending' ? (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                <p className="text-xs font-black text-amber-900">
                  Cancellation request: {cancel.status || 'pending'}
                </p>
                <p className="text-xs font-semibold text-amber-800">{cancel.reason || '—'}</p>
                <div className="flex gap-2">
                  <Btn
                    variant="ok"
                    onClick={() =>
                      patchAdminOrder(o._id, {
                        cancellationDecision: 'approved',
                        adminNote: 'Approved by admin'
                      }).then(() => {
                        notify('Cancellation approved');
                        refresh();
                      })
                    }
                  >
                    Approve cancel
                  </Btn>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      const adminNote = prompt('Reject note') || 'Rejected';
                      patchAdminOrder(o._id, { cancellationDecision: 'rejected', adminNote }).then(() => {
                        notify('Cancellation rejected');
                        refresh();
                      });
                    }}
                  >
                    Reject cancel
                  </Btn>
                </div>
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
            <Btn
              variant="primary"
              onClick={() =>
                patchAdminCommissionConfig({
                  sellerCommissionPct: Number(commissionPct),
                  franchiseDeliveryCommissionPct: Number(franchiseCommissionPct)
                }).then(() => {
                  notify('Config saved');
                  refresh();
                })
              }
            >
              Save %
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
              Pending: {money(commission?.pendingCommission)} · Paid: {money(commission?.paidCommission)}
            </p>
          </div>
          <PanelTable
            cols={[
              { key: 'orderNumber', label: 'Order' },
              { key: 'storeId', label: 'Store', render: (r) => r.storeId?.name || '—' },
              { key: 'platformFee', label: 'Commission', render: (r) => money(r.platformFee) },
              { key: 'commissionPaid', label: 'Paid', render: (r) => (r.commissionPaid ? 'Yes' : 'No') },
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
              { key: 'raisedByName', label: 'From' },
              { key: 'subject', label: 'Subject' },
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
                label: 'Reply',
                render: (r) => (
                  <Btn
                    onClick={() => {
                      const message = prompt('Reply message');
                      if (!message) return;
                      replyAdminComplaint(r._id, {
                        message,
                        status: 'resolved',
                        isSupportRequest: r.isSupportRequest
                      }).then(refresh);
                    }}
                  >
                    Reply & resolve
                  </Btn>
                )
              }
            ]}
            rows={complaints}
          />
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
          <Btn type="submit" variant="primary">Save settings</Btn>
        </form>
      );
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
            <input name="code" placeholder="CODE" className={inputCls} required />
            <select name="discountType" className={inputCls}>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed ₹</option>
            </select>
            <input name="discountValue" placeholder="Value" className={inputCls} required />
            <input name="minOrderValue" placeholder="Min order ₹" className={inputCls} />
            <input name="validFrom" type="date" className={inputCls} />
            <input name="validTo" type="date" className={inputCls} />
            <Btn type="submit" variant="primary">Add coupon</Btn>
          </form>
          <PanelTable
            cols={[
              { key: 'code', label: 'Code' },
              { key: 'discountType', label: 'Type' },
              { key: 'discountValue', label: 'Value' },
              { key: 'minOrderValue', label: 'Min order' },
              { key: 'usageCount', label: 'Used' },
              { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
              {
                key: 'toggle',
                label: 'Toggle',
                render: (r) => (
                  <Btn onClick={() => patchAdminCoupon(r._id, { isActive: !r.isActive }).then(refresh)}>
                    {r.isActive ? 'Deactivate' : 'Activate'}
                  </Btn>
                )
              },
              {
                key: 'del',
                label: '',
                render: (r) => (
                  <Btn variant="danger" onClick={() => deleteAdminCoupon(r._id).then(refresh)}>
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
            <input name="imageUrl" placeholder="Image URL" className={inputCls} id="banner-url" />
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await fileToDataUrl(f);
                const el = document.getElementById('banner-url');
                if (el) el.value = url;
              }}
            />
            <input name="title" placeholder="Text" className={inputCls} />
            <input name="linkUrl" placeholder="Link" className={inputCls} />
            <input name="city" placeholder="City (blank = all)" className={inputCls} />
            <input name="startDate" type="date" className={inputCls} />
            <input name="endDate" type="date" className={inputCls} />
            <Btn type="submit" variant="primary">Add banner</Btn>
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
              { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
              {
                key: 'toggle',
                label: 'Toggle',
                render: (r) => (
                  <Btn onClick={() => patchAdminBanner(r._id, { isActive: !r.isActive }).then(refresh)}>
                    {r.isActive ? 'Deactivate' : 'Activate'}
                  </Btn>
                )
              },
              {
                key: 'del',
                label: '',
                render: (r) => (
                  <Btn variant="danger" onClick={() => deleteAdminBanner(r._id).then(refresh)}>
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
            <input name="title" placeholder="Title" className={inputCls} required />
            <textarea name="body" placeholder="Message" className={inputCls} rows={2} required />
            <select name="audience" className={inputCls}>
              <option value="all">All</option>
              <option value="customers">Customers</option>
              <option value="sellers">Sellers</option>
              <option value="delivery">Delivery</option>
              <option value="franchise">Franchise</option>
            </select>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input type="checkbox" name="email" value="1" />
              Also queue email channel (SMTP later)
            </label>
            <Btn type="submit" variant="primary">Send</Btn>
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
      return (
        <div className="space-y-4">
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
                  franchiseId: fd.get('franchiseId') || undefined,
                  isActive: true
                });
                notify('Service area added');
                e.target.reset();
                refresh();
              } catch (err) {
                notify(err.message);
              }
            }}
          >
            <input name="city" placeholder="City" className={inputCls} required />
            <input name="pincode" placeholder="Pincode" className={inputCls} required />
            <input name="area" placeholder="Area" className={inputCls} />
            <input name="state" placeholder="State" className={inputCls} defaultValue="UP" />
            <input name="franchiseId" placeholder="Franchise ID (optional)" className={inputCls} />
            <Btn type="submit" variant="primary">Add city / PIN</Btn>
          </form>
          <PanelTable
            cols={[
              { key: 'city', label: 'City' },
              { key: 'pincode', label: 'PIN' },
              { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
              { key: 'pinCodeStatus', label: 'PIN status' },
              {
                key: 'franchiseId',
                label: 'Franchise',
                render: (r) => r.franchiseId?.name || r.franchiseId || '—'
              },
              {
                key: 'toggle',
                label: 'Edit',
                render: (r) => (
                  <span className="flex gap-1 flex-wrap">
                    <Btn onClick={() => patchAdminCity(r._id, { isActive: !r.isActive }).then(refresh)}>
                      {r.isActive ? 'Deactivate' : 'Activate'}
                    </Btn>
                    <Btn variant="ok" onClick={() => patchAdminCity(r._id, { pinCodeStatus: 'approved' }).then(refresh)}>
                      Approve PIN
                    </Btn>
                    <Btn
                      variant="danger"
                      onClick={() => patchAdminCity(r._id, { pinCodeStatus: 'rejected', isActive: false }).then(refresh)}
                    >
                      Reject PIN
                    </Btn>
                  </span>
                )
              }
            ]}
            rows={cities}
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
                ['charge', 'Charge ₹', (r) => r.charge ?? r.fee ?? 0],
                ['minOrderValue', 'Min order', (r) => r.minOrderValue ?? r.minOrder ?? 0],
                ['freeDeliveryAbove', 'Free above', (r) => r.freeDeliveryAbove ?? 300]
              ].map(([f, ph, getVal]) => (
                <input
                  key={f}
                  className={inputCls}
                  value={getVal(rule)}
                  onChange={(e) => {
                    const num = ['charge', 'minOrderValue', 'freeDeliveryAbove'].includes(f);
                    const v = num ? Number(e.target.value) : e.target.value;
                    setDeliveryRules((arr) => arr.map((r, i) => (i === idx ? { ...r, [f]: v } : r)));
                  }}
                  placeholder={ph}
                />
              ))}
              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={rule.isActive !== false}
                  onChange={(e) =>
                    setDeliveryRules((arr) =>
                      arr.map((r, i) => (i === idx ? { ...r, isActive: e.target.checked } : r))
                    )
                  }
                />
                Active
              </label>
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
              <input name="categorySlug" placeholder="Category slug" className={inputCls} required />
              <input name="gstPct" placeholder="GST %" className={inputCls} required />
              <Btn type="submit" variant="primary">
                Add / update category GST
              </Btn>
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
                    onClick={() =>
                      patchAdminTax({
                        gstByCategory: (taxInfo?.gstByCategory || []).filter(
                          (x) => x.categorySlug !== r.categorySlug
                        )
                      }).then(refresh)
                    }
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
      return (
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-600">
            Category Master & product approvals are platform-admin tools (not the Seller / Store Admin panel).
            Open the tools screen for drag-drop reorder, licences, and bulk approvals.
          </p>
          <Btn variant="primary" onClick={() => onOpenLegacyOps?.()}>
            Open Category Master / Approvals
          </Btn>
          <PanelTable
            cols={[
              { key: 'name', label: 'Category' },
              { key: 'slug', label: 'Slug' },
              { key: 'kind', label: 'Type' },
              { key: 'isActive', label: 'Active', render: (r) => (r.isActive !== false ? 'Yes' : 'No') }
            ]}
            rows={(categoryTree || []).flatMap((m) => [
              { ...m, kind: 'Main' },
              ...(m.subcategories || []).map((s) => ({ ...s, kind: `Sub · ${m.name}` }))
            ]).slice(0, 80)}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <h1 className="font-black text-slate-900 text-sm">Japto Admin</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1">{user?.name || 'Super Admin'}</p>
        </div>
        <nav className="p-2 flex-1 space-y-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (t.id === 'categories_ops' && onOpenLegacyOps) {
                  /* still show tab; legacy via button inside */
                }
                setTab(t.id);
              }}
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
          <h2 className="font-black text-slate-900 text-sm capitalize">{TABS.find((t) => t.id === tab)?.label}</h2>
          <div className="flex gap-2">
            <Btn onClick={onNavigateCustomer}>Storefront</Btn>
            <Btn onClick={refresh}>Refresh</Btn>
            <Btn variant="primary" onClick={onLogout}>
              Logout
            </Btn>
          </div>
        </header>

        <main className="p-4 sm:p-6 flex-1">
          {flash && (
            <div className="mb-4 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {flash}
            </div>
          )}
          {renderMain()}
        </main>
      </div>
    </div>
  );
}