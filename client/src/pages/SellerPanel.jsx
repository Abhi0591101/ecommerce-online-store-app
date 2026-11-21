import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import {
  createProduct,
  createSupportRequest,
  getMyStore,
  getNotifications,
  getOrders,
  getReviews,
  getSellerDashboard,
  getSellerProducts,
  getSellerReports,
  getSupportRequests,
  markAllNotificationsRead,
  markNotificationRead,
  updateOrderStatus,
  updateStorePricing,
  upsertPricingMatrix
} from '../services/api';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'reports', label: 'Reports' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'support', label: 'Support' },
  { id: 'notifications', label: 'Alerts' }
];

const DEFAULT_IMG =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80';

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function SellerPanel({ onNavigateCustomer, onLogout }) {
  const { user } = useAuth();
  const { mainCategories, subcategoriesOf, updateOrderStatus: updateLocalOrder } = usePlatform();

  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem('japto_seller_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('japto_seller_tab', tab);
    } catch {
      /* ignore */
    }
  }, [tab]);
  const [store, setStore] = useState(null);
  const [flash, setFlash] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [supportList, setSupportList] = useState([]);
  const [reportRange, setReportRange] = useState('daily');
  const [reportRows, setReportRows] = useState([]);
  const [productMode, setProductMode] = useState('list'); // list | master | new
  const [mainCat, setMainCat] = useState('');
  const [subCat, setSubCat] = useState('');
  const [productPhoto, setProductPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [masterPickId, setMasterPickId] = useState('');
  const [masterPrice, setMasterPrice] = useState('');
  const [masterStock, setMasterStock] = useState('50');

  const notify = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2800);
  };

  const storeId = store?._id;

  const subOptions = useMemo(() => {
    if (!mainCat) return [];
    return subcategoriesOf(mainCat).filter((c) => c.isActive !== false);
  }, [mainCat, subcategoriesOf]);

  useEffect(() => {
    if (!mainCat && mainCategories.length) setMainCat(mainCategories[0].slug);
  }, [mainCategories, mainCat]);

  useEffect(() => {
    if (!subOptions.length) {
      setSubCat('');
      return;
    }
    if (!subOptions.some((s) => s.slug === subCat)) setSubCat(subOptions[0].slug);
  }, [subOptions, subCat]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const storeRes = await getMyStore();
      const myStore = storeRes.data;
      setStore(myStore);
      if (!myStore?._id) return;

      const sid = myStore._id;
      const [dash, prods, ords, revs, notes, support, reports] = await Promise.all([
        getSellerDashboard({ storeId: sid }).catch(() => ({ data: null })),
        getSellerProducts({ storeId: sid }).catch(() => ({ data: [] })),
        getOrders({ storeId: sid }).catch(() => ({ data: [] })),
        getReviews({ storeId: sid }).catch(() => ({ data: [] })),
        getNotifications().catch(() => ({ data: [] })),
        getSupportRequests().catch(() => ({ data: [] })),
        getSellerReports({ storeId: sid, range: reportRange }).catch(() => ({ data: { rows: [] } }))
      ]);

      setDashboard(dash.data || null);
      setProducts(prods.data || []);
      setOrders(ords.data || []);
      setReviews(revs.data || []);
      setNotifications(notes.data || []);
      setSupportList(support.data || []);
      setReportRows(reports.data?.rows || []);
    } catch (err) {
      notify(err.message || 'Failed to load seller panel');
    } finally {
      setLoading(false);
    }
  }, [reportRange]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const myOrders = useMemo(
    () => orders.filter((o) => String(o.storeId?._id || o.storeId) === String(storeId)),
    [orders, storeId]
  );

  const activeOrders = myOrders.filter((o) =>
    ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status)
  );
  const pastOrders = myOrders.filter((o) =>
    ['completed', 'cancelled', 'rejected'].includes(o.status)
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const patchOrder = async (order, status, extra = {}) => {
    try {
      await updateOrderStatus(order._id || order.orderNumber, status, extra);
      updateLocalOrder?.(order.orderNumber || order._id, status);
      notify(`Order ${order.orderNumber} → ${status}`);
      refreshAll();
    } catch (err) {
      notify(err.message);
    }
  };

  const handleSubmitNewProduct = async (e) => {
    e.preventDefault();
    if (!storeId) return;
    const fd = new FormData(e.target);
    if (!mainCat || !subCat) {
      notify('Select category and subcategory');
      return;
    }
    if (!productPhoto) {
      notify('Upload a product image');
      return;
    }
    setSaving(true);
    try {
      const price = Number(fd.get('sellingPrice'));
      const stock = Number(fd.get('stockQty')) || 0;
      await createProduct({
        name: fd.get('name'),
        brand: fd.get('brand') || '',
        sku: fd.get('sku') || '',
        unit: fd.get('unit'),
        mrp: Number(fd.get('mrp')),
        description: fd.get('description') || '',
        photoUrl: productPhoto,
        photos: [productPhoto],
        categorySlug: mainCat,
        subcategorySlug: subCat,
        pricing: [
          {
            storeId,
            price,
            stockQuantity: stock,
            isAvailable: stock > 0
          }
        ]
      });
      notify('Product submitted — pending Admin approval (not for sale yet)');
      e.target.reset();
      setProductPhoto('');
      setProductMode('list');
      refreshAll();
    } catch (err) {
      notify(err.message || 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFromMaster = async (e) => {
    e.preventDefault();
    if (!storeId || !masterPickId) {
      notify('Pick a master product');
      return;
    }
    setSaving(true);
    try {
      await upsertPricingMatrix({
        productId: masterPickId,
        pricing: [
          {
            storeId,
            price: Number(masterPrice),
            stockQuantity: Number(masterStock) || 0,
            isAvailable: true
          }
        ]
      });
      notify('Added from Master Catalogue to your store');
      setProductMode('list');
      setMasterPickId('');
      refreshAll();
    } catch (err) {
      notify(err.message || 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const [catalogue, setCatalogue] = useState([]);
  useEffect(() => {
    if (productMode !== 'master') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getProducts } = await import('../services/api.js');
        const res = await getProducts();
        if (!cancelled) setCatalogue(res.data || []);
      } catch {
        if (!cancelled) setCatalogue([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productMode]);

  const handleSupport = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await createSupportRequest({
        storeId,
        type: fd.get('type') || 'other',
        message: fd.get('message'),
        attachments: []
      });
      notify('Support request submitted — Admin will review');
      e.target.reset();
      refreshAll();
    } catch (err) {
      notify(err.message);
    }
  };

  if (loading && !store) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
        Loading seller panel…
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3 p-6">
        <p className="font-black text-slate-800">No seller store linked to this account.</p>
        <button type="button" onClick={onNavigateCustomer} className="text-indigo-600 font-bold text-sm">
          Back to storefront
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <h1 className="font-black text-slate-900 text-sm">Seller Panel</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1">Store Admin</p>
          <p className="text-[10px] font-bold text-slate-700 mt-1 truncate">{store.name}</p>
          <p className="text-[10px] text-slate-500 truncate">
            {user?.name || store.ownerName} ·{' '}
            <span className={store.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}>
              {store.status}
            </span>
          </p>
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
              {t.id === 'notifications' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={onNavigateCustomer}
            className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50"
          >
            Storefront
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold bg-slate-900 text-white"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex justify-between items-center gap-2 flex-wrap">
          <h2 className="font-black text-slate-900 text-sm">
            {TABS.find((t) => t.id === tab)?.label || 'Seller'}
          </h2>
          <button
            type="button"
            onClick={refreshAll}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700"
          >
            Refresh
          </button>
        </header>

        <main className="p-4 sm:p-6 flex-1">
        {flash && (
          <div className="mb-4 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            {flash}
          </div>
        )}

        {store.status !== 'approved' && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
            Account pending Admin verification. Registration fee ₹{store.registrationFeeAmount || 500}+GST
            must be confirmed before full activation.
          </div>
        )}

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Total sales', `₹${dashboard?.sales ?? 0}`],
                ['Platform fee (1%)', `₹${dashboard?.platformFees ?? 0}`],
                ['Your earnings', `₹${dashboard?.earnings ?? 0}`],
                ['Pending orders', dashboard?.pendingOrders ?? 0]
              ].map(([label, val]) => (
                <div key={label} className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-slate-400">{label}</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{val}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 font-bold">
              1% platform fee is deducted from your earnings only — not added to the customer bill.
            </p>
            <div className="bg-white rounded-3xl border border-slate-200 p-4">
              <h3 className="font-black text-sm text-slate-900 mb-2">Recent orders</h3>
              <div className="space-y-2 text-xs">
                {(dashboard?.recentOrders || []).map((o) => (
                  <div key={o._id || o.orderNumber} className="flex justify-between border-b border-slate-50 py-2">
                    <span className="font-bold text-slate-800">{o.orderNumber}</span>
                    <span className="text-slate-500">{o.status}</span>
                    <span className="font-black text-emerald-700">₹{o.grandTotal}</span>
                  </div>
                ))}
                {!dashboard?.recentOrders?.length && (
                  <p className="text-slate-400 font-bold">No orders yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">Products ({products.length})</h3>
              <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
                {[
                  ['list', 'My listings'],
                  ['master', 'From Master Catalogue'],
                  ['new', 'Submit new product']
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setProductMode(id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs ${
                      productMode === id ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {productMode === 'list' && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 border-b">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p._id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <img src={p.photoUrl || DEFAULT_IMG} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            <div>
                              <p className="font-bold text-slate-900 line-clamp-1">{p.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {p.categoryId?.name || p.categorySlug} / {p.subcategoryId?.name || p.subcategorySlug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              (p.approvalStatus || 'approved') === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.approvalStatus === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {p.approvalStatus || 'approved'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black">₹{p.listing?.price}</td>
                        <td className="px-4 py-3">
                          <label className="sr-only" htmlFor={`stock-${p._id}`}>
                            Stock quantity
                          </label>
                          <input
                            id={`stock-${p._id}`}
                            type="number"
                            min={0}
                            aria-label="Stock quantity"
                            defaultValue={p.listing?.stockQuantity ?? 0}
                            className="w-16 border rounded-lg px-2 py-1 text-right font-bold"
                            onBlur={async (e) => {
                              try {
                                await updateStorePricing({
                                  productId: p._id,
                                  storeId,
                                  stockQuantity: Number(e.target.value),
                                  isAvailable: Number(e.target.value) > 0,
                                  price: p.listing?.price
                                });
                                notify('Stock updated');
                              } catch (err) {
                                notify(err.message);
                              }
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                    {!products.length && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-bold">
                          No listings yet — add from Master Catalogue or submit a new product
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {productMode === 'master' && (
              <form onSubmit={handleAddFromMaster} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 text-xs max-w-xl">
                <h4 className="font-black text-sm">Add approved Master Catalogue product</h4>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Master product *</label>
                  <select
                    value={masterPickId}
                    onChange={(e) => setMasterPickId(e.target.value)}
                    required
                    className="w-full border rounded-xl px-3 py-2"
                  >
                    <option value="">Select product</option>
                    {catalogue.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} (MRP ₹{p.mrp})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Your selling price (₹) *</label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={masterPrice}
                      onChange={(e) => setMasterPrice(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Stock quantity *</label>
                    <input
                      type="number"
                      min={0}
                      value={masterStock}
                      onChange={(e) => setMasterStock(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Platform fee 1% of selling price is deducted from your earnings (not charged to customer).
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black"
                >
                  {saving ? 'Saving…' : 'Add to my store'}
                </button>
              </form>
            )}

            {productMode === 'new' && (
              <form
                onSubmit={handleSubmitNewProduct}
                className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 text-xs max-w-2xl"
              >
                <h4 className="font-black text-sm">Submit new product (Admin approval required)</h4>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Product name *</label>
                  <input name="name" required className="w-full border rounded-xl px-3 py-2" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Main category *</label>
                    <select
                      value={mainCat}
                      onChange={(e) => setMainCat(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                    >
                      {mainCategories.map((c) => (
                        <option key={c._id} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Subcategory *</label>
                    <select
                      value={subCat}
                      onChange={(e) => setSubCat(e.target.value)}
                      required
                      className="w-full border rounded-xl px-3 py-2"
                    >
                      {subOptions.map((c) => (
                        <option key={c._id} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Brand</label>
                    <input name="brand" className="w-full border rounded-xl px-3 py-2" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Unit / pack size *</label>
                    <input name="unit" required className="w-full border rounded-xl px-3 py-2" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Selling price (₹) *</label>
                    <input name="sellingPrice" type="number" required min={1} className="w-full border rounded-xl px-3 py-2" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">MRP (₹) *</label>
                    <input name="mrp" type="number" required min={1} className="w-full border rounded-xl px-3 py-2" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Stock quantity *</label>
                    <input name="stockQty" type="number" required min={0} defaultValue={20} className="w-full border rounded-xl px-3 py-2" />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Description</label>
                  <textarea name="description" rows={2} className="w-full border rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Product image *</label>
                  <div className="grid grid-cols-[88px_1fr] gap-3 items-start">
                    <div className="w-[88px] h-[88px] rounded-2xl border-2 border-dashed overflow-hidden bg-slate-50 flex items-center justify-center">
                      {productPhoto ? (
                        <img src={productPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] text-slate-400 font-bold">Preview</span>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      required={!productPhoto}
                      onChange={async (ev) => {
                        const f = ev.target.files?.[0];
                        if (!f) return;
                        setProductPhoto(await fileToDataUrl(f));
                      }}
                      className="text-[11px] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-bold"
                    />
                  </div>
                </div>
                <button type="submit" disabled={saving} className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black">
                  {saving ? 'Submitting…' : 'Submit for Admin approval'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <div className="space-y-4">
            <h3 className="font-black text-lg text-slate-900">Active orders ({activeOrders.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeOrders.map((o) => (
                <div key={o._id || o.orderNumber} className="bg-white rounded-3xl border border-slate-200 p-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="font-black text-slate-900">{o.orderNumber}</span>
                    <span className="font-bold text-amber-700">{o.status}</span>
                  </div>
                  <p className="text-slate-500">👤 {o.customerName} · 📞 {o.customerPhone}</p>
                  <p className="text-slate-500">📍 {o.deliveryAddress}</p>
                  <p className="font-black text-emerald-700">
                    ₹{o.grandTotal} · fee 1% ₹{o.platformFee ?? Math.round((o.itemsTotal || 0) * 0.01)} · earn ₹
                    {o.sellerEarning ?? (o.itemsTotal || 0) - Math.round((o.itemsTotal || 0) * 0.01)}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {o.status === 'placed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => patchOrder(o, 'accepted', { deliveryMethod: 'japto' })}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl font-bold"
                        >
                          Accept (Japto delivery)
                        </button>
                        <button
                          type="button"
                          onClick={() => patchOrder(o, 'accepted', { deliveryMethod: 'seller_own' })}
                          className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold"
                        >
                          Accept (Own delivery)
                        </button>
                        <button
                          type="button"
                          onClick={() => patchOrder(o, 'rejected')}
                          className="px-2.5 py-1.5 bg-rose-100 text-rose-700 rounded-xl font-bold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {['accepted', 'packing'].includes(o.status) && (
                      <button
                        type="button"
                        onClick={() => patchOrder(o, 'ready_for_pickup')}
                        className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold"
                      >
                        Mark ready
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!activeOrders.length && (
                <p className="text-slate-400 font-bold text-sm">No active orders</p>
              )}
            </div>
            <h3 className="font-black text-lg text-slate-900 pt-2">Past orders</h3>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden text-xs">
              {pastOrders.slice(0, 30).map((o) => (
                <div key={o._id || o.orderNumber} className="flex justify-between px-4 py-2.5 border-b border-slate-50">
                  <span className="font-bold">{o.orderNumber}</span>
                  <span className="text-slate-500">{o.status}</span>
                  <span className="font-black">₹{o.grandTotal}</span>
                </div>
              ))}
              {!pastOrders.length && <p className="p-4 text-slate-400 font-bold">No past orders</p>}
            </div>
          </div>
        )}

        {/* DELIVERY */}
        {tab === 'delivery' && (
          <div className="space-y-3">
            <h3 className="font-black text-lg text-slate-900">Delivery management</h3>
            <p className="text-xs text-slate-500 font-bold">
              Supported methods: Japto.in delivery personnel, or your own delivery. No product-return actions at launch.
            </p>
            {activeOrders
              .filter((o) => o.orderType !== 'pickup')
              .map((o) => (
                <div key={o._id || o.orderNumber} className="bg-white rounded-3xl border border-slate-200 p-4 text-xs flex flex-wrap gap-2 items-center justify-between">
                  <div>
                    <p className="font-black">{o.orderNumber}</p>
                    <p className="text-slate-500">
                      Method: {o.deliveryMethod || 'japto'} · Status: {o.status}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => patchOrder(o, o.status, { deliveryMethod: 'japto' })}
                      className="px-2.5 py-1.5 rounded-xl font-bold border border-slate-200"
                    >
                      Japto
                    </button>
                    <button
                      type="button"
                      onClick={() => patchOrder(o, o.status, { deliveryMethod: 'seller_own' })}
                      className="px-2.5 py-1.5 rounded-xl font-bold border border-slate-200"
                    >
                      Own delivery
                    </button>
                    {o.status === 'ready_for_pickup' && o.deliveryMethod === 'seller_own' && (
                      <button
                        type="button"
                        onClick={() => patchOrder(o, 'out_for_delivery')}
                        className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-xl font-bold"
                      >
                        Out for delivery
                      </button>
                    )}
                    {o.status === 'out_for_delivery' && o.deliveryMethod === 'seller_own' && (
                      <button
                        type="button"
                        onClick={() => patchOrder(o, 'completed')}
                        className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl font-bold"
                      >
                        Mark delivered
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* EARNINGS */}
        {tab === 'earnings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ['Gross sales', `₹${dashboard?.sales ?? 0}`],
                ['1% platform fee', `₹${dashboard?.platformFees ?? 0}`],
                ['Net earnings', `₹${dashboard?.earnings ?? 0}`]
              ].map(([l, v]) => (
                <div key={l} className="bg-white rounded-3xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase text-slate-400">{l}</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{v}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 p-4 text-xs">
              <h4 className="font-black text-sm mb-2">Payment history (completed orders)</h4>
              {pastOrders
                .filter((o) => o.status === 'completed')
                .map((o) => (
                  <div key={o._id || o.orderNumber} className="flex justify-between py-2 border-b border-slate-50">
                    <span className="font-bold">{o.orderNumber}</span>
                    <span className="text-slate-500">Received</span>
                    <span className="font-black text-emerald-700">
                      ₹{o.sellerEarning ?? o.itemsTotal}
                    </span>
                  </div>
                ))}
              <p className="text-[10px] text-slate-400 mt-3 font-bold">
                Payout cycle / minimum threshold — pending Company policy (per requirements).
              </p>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {['daily', 'monthly', 'product'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReportRange(r)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs ${
                    reportRange === r ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'
                  }`}
                >
                  {r === 'daily' ? 'Daily sales' : r === 'monthly' ? 'Monthly sales' : 'Product-wise'}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">{reportRange === 'product' ? 'Product' : 'Period'}</th>
                    <th className="px-4 py-3 text-right">{reportRange === 'product' ? 'Units' : 'Orders'}</th>
                    <th className="px-4 py-3 text-right">Sales</th>
                    {reportRange !== 'product' && <th className="px-4 py-3 text-right">Fee 1%</th>}
                    {reportRange !== 'product' && <th className="px-4 py-3 text-right">Earnings</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportRows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-bold">{row.period || row.productName}</td>
                      <td className="px-4 py-2.5 text-right">{row.orders ?? row.unitsSold}</td>
                      <td className="px-4 py-2.5 text-right font-black">₹{row.sales ?? row.revenue}</td>
                      {reportRange !== 'product' && (
                        <td className="px-4 py-2.5 text-right">₹{row.platformFees}</td>
                      )}
                      {reportRange !== 'product' && (
                        <td className="px-4 py-2.5 text-right text-emerald-700 font-black">₹{row.earnings}</td>
                      )}
                    </tr>
                  ))}
                  {!reportRows.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 font-bold">
                        No report data for this range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REVIEWS — no returns at launch */}
        {tab === 'reviews' && (
          <div className="space-y-3">
            <h3 className="font-black text-lg">Ratings & reviews (your products)</h3>
            <p className="text-[11px] text-slate-500 font-bold">Product returns are not available in Seller Panel at launch.</p>
            {reviews.map((r) => (
              <div key={r._id} className="bg-white rounded-3xl border border-slate-200 p-4 text-xs">
                <p className="font-black text-slate-900">
                  {'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))} · {r.customerName || 'Customer'}
                </p>
                <p className="text-slate-600 mt-1">{r.comment || '—'}</p>
              </div>
            ))}
            {!reviews.length && <p className="text-slate-400 font-bold text-sm">No reviews yet</p>}
          </div>
        )}

        {/* SUPPORT — profile/bank edits locked */}
        {tab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 text-xs space-y-2">
              <h3 className="font-black text-sm">Profile & documents (read-only)</h3>
              <p className="text-slate-500">Direct edits to profile, contact, bank, or documents are disabled. Submit a Support Request for changes.</p>
              <p><span className="font-bold">Store:</span> {store.name}</p>
              <p><span className="font-bold">Phone:</span> {store.phone}</p>
              <p><span className="font-bold">PAN:</span> {store.panNumber || '—'}</p>
              <p><span className="font-bold">GST:</span> {store.gstin || store.gstNumber || '—'}</p>
              <p><span className="font-bold">Enrollment:</span> {store.enrollmentNumber || '—'}</p>
              <p><span className="font-bold">FSSAI:</span> {store.fssai || '—'}</p>
              <p><span className="font-bold">Bank:</span> {store.bankAccount || '—'} / {store.ifsc || store.bankIfsc || '—'}</p>
            </div>
            <form onSubmit={handleSupport} className="bg-white rounded-3xl border border-slate-200 p-5 text-xs space-y-3">
              <h3 className="font-black text-sm">New Support Request</h3>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Request type *</label>
                <select name="type" className="w-full border rounded-xl px-3 py-2">
                  <option value="profile">Profile change</option>
                  <option value="contact">Contact change</option>
                  <option value="bank">Bank details</option>
                  <option value="document">Document update</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Message *</label>
                <textarea name="message" required rows={4} className="w-full border rounded-xl px-3 py-2" />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black">
                Submit to Company / Admin
              </button>
              <div className="pt-2 space-y-2">
                <p className="font-black text-slate-700">Your requests</p>
                {supportList.map((s) => (
                  <div key={s._id} className="border border-slate-100 rounded-xl p-2">
                    <p className="font-bold">{s.type} · {s.status}</p>
                    <p className="text-slate-500">{s.message}</p>
                  </div>
                ))}
              </div>
            </form>
          </div>
        )}

        {/* NOTIFICATIONS */}
        {tab === 'notifications' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-lg">Notifications</h3>
              <button
                type="button"
                onClick={async () => {
                  await markAllNotificationsRead();
                  refreshAll();
                }}
                className="text-xs font-bold text-indigo-600"
              >
                Mark all read
              </button>
            </div>
            {notifications.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={async () => {
                  if (!n.read) await markNotificationRead(n._id);
                  refreshAll();
                }}
                className={`w-full text-left bg-white rounded-3xl border p-4 text-xs ${
                  n.read ? 'border-slate-200' : 'border-indigo-200 bg-indigo-50/40'
                }`}
              >
                <p className="font-black text-slate-900">{n.title}</p>
                <p className="text-slate-600 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">{n.type}</p>
              </button>
            ))}
            {!notifications.length && <p className="text-slate-400 font-bold">No notifications</p>}
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
