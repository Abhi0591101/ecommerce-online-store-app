import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import SearchableSelect from '../components/SearchableSelect';
import UnitPackFields from '../components/UnitPackFields';
import {
  createProduct as createProductApi,
  getPendingProducts,
  getSupportRequests,
  patchProductApproval,
  updateOrderStatus as updateOrderStatusApi,
  updateStorePricing,
  updateSupportRequest,
  upsertPricingMatrix
} from '../services/api';
// Category/product delete & edit go through PlatformContext
import { formatDistanceKm } from '../utils/geo';
import { ensureAudioUnlockedOnGesture, playDoubleBeep, unlockAudio } from '../utils/audio';

const TABS = [
  { id: 'creator_studio', label: '✨ Dynamic Creator Studio' },
  { id: 'manage_stores', label: '🏬 Stores Directory' },
  { id: 'manage_products', label: '📦 Products Matrix' },
  { id: 'merchant_orders', label: '📦 Orders Dispatch Queue' },
  { id: 'category_master', label: '🗂️ Category Master', adminOnly: true },
  { id: 'product_approvals', label: '✅ Product Approvals', adminOnly: true },
  { id: 'superadmin_approvals', label: '👑 KYC Approvals', adminOnly: true }
];

export default function StoreAdmin({
  onNavigateCustomer,
  onNavigateRider,
  onLogout,
  onBackToAdminPanel,
  mode = 'admin'
}) {
  const {
    stores,
    products,
    categories,
    categoryTree,
    mainCategories,
    subcategoriesOf,
    services,
    orders,
    drivers,
    pendingStoreApprovals,
    pendingDriverKYCs,
    activeStore,
    toggleStoreOnline,
    updateOrderStatus,
    addProduct,
    updateProductOffer,
    addStore,
    addCategory,
    editCategory,
    toggleCategoryActive,
    reorderCategoryList,
    removeCategory,
    editProduct,
    removeProduct,
    addService,
    approveStoreKYC,
    rejectStoreKYC,
    approveDriverKYC,
    rejectDriverKYC,
    addDriver,
    apiOnline
  } = usePlatform();

  const isSuperAdmin = mode === 'superadmin';
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isSuperAdmin);

  const [tab, setTab] = useState(isSuperAdmin ? 'product_approvals' : 'creator_studio');
  const [studioForm, setStudioForm] = useState('product');
  const [flash, setFlash] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productMainCat, setProductMainCat] = useState('');
  const [productSubCat, setProductSubCat] = useState('');
  const [serviceCategory, setServiceCategory] = useState('plumbing');
  const [catFormMode, setCatFormMode] = useState('main'); // main | sub
  const [catParentId, setCatParentId] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [expandedMainId, setExpandedMainId] = useState('');
  const [editingCategory, setEditingCategory] = useState(null); // category doc being edited
  const [catDraft, setCatDraft] = useState({
    name: '',
    nameHi: '',
    iconEmoji: '🛒',
    photoUrl: '',
    requiresLicence: false
  });
  const [mainList, setMainList] = useState([]);
  const [dragMainId, setDragMainId] = useState('');
  const [dragSub, setDragSub] = useState(null); // { mainId, subId }
  const [reordering, setReordering] = useState(false);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [supportQueue, setSupportQueue] = useState([]);
  const DEFAULT_CAT_PHOTO =
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80';

  const loadAdminQueues = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const [prods, support] = await Promise.all([
        getPendingProducts().catch(() => ({ data: [] })),
        getSupportRequests().catch(() => ({ data: [] }))
      ]);
      setPendingProducts(Array.isArray(prods?.data) ? prods.data : []);
      setSupportQueue(Array.isArray(support?.data) ? support.data : []);
    } catch {
      /* ignore */
    }
  }, [isSuperAdmin]);

  // Always poll pending seller products for Admin (not only when KYC tab is open)
  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    loadAdminQueues();
    const timer = setInterval(loadAdminQueues, 12000);
    return () => clearInterval(timer);
  }, [isSuperAdmin, loadAdminQueues, flash]);

  const startEditCategory = (cat, asSub = false) => {
    setEditingCategory(cat);
    setCatFormMode(asSub || cat.parentId ? 'sub' : 'main');
    const parent =
      typeof cat.parentId === 'object' && cat.parentId
        ? cat.parentId._id || cat.parentId.id
        : cat.parentId;
    setCatParentId(parent ? String(parent) : '');
    setCatDraft({
      name: cat.name || '',
      nameHi: cat.nameHi || '',
      iconEmoji: cat.iconEmoji || (asSub ? '📁' : '🛒'),
      photoUrl: cat.photoUrl || '',
      requiresLicence: Boolean(cat.requiresLicence)
    });
  };

  const clearCategoryEdit = () => {
    setEditingCategory(null);
    setCatDraft({
      name: '',
      nameHi: '',
      iconEmoji: catFormMode === 'sub' ? '📁' : '🛒',
      photoUrl: '',
      requiresLicence: false
    });
  };

  const onCategoryImageFile = (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      notify('Please upload an image file');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      notify('Image must be under 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCatDraft((d) => ({ ...d, photoUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCategory = async (cat, isMain = false) => {
    const label = isMain ? 'main category (and its subcategories)' : 'subcategory';
    const ok = window.confirm(
      `Delete ${label} "${cat.name}"?\n\nProducts under it will be deactivated. This cannot be undone.`
    );
    if (!ok) return;
    try {
      await removeCategory(cat._id, { cascade: true, force: true });
      if (editingCategory && String(editingCategory._id) === String(cat._id)) clearCategoryEdit();
      notify(`Deleted "${cat.name}"`);
    } catch (err) {
      notify(err.message || 'Delete failed');
    }
  };

  const persistMainOrder = async (list) => {
    setReordering(true);
    try {
      await reorderCategoryList(
        list.map((c, idx) => ({ id: c._id, displayOrder: idx + 1 }))
      );
      notify('Category order saved');
    } catch (err) {
      notify(err.message || 'Reorder failed');
    } finally {
      setReordering(false);
    }
  };

  const persistSubOrder = async (mainId, subs) => {
    setReordering(true);
    try {
      await reorderCategoryList(
        subs.map((c, idx) => ({ id: c._id, displayOrder: idx + 1 }))
      );
      notify('Subcategory order saved');
    } catch (err) {
      notify(err.message || 'Reorder failed');
    } finally {
      setReordering(false);
    }
  };

  const onMainDrop = async (targetId) => {
    if (!dragMainId || String(dragMainId) === String(targetId)) {
      setDragMainId('');
      return;
    }
    const from = mainList.findIndex((c) => String(c._id) === String(dragMainId));
    const to = mainList.findIndex((c) => String(c._id) === String(targetId));
    if (from < 0 || to < 0) {
      setDragMainId('');
      return;
    }
    const next = [...mainList];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setMainList(next);
    setDragMainId('');
    await persistMainOrder(next);
  };

  const onSubDrop = async (mainId, targetSubId) => {
    if (!dragSub || String(dragSub.mainId) !== String(mainId)) {
      setDragSub(null);
      return;
    }
    if (String(dragSub.subId) === String(targetSubId)) {
      setDragSub(null);
      return;
    }
    setMainList((prev) => {
      const next = prev.map((main) => {
        if (String(main._id) !== String(mainId)) return main;
        const subs = [...(main.subcategories || [])];
        const from = subs.findIndex((s) => String(s._id) === String(dragSub.subId));
        const to = subs.findIndex((s) => String(s._id) === String(targetSubId));
        if (from < 0 || to < 0) return main;
        const [moved] = subs.splice(from, 1);
        subs.splice(to, 0, moved);
        // Fire-and-forget persist after state update
        queueMicrotask(() => persistSubOrder(mainId, subs));
        return { ...main, subcategories: subs };
      });
      return next;
    });
    setDragSub(null);
  };
  const seenOrders = useRef(new Set());
  const ordersBootstrapped = useRef(false);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const isOnline = activeStore?.isOnline !== false;
  const pendingCount =
    pendingStoreApprovals.length + pendingDriverKYCs.length + pendingProducts.length;

  const notify = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  // Unlock Web Audio on first interaction (required by modern browsers)
  useEffect(() => ensureAudioUnlockedOnGesture(), []);

  // Seed known order numbers after first catalog/orders hydrate (avoid false alerts)
  useEffect(() => {
    if (ordersBootstrapped.current) return undefined;
    const timer = setTimeout(() => {
      ordersRef.current.forEach((o) => {
        if (o.orderNumber) seenOrders.current.add(o.orderNumber);
      });
      ordersBootstrapped.current = true;
    }, apiOnline ? 150 : 1600);
    return () => clearTimeout(timer);
  }, [apiOnline]);

  // Auto-surface Socket.IO order:new arrivals on the merchant dashboard
  useEffect(() => {
    if (!ordersBootstrapped.current) return;
    const fresh = orders.filter(
      (o) => o.status === 'placed' && o.orderNumber && !seenOrders.current.has(o.orderNumber)
    );
    if (fresh.length) {
      fresh.forEach((o) => seenOrders.current.add(o.orderNumber));
      setTab('merchant_orders');
      unlockAudio();
      playDoubleBeep();
      notify(`🔔 New order ${fresh[0].orderNumber} — check dispatch queue!`);
    }
    orders.forEach((o) => {
      if (o.orderNumber) seenOrders.current.add(o.orderNumber);
    });
  }, [orders]);

  const tabLabel = (t) => {
    if (t.id === 'manage_stores') return `${t.label} (${stores.length})`;
    if (t.id === 'manage_products') return `${t.label} (${products.length})`;
    if (t.id === 'category_master') {
      return `${t.label} (${mainCategories.length})`;
    }
    if (t.id === 'product_approvals') {
      return `${t.label} (${pendingProducts.length})`;
    }
    if (t.id === 'superadmin_approvals') return `${t.label} (${pendingCount})`;
    if (t.id === 'merchant_orders') return `${t.label} (${orders.filter((o) => !['completed', 'delivered', 'cancelled'].includes(o.status)).length})`;
    return t.label;
  };

  const productSubOptions = useMemo(() => {
    if (!productMainCat) return [];
    return subcategoriesOf(productMainCat).filter((c) => c.isActive !== false);
  }, [productMainCat, subcategoriesOf]);

  useEffect(() => {
    if (studioForm === 'category') setStudioForm('product');
  }, [studioForm]);

  useEffect(() => {
    if (!productMainCat && mainCategories.length) {
      setProductMainCat(mainCategories[0].slug);
    }
  }, [mainCategories, productMainCat]);

  useEffect(() => {
    if (!productSubOptions.length) {
      setProductSubCat('');
      return;
    }
    if (!productSubOptions.some((s) => s.slug === productSubCat)) {
      setProductSubCat(productSubOptions[0].slug);
    }
  }, [productSubOptions, productSubCat]);

  // Keep local drag list in sync with Mongo category tree
  useEffect(() => {
    const tree = categoryTree.length
      ? categoryTree
      : mainCategories.map((m) => ({
          ...m,
          subcategories: subcategoriesOf(m._id)
        }));
    setMainList(
      [...tree].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((m) => ({
        ...m,
        subcategories: [...(m.subcategories || [])].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        )
      }))
    );
  }, [categoryTree, mainCategories, subcategoriesOf]);

  const onPhotoFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPhotoPreview(dataUrl);
      setPhotoUrlInput(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  /* ---------- Creator Studio handlers ---------- */
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const name = fd.get('name');
    const mrp = Number(fd.get('mrp'));
    const sellingPrice = Number(fd.get('sellingPrice')) || mrp;
    const unit = String(fd.get('unit') || '').trim();
    if (!unit) {
      notify('Enter quantity and select unit type');
      return;
    }
    const brand = fd.get('brand') || 'Local Brand';
    const categorySlug = productMainCat || fd.get('category');
    const subcategorySlug = productSubCat || fd.get('subcategory');
    if (!categorySlug || !subcategorySlug) {
      notify('Select category and subcategory');
      return;
    }
    const sku = fd.get('sku') || '';
    const stockQty = Number(fd.get('stockQty')) || 50;
    const photoUrl =
      photoUrlInput ||
      fd.get('photoUrl') ||
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80';
    const description = fd.get('description') || 'Quality product from local verified stores.';

    const storeOffers = [];
    stores.forEach((s) => {
      const checked = fd.get(`chk_${s._id}`) === 'on';
      const price = Number(fd.get(`price_${s._id}`)) || (String(s._id) === String(activeStore?._id) ? sellingPrice : 0);
      if (checked && price > 0) {
        storeOffers.push({
          storeId: s._id,
          price,
          stockQuantity: Number(fd.get(`stock_${s._id}`)) || stockQty,
          isAvailable: true,
          deliveryFee: price >= (s.freeDeliveryAbove || 0) ? 0 : (s.baseDeliveryFee || 0),
          totalCost: price + (price >= (s.freeDeliveryAbove || 0) ? 0 : (s.baseDeliveryFee || 0))
        });
      }
    });

    // Ensure active store always has an offer when selling price provided
    if (activeStore && sellingPrice > 0 && !storeOffers.some((o) => String(o.storeId) === String(activeStore._id))) {
      storeOffers.push({
        storeId: activeStore._id,
        price: sellingPrice,
        stockQuantity: stockQty,
        isAvailable: true,
        deliveryFee:
          sellingPrice >= (activeStore.freeDeliveryAbove || 0) ? 0 : (activeStore.baseDeliveryFee || 0),
        totalCost:
          sellingPrice +
          (sellingPrice >= (activeStore.freeDeliveryAbove || 0) ? 0 : (activeStore.baseDeliveryFee || 0))
      });
    }

    if (!storeOffers.length) {
      notify('Select at least one store with a selling price.');
      return;
    }

    const lowest = [...storeOffers].sort((a, b) => a.price - b.price)[0];
    const store = stores.find((s) => String(s._id) === String(lowest?.storeId));
    if (!categorySlug || !subcategorySlug) {
      notify('Select an active category and subcategory (managed by Admin).');
      return;
    }

    const categoryMeta = mainCategories.find((c) => c.slug === categorySlug);
    const subcategoryMeta = productSubOptions.find((c) => c.slug === subcategorySlug);

    setSavingProduct(true);
    let persisted = null;
    try {
      const res = await createProductApi({
        name,
        brand,
        sku,
        unit,
        mrp,
        description,
        photoUrl,
        photos: [photoUrl],
        categorySlug,
        subcategorySlug,
        pricing: storeOffers.map((o) => ({
          storeId: o.storeId,
          price: o.price,
          stockQuantity: o.stockQuantity,
          isAvailable: true
        }))
      });
      persisted = res?.data;
      if (persisted?._id && storeOffers.length) {
        await upsertPricingMatrix({
          productId: persisted._id,
          pricing: storeOffers.map((o) => ({
            storeId: o.storeId,
            price: o.price,
            stockQuantity: o.stockQuantity,
            isAvailable: true
          }))
        }).catch(() => null);
      }
    } catch {
      /* offline — keep local catalog update */
    } finally {
      setSavingProduct(false);
    }

    const localProduct = {
      _id: persisted?._id || `prod-${Date.now()}`,
      name,
      brand,
      sku,
      mrp,
      unit,
      rating: 4.8,
      reviewsCount: 12,
      categorySlug,
      subcategorySlug,
      categoryId: persisted?.categoryId || categoryMeta,
      subcategoryId: persisted?.subcategoryId || subcategoryMeta,
      categoryId: persisted?.categoryId || {
        _id: categoryMeta?._id,
        slug: categorySlug,
        name: categoryMeta?.name || categorySlug
      },
      photoUrl,
      photos: [photoUrl],
      description,
      lowestPrice: persisted?.lowestPrice || lowest?.price || mrp,
      savingsPercent:
        persisted?.savingsPercent ??
        (lowest ? Math.round(((mrp - lowest.price) / mrp) * 100) : 0),
      lowestStore: persisted?.lowestStore || (store
        ? {
            storeId: store._id,
            name: store.name,
            rating: store.rating,
            baseDeliveryFee: store.baseDeliveryFee,
            freeDeliveryAbove: store.freeDeliveryAbove,
            estDeliveryMins: store.estDeliveryMins
          }
        : null),
      storeOffers: persisted?.storeOffers || storeOffers,
      inStock: true,
      isAvailable: true
    };

    addProduct(localProduct);
    form.reset();
    setPhotoPreview('');
    setPhotoUrlInput('');
    notify(`Product "${name}" launched across ${storeOffers.length} stores!`);
  };

  const toggleOfferAvailability = async (product, offer) => {
    const nextAvailable = !(offer.isAvailable !== false && (offer.stockQuantity ?? 0) > 0);
    const patch = nextAvailable
      ? { isAvailable: true, stockQuantity: Math.max(offer.stockQuantity || 0, 10) }
      : { isAvailable: false, stockQuantity: 0 };

    updateProductOffer(product._id, offer.storeId, patch);
    try {
      await updateStorePricing({
        productId: product._id,
        storeId: offer.storeId,
        ...patch
      });
    } catch {
      /* offline ok */
    }
    notify(
      nextAvailable
        ? `"${product.name}" marked In Stock`
        : `"${product.name}" marked Out of Stock`
    );
  };

  const editOfferStock = async (product, offer, stockQuantity) => {
    const qty = Math.max(0, Number(stockQuantity) || 0);
    const patch = { stockQuantity: qty, isAvailable: qty > 0 };
    updateProductOffer(product._id, offer.storeId, patch);
    try {
      await updateStorePricing({
        productId: product._id,
        storeId: offer.storeId,
        ...patch
      });
    } catch {
      /* offline ok */
    }
  };

  const handleCreateStore = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const store = {
      _id: `store-${Date.now()}`,
      name: fd.get('name'),
      phone: fd.get('phone'),
      rating: 4.8,
      reviewsCount: 10,
      distanceKm: 1.0,
      estDeliveryMins: Number(fd.get('estMins')) || 20,
      baseDeliveryFee: Number(fd.get('delFee')) || 15,
      deliveryFee: Number(fd.get('delFee')) || 15,
      freeDeliveryAbove: Number(fd.get('freeAbove')) || 300,
      address: fd.get('address'),
      pincode: '201301',
      city: 'Noida',
      lat: 28.628,
      lng: 77.3649,
      isOnline: true,
      pickupAvailable: true,
      photoUrl: fd.get('photoUrl') || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
      openingTime: '08:00 AM - 10:00 PM'
    };
    addStore(store);
    e.target.reset();
    notify(`Store "${store.name}" launched and online!`);
  };

  const dispatchAction = async (order) => {
    const nextStatus =
      order.status === 'placed'
        ? 'accepted'
        : order.status === 'accepted'
          ? 'packing'
          : order.status === 'packing'
            ? 'ready_for_pickup'
            : order.status === 'ready_for_pickup' || order.status === 'driver_assigned'
              ? 'out_for_delivery'
              : order.status === 'out_for_delivery'
                ? 'completed'
                : null;

    if (!nextStatus) return;

    updateOrderStatus(order.orderNumber, nextStatus);
    try {
      await updateOrderStatusApi(order.id || order.orderNumber, nextStatus);
    } catch {
      /* offline / mock — local state already updated */
    }

    if (nextStatus === 'accepted') notify('Order accepted!');
    else if (nextStatus === 'packing') notify('Order moved to packing!');
    else if (nextStatus === 'ready_for_pickup') notify('Ready for rider pickup — radar pinged!');
    else if (nextStatus === 'out_for_delivery') notify('Rider dispatched!');
    else if (nextStatus === 'completed') notify('Order marked completed!');
  };

  const actionLabel = (status) => {
    if (status === 'placed') return 'Accept Order';
    if (status === 'accepted') return 'Mark Packing';
    if (status === 'packing') return 'Ready for Pickup';
    if (status === 'ready_for_pickup' || status === 'driver_assigned') return 'Dispatch Rider';
    if (status === 'out_for_delivery') return 'Mark Delivered';
    return null;
  };

  const liveOrders = useMemo(
    () => orders.filter((o) => !['cancelled'].includes(o.status)),
    [orders]
  );

  return (
    <div className="bg-slate-100 text-slate-900 min-h-screen selection:bg-indigo-600 selection:text-white">
      <header className="bg-slate-950 text-white sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onNavigateCustomer} className="flex items-center gap-2 text-white font-black text-lg">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-sm">⚡</div>
              <span>
                Platform <span className="text-indigo-400">Category Ops</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleStoreOnline(activeStore?._id)}
              className={`ml-2 sm:ml-4 px-3.5 py-1.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition shadow-md ${
                isOnline ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>{isOnline ? 'STORE IS ONLINE' : 'STORE IS OFFLINE'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {onBackToAdminPanel ? (
              <button
                type="button"
                onClick={onBackToAdminPanel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs transition"
              >
                ← Admin Panel
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNavigateRider}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition border border-amber-500/40"
            >
              🛵 Rider Login
            </button>
            <button
              type="button"
              onClick={onNavigateCustomer}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition"
            >
              ➔ Storefront
            </button>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs transition"
              >
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {flash && (
          <div className="mb-4 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            {flash}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-2xl font-bold text-xs transition whitespace-nowrap ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        {/* CREATOR STUDIO */}
        {tab === 'creator_studio' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-black text-slate-900 text-lg sm:text-xl flex items-center gap-2">
                  <span>🚀 Dynamic Creator Studio</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                    Instant Launch
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sellers list products under Admin-managed categories &amp; subcategories
                </p>
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                {[
                  ['store', '🏬 + Store'],
                  ['product', '📦 + Product'],
                  ['service', '🛠️ + Service']
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStudioForm(id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                      studioForm === id ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm">
              {studioForm === 'product' && (
                <form onSubmit={handleCreateProduct} className="space-y-4 max-w-2xl mx-auto text-xs">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="font-black text-slate-900 text-base">📦 Add New Product</h3>
                    <p className="text-slate-400 mt-0.5">
                      Upload a photo, set MRP & selling price, then publish into the live customer catalog.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Product Name *</label>
                      <input name="name" required placeholder="e.g. Maggi Noodles" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">SKU (optional)</label>
                      <input name="sku" placeholder="SKU-001" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Main Category *</label>
                      <SearchableSelect
                        name="category"
                        options={mainCategories
                          .filter((c) => c.isActive !== false)
                          .map((c) => ({ value: c.slug, label: c.name }))}
                        value={productMainCat}
                        onChange={setProductMainCat}
                        placeholder="Search category…"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Subcategory *</label>
                      <SearchableSelect
                        name="subcategory"
                        options={productSubOptions.map((c) => ({
                          value: c.slug,
                          label: c.name
                        }))}
                        value={productSubCat}
                        onChange={setProductSubCat}
                        placeholder={
                          productSubOptions.length ? 'Search subcategory…' : 'No active subcategories'
                        }
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Categories are managed by Admin only.</p>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Brand (optional)</label>
                    <input
                      name="brand"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>
                  <UnitPackFields required />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Selling Price (₹) *</label>
                      <input name="sellingPrice" type="number" required min={1} placeholder="89" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">MRP (₹) *</label>
                      <input name="mrp" type="number" required min={1} placeholder="100" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Initial Stock *</label>
                      <input name="stockQty" type="number" required min={0} defaultValue={50} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Description</label>
                    <textarea name="description" rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4 items-start pt-1">
                    <div className="aspect-square w-[120px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                      {photoPreview || photoUrlInput ? (
                        <img
                          src={photoPreview || photoUrlInput}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(ev) => {
                            ev.currentTarget.src =
                              'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80';
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold text-center px-2">1:1 Preview</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="font-bold text-slate-700 block">Photo Upload / URL</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(ev) => onPhotoFile(ev.target.files?.[0])}
                        className="w-full text-[11px] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-bold"
                      />
                      <input
                        name="photoUrl"
                        value={photoUrlInput}
                        onChange={(e) => {
                          setPhotoUrlInput(e.target.value);
                          setPhotoPreview(e.target.value);
                        }}
                        placeholder="https://… or upload above"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400">Square crop preview updates live for both URL and file upload.</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <label className="font-bold text-slate-900 mb-1.5 block">
                      Multi-Store Pricing Matrix ({activeStore?.name || 'Your store'} pre-selected)
                    </label>
                    <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                      {stores.map((s) => (
                        <div key={s._id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 gap-2">
                          <label className="flex items-center gap-2 cursor-pointer flex-grow min-w-0">
                            <input
                              type="checkbox"
                              name={`chk_${s._id}`}
                              defaultChecked={String(s._id) === String(activeStore?._id) || stores.indexOf(s) < 3}
                              className="text-indigo-600 rounded"
                            />
                            <span className="font-bold text-slate-800 text-[11px] truncate">{s.name}</span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {formatDistanceKm(s.distanceKm)}
                            </span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[10px]">₹</span>
                            <input type="number" name={`price_${s._id}`} placeholder="Price" className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                            <input type="number" name={`stock_${s._id}`} placeholder="Stock" defaultValue={50} className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/30 transition"
                  >
                    {savingProduct ? 'Publishing…' : '📦 Save Product & Push to Customer Catalog'}
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    {apiOnline ? 'Live API connected — POST /api/products + pricing-matrix' : 'Offline mode — product saved to local catalog until MongoDB is up'}
                  </p>
                </form>
              )}

              {studioForm === 'store' && (
                <form onSubmit={handleCreateStore} className="space-y-4 max-w-2xl mx-auto text-xs">
                  <h3 className="font-black text-slate-900 text-base">🏬 Register & Launch a New Store</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Store Name *</label>
                      <input name="name" required className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Phone *</label>
                      <input name="phone" required className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Delivery Fee</label>
                      <input name="delFee" type="number" defaultValue={15} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Free Above</label>
                      <input name="freeAbove" type="number" defaultValue={300} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">ETA Mins</label>
                      <input name="estMins" type="number" defaultValue={20} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Address *</label>
                    <input name="address" required className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Photo URL</label>
                    <input name="photoUrl" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  </div>
                  <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm">
                    🎉 Create & Launch Store Instantly
                  </button>
                </form>
              )}

              {studioForm === 'service' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    addService({
                      _id: `srv-${Date.now()}`,
                      name: fd.get('name'),
                      category: fd.get('category') || 'general',
                      visitCharge: Number(fd.get('charge')) || 149,
                      rating: 4.9,
                      reviews: 10,
                      photoUrl: fd.get('photoUrl') || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500',
                      description: fd.get('description') || 'Verified local home service professional.'
                    });
                    e.target.reset();
                    notify('Service listed!');
                  }}
                  className="space-y-4 max-w-lg mx-auto text-xs"
                >
                  <h3 className="font-black text-slate-900 text-base">🛠️ Add Home Service</h3>
                  <input name="name" required placeholder="Service name" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  <input name="category" placeholder="plumbing / electrical" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  <input name="charge" type="number" defaultValue={149} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  <textarea name="description" rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  <input name="photoUrl" placeholder="Photo URL" className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm">Publish Service</button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* STORES DIRECTORY */}
        {tab === 'manage_stores' && (
          <div className="space-y-4">
            <h3 className="font-black text-slate-900 text-lg">🏬 Stores Directory ({stores.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stores.map((s) => (
                <div key={s._id} className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex gap-3">
                  <img src={s.photoUrl} className="w-16 h-16 rounded-2xl object-cover border" alt="" />
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm text-slate-900 truncate">{s.name}</h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${s.isOnline !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {s.isOnline !== false ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{s.address}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 flex-wrap">
                      <span className="badge-rating">{s.rating} ★</span>
                      <span className="font-bold text-indigo-600">{formatDistanceKm(s.distanceKm)}</span>
                      <span>Fee ₹{s.baseDeliveryFee ?? s.deliveryFee}</span>
                      <span>~{s.estDeliveryMins}m</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStoreOnline(s._id)}
                      className="mt-2 text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Toggle Online Status
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTS MATRIX */}
        {tab === 'manage_products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-black text-slate-900 text-lg">📦 Products Matrix ({products.length})</h3>
              <button
                type="button"
                onClick={() => {
                  setStudioForm('product');
                  setTab('creator_studio');
                }}
                className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs"
              >
                + Add New Product
              </button>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">MRP</th>
                      <th className="px-4 py-3 text-right">Lowest</th>
                      <th className="px-4 py-3">Stock / Availability ({activeStore?.name || 'Store'})</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => {
                      const offer =
                        (p.storeOffers || []).find((o) => String(o.storeId) === String(activeStoreId)) ||
                        (p.storeOffers || [])[0] || {
                          storeId: activeStoreId,
                          price: p.lowestPrice || p.mrp,
                          stockQuantity: 50,
                          isAvailable: p.inStock !== false
                        };
                      const inStock = offer.isAvailable !== false && (offer.stockQuantity ?? 0) > 0;
                      return (
                        <tr key={p._id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <img src={p.photoUrl} className="w-10 h-10 rounded-xl object-cover border aspect-square" alt="" />
                              <div>
                                <p className="font-bold text-slate-900 line-clamp-1">{p.name}</p>
                                <p className="text-[10px] text-slate-400">{p.brand} • {p.unit}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="capitalize">{p.categorySlug || p.categoryId?.slug}</span>
                            {(p.subcategorySlug || p.subcategoryId?.name) && (
                              <span className="block text-[10px] text-slate-400 font-bold truncate max-w-[140px]">
                                {p.subcategoryId?.name || p.subcategorySlug}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">₹{p.mrp}</td>
                          <td className="px-4 py-3 text-right font-black text-emerald-700">₹{p.lowestPrice || p.mrp}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="number"
                                min={0}
                                defaultValue={offer.stockQuantity ?? 50}
                                key={`${p._id}-${offer.storeId}-${offer.stockQuantity}`}
                                onBlur={(e) => editOfferStock(p, offer, e.target.value)}
                                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => toggleOfferAvailability(p, offer)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition ${
                                  inStock
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {inStock ? 'In Stock' : 'Out of Stock'}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={async () => {
                                const name = window.prompt('Product name', p.name);
                                if (name == null) return;
                                const mrpRaw = window.prompt('MRP (₹)', String(p.mrp));
                                if (mrpRaw == null) return;
                                const brand = window.prompt('Brand', p.brand || '');
                                if (brand == null) return;
                                try {
                                  await editProduct(p._id, {
                                    name: name.trim() || p.name,
                                    mrp: Number(mrpRaw) || p.mrp,
                                    brand
                                  });
                                  notify('Product updated');
                                } catch (err) {
                                  notify(err.message || 'Update failed');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mr-1"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`Delete product "${p.name}" permanently?`)) return;
                                try {
                                  await removeProduct(p._id);
                                  notify('Product deleted');
                                } catch (err) {
                                  notify(err.message || 'Delete failed');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS DISPATCH */}
        {tab === 'merchant_orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">📦 Live Orders Dispatch Queue ({liveOrders.length})</h3>
              <span className="text-xs text-slate-500">Shared live state across Customer ↔ Admin ↔ Rider</span>
            </div>
            {liveOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <span className="text-4xl">📬</span>
                <p className="font-black text-slate-800 text-sm mt-3">No Active Orders in Queue</p>
                <p className="text-xs text-slate-400 mt-1">Place an order from the customer storefront to see it live here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveOrders.map((o) => (
                  <div key={o.id || o.orderNumber} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {o.orderNumber}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          ['completed', 'delivered'].includes(o.status)
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {o.status}
                        </span>
                      </div>
                      <div className="mt-3">
                        <h4 className="font-black text-slate-900 text-sm">{o.storeName}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">👤 {o.customerName} • 📞 {o.customerPhone}</p>
                        <p className="text-xs text-slate-500 mt-0.5">📍 {o.deliveryAddress}</p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
                        {(o.items || []).map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-700">
                            <span>{it.quantity}x {it.name || it.productName} ({it.unit || it.unitSpec})</span>
                            <span className="font-bold">₹{(it.price || it.unitPrice || 0) * it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Total ({o.paymentMode})</p>
                        <p className="font-black text-sm text-emerald-700">₹{o.grandTotal}</p>
                        <p className="text-[10px] font-mono text-indigo-600 mt-0.5">OTP {o.otpCode || o.otp}</p>
                      </div>
                      {actionLabel(o.status) ? (
                        <button
                          type="button"
                          onClick={() => dispatchAction(o)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-sm"
                        >
                          {actionLabel(o.status)}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-bold">✅ Completed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CATEGORY MASTER — Super Admin only */}
        {tab === 'category_master' && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <span>🗂️ Category Master</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full">
                    Admin only
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload an image/icon, then drag rows to reorder. Sellers only select active categories.
                </p>
              </div>
              {reordering && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Saving order…
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = String(catDraft.name || '').trim();
                  if (!name) return;
                  if (catFormMode === 'sub' && !catParentId && !editingCategory) {
                    notify('Select a parent main category for the subcategory.');
                    return;
                  }
                  if (!editingCategory && !catDraft.photoUrl) {
                    notify('Please upload a category image/icon');
                    return;
                  }
                  setSavingCategory(true);
                  try {
                    const payload = {
                      name,
                      nameHi: catDraft.nameHi || '',
                      iconEmoji: catDraft.iconEmoji || (catFormMode === 'sub' ? '📁' : '🛒'),
                      photoUrl: catDraft.photoUrl || DEFAULT_CAT_PHOTO,
                      requiresLicence: Boolean(catDraft.requiresLicence),
                      parentId: catFormMode === 'sub' ? catParentId || null : null
                    };
                    if (editingCategory?._id) {
                      await editCategory(editingCategory._id, payload);
                      notify(`Updated "${name}"`);
                      clearCategoryEdit();
                    } else {
                      await addCategory({ ...payload, isActive: true });
                      notify(catFormMode === 'sub' ? `Subcategory "${name}" created` : `Category "${name}" created`);
                      clearCategoryEdit();
                    }
                  } catch (err) {
                    notify(err.message || 'Failed to save category');
                  } finally {
                    setSavingCategory(false);
                  }
                }}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                    {[
                      ['main', 'Main Category'],
                      ['sub', 'Subcategory']
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setCatFormMode(id);
                          if (!editingCategory) {
                            setCatDraft((d) => ({ ...d, iconEmoji: id === 'sub' ? '📁' : '🛒' }));
                          }
                        }}
                        disabled={Boolean(editingCategory)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                          catFormMode === id ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={clearCategoryEdit}
                      className="text-[10px] font-bold text-slate-500 hover:text-indigo-600"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
                <h4 className="font-black text-slate-900 text-sm">
                  {editingCategory
                    ? `✏️ Edit: ${editingCategory.name}`
                    : catFormMode === 'sub'
                      ? '➕ Add Subcategory'
                      : '➕ Add Main Category'}
                </h4>
                {catFormMode === 'sub' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Parent Main Category *</label>
                    <SearchableSelect
                      options={mainCategories.map((c) => ({ value: c._id, label: c.name }))}
                      value={catParentId}
                      onChange={setCatParentId}
                      placeholder="Search main category…"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Name *</label>
                  <input
                    required
                    value={catDraft.name}
                    onChange={(e) => setCatDraft((d) => ({ ...d, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Hindi name</label>
                  <input
                    value={catDraft.nameHi}
                    onChange={(e) => setCatDraft((d) => ({ ...d, nameHi: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Emoji icon</label>
                  <input
                    value={catDraft.iconEmoji}
                    onChange={(e) => setCatDraft((d) => ({ ...d, iconEmoji: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">
                    Image / Icon upload {editingCategory ? '' : '*'}
                  </label>
                  <div className="grid grid-cols-[88px_1fr] gap-3 items-start">
                    <div className="w-[88px] h-[88px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                      {catDraft.photoUrl ? (
                        <img
                          src={catDraft.photoUrl}
                          alt="Category"
                          className="w-full h-full object-cover"
                          onError={(ev) => {
                            ev.currentTarget.src = DEFAULT_CAT_PHOTO;
                          }}
                        />
                      ) : (
                        <span className="text-[9px] text-slate-400 font-bold text-center px-1">Preview</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(ev) => onCategoryImageFile(ev.target.files?.[0])}
                        className="w-full text-[11px] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-bold"
                      />
                      {catDraft.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setCatDraft((d) => ({ ...d, photoUrl: '' }))}
                          className="text-[10px] font-bold text-rose-600 hover:underline"
                        >
                          Remove image
                        </button>
                      )}
                      <p className="text-[10px] text-slate-400">
                        Upload JPG/PNG/WebP (max 4MB). Drag categories on the right to reorder.
                      </p>
                    </div>
                  </div>
                </div>

                {catFormMode === 'main' && (
                  <label className="flex items-center gap-2 font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={catDraft.requiresLicence}
                      onChange={(e) => setCatDraft((d) => ({ ...d, requiresLicence: e.target.checked }))}
                      className="rounded text-indigo-600"
                    />
                    Regulated (requires seller FSSAI/GSTIN) — e.g. Pharmacy
                  </label>
                )}
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl font-black text-sm"
                >
                  {savingCategory
                    ? 'Saving…'
                    : editingCategory
                      ? '💾 Update Category'
                      : catFormMode === 'sub'
                        ? 'Create Subcategory'
                        : 'Create Main Category'}
                </button>
              </form>

              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3 max-h-[70vh] overflow-y-auto">
                <h4 className="font-black text-slate-900 text-sm sticky top-0 bg-white pb-2 z-10">
                  Live tree ({mainList.length} mains) — drag ⋮⋮ to reorder
                </h4>
                {mainList.map((main) => {
                  const mainId = main._id;
                  const open = expandedMainId === String(mainId);
                  const subs = main.subcategories || [];
                  const draggingMain = String(dragMainId) === String(mainId);
                  return (
                    <div
                      key={mainId}
                      className={`border rounded-2xl overflow-hidden transition ${
                        draggingMain ? 'border-indigo-400 ring-2 ring-indigo-200 opacity-80' : 'border-slate-100'
                      }`}
                      draggable
                      onDragStart={(e) => {
                        setDragMainId(String(mainId));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        onMainDrop(mainId);
                      }}
                      onDragEnd={() => setDragMainId('')}
                    >
                      <div className="flex items-center gap-2 p-3 bg-slate-50">
                        <span
                          className="cursor-grab active:cursor-grabbing text-slate-400 font-black text-sm px-1 select-none"
                          title="Drag to reorder"
                        >
                          ⋮⋮
                        </span>
                        <img
                          src={main.photoUrl || DEFAULT_CAT_PHOTO}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                          onError={(ev) => {
                            ev.currentTarget.src = DEFAULT_CAT_PHOTO;
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setExpandedMainId(open ? '' : String(mainId))}
                          className="text-left flex-grow min-w-0"
                        >
                          <p className="font-black text-xs text-slate-900 truncate">
                            {main.iconEmoji} {main.name}
                            {main.nameHi ? <span className="text-slate-400 font-bold"> · {main.nameHi}</span> : null}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {subs.length} sub
                            {main.requiresLicence ? ' · 🔒 licence' : ''}
                            {main.isActive === false ? ' · inactive' : ''}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditCategory(main, false)}
                          className="px-2.5 py-1 rounded-xl font-bold text-[10px] bg-white border border-slate-200 text-indigo-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await toggleCategoryActive(mainId, main.isActive === false);
                              notify(main.isActive === false ? 'Category activated' : 'Category deactivated');
                            } catch (err) {
                              notify(err.message);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl font-bold text-[10px] ${
                            main.isActive === false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {main.isActive === false ? 'Activate' : 'Off'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(main, true)}
                          className="px-2.5 py-1 rounded-xl font-bold text-[10px] bg-rose-100 text-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                      {open && (
                        <div className="p-2 space-y-1.5">
                          {subs.length === 0 && (
                            <p className="text-[10px] text-slate-400 px-2 py-1">No subcategories yet</p>
                          )}
                          {subs.map((sub) => (
                            <div
                              key={sub._id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDragSub({ mainId: String(mainId), subId: String(sub._id) });
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSubDrop(mainId, sub._id);
                              }}
                              onDragEnd={() => setDragSub(null)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white border ${
                                dragSub?.subId === String(sub._id)
                                  ? 'border-indigo-300 ring-1 ring-indigo-200'
                                  : 'border-slate-100'
                              }`}
                            >
                              <span className="cursor-grab active:cursor-grabbing text-slate-300 text-xs select-none">⋮⋮</span>
                              <img
                                src={sub.photoUrl || main.photoUrl || DEFAULT_CAT_PHOTO}
                                alt=""
                                className="w-7 h-7 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                              />
                              <div className="flex-grow min-w-0">
                                <p className="font-bold text-[11px] text-slate-800 truncate">{sub.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono truncate">{sub.slug}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => startEditCategory(sub, true)}
                                className="px-2 py-1 rounded-lg font-bold text-[10px] bg-slate-50 text-indigo-700 border border-slate-200"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await toggleCategoryActive(sub._id, sub.isActive === false);
                                  } catch (err) {
                                    notify(err.message);
                                  }
                                }}
                                className={`px-2 py-1 rounded-lg font-bold text-[10px] ${
                                  sub.isActive === false
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {sub.isActive === false ? 'On' : 'Off'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(sub, false)}
                                className="px-2 py-1 rounded-lg font-bold text-[10px] bg-rose-50 text-rose-700"
                              >
                                Del
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCT APPROVALS — seller-submitted catalogue */}
        {tab === 'product_approvals' && isSuperAdmin && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <span>✅ Seller product approvals</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full">
                    {pendingProducts.length} pending
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seller-created products stay unpublished until you approve or decline.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await loadAdminQueues();
                  notify('Product queue refreshed');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700"
              >
                Refresh
              </button>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
              {pendingProducts.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold py-6 text-center">
                  No products awaiting approval
                </p>
              ) : (
                pendingProducts.map((p) => (
                  <div
                    key={p._id}
                    className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-2xl p-3 text-xs"
                  >
                    <img
                      src={p.photoUrl}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border"
                    />
                    <div className="flex-grow min-w-0">
                      <p className="font-black text-slate-900 truncate">{p.name}</p>
                      <p className="text-slate-400">
                        {p.categoryId?.name || '—'} / {p.subcategoryId?.name || '—'} · {p.brand || 'No brand'} · MRP ₹
                        {p.mrp} · {p.unit}
                      </p>
                      <div className="mt-1 rounded-lg bg-indigo-50 border border-indigo-100 px-2 py-1.5 text-[10px] font-bold text-indigo-900 space-y-0.5">
                        <p>
                          Seller: {p.sellerName || p.submittedBy?.name || 'Unknown'} ·{' '}
                          {p.sellerPhone || p.submittedBy?.phone || '—'}
                        </p>
                        <p>
                          Store: {p.storeName || p.sellerStore?.name || '—'}
                          {p.storeCity || p.sellerStore?.city
                            ? ` · ${p.storeCity || p.sellerStore?.city}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await patchProductApproval(p._id, 'approved');
                          notify(`Approved ${p.name}`);
                          setPendingProducts((prev) => prev.filter((x) => x._id !== p._id));
                        } catch (err) {
                          notify(err.message);
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await patchProductApproval(p._id, 'rejected');
                          notify(`Declined ${p.name}`);
                          setPendingProducts((prev) => prev.filter((x) => x._id !== p._id));
                        } catch (err) {
                          notify(err.message);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-xl font-bold"
                    >
                      Decline
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* KYC APPROVALS */}
        {tab === 'superadmin_approvals' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <span>👑 SuperAdmin KYC & Onboarding Approvals</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full">
                  {pendingCount} Pending
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seller KYC docs, support requests, riders. Product approvals are under the Product Approvals tab.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
              <h4 className="font-black text-sm text-slate-800">
                🛟 Seller support requests ({supportQueue.length})
              </h4>
              {supportQueue.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold">No open support requests</p>
              ) : (
                supportQueue.map((s) => (
                  <div key={s._id} className="border border-slate-100 rounded-2xl p-3 text-xs space-y-1">
                    <p className="font-black">
                      {s.type} · {s.status}
                    </p>
                    <p className="text-slate-600">{s.message}</p>
                    {s.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await updateSupportRequest(s._id, {
                              status: 'resolved',
                              adminNote: 'Processed by admin'
                            });
                            notify('Support request resolved');
                            setSupportQueue((prev) =>
                              prev.map((x) =>
                                x._id === s._id ? { ...x, status: 'resolved' } : x
                              )
                            );
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl font-bold"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await updateSupportRequest(s._id, { status: 'rejected' });
                            notify('Support request rejected');
                            setSupportQueue((prev) =>
                              prev.map((x) =>
                                x._id === s._id ? { ...x, status: 'rejected' } : x
                              )
                            );
                          }}
                          className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-xl font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <form
                className="bg-white rounded-3xl p-4 border border-slate-200 space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.target;
                  try {
                    await addDriver({
                      name: f.name.value,
                      phone: f.phone.value,
                      vehicleType: f.vehicleType.value,
                      plateNumber: f.plateNumber.value,
                      licenseNo: f.licenseNo.value,
                      city: f.city.value,
                      status: 'approved'
                    });
                    notify(`Rider ${f.name.value} saved to MongoDB`);
                    f.reset();
                  } catch (err) {
                    notify(err.message || 'Failed to add rider');
                  }
                }}
              >
                <h4 className="font-black text-sm text-slate-800">+ Add Rider (live)</h4>
                <input name="name" required placeholder="Rider name" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="phone" required placeholder="Phone" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="vehicleType" placeholder="Vehicle" defaultValue="Hero Splendor (Bike)" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="plateNumber" placeholder="Plate number" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="licenseNo" placeholder="License no" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="city" placeholder="City" defaultValue="Noida" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Save Rider</button>
              </form>

              <form
                className="bg-white rounded-3xl p-4 border border-slate-200 space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.target;
                  try {
                    await addStore({
                      name: f.name.value,
                      ownerName: f.ownerName.value,
                      phone: f.phone.value,
                      photoUrl: f.photoUrl.value || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=80',
                      address: f.address.value,
                      pincode: f.pincode.value,
                      city: f.city.value,
                      lat: Number(f.lat.value),
                      lng: Number(f.lng.value),
                      gstin: f.gstin.value,
                      status: 'approved',
                      isOnline: true
                    });
                    notify(`Store ${f.name.value} saved to MongoDB`);
                    f.reset();
                  } catch (err) {
                    notify(err.message || 'Failed to add store');
                  }
                }}
              >
                <h4 className="font-black text-sm text-slate-800">+ Add Store (live)</h4>
                <input name="name" required placeholder="Store name" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="ownerName" required placeholder="Owner name" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="phone" required placeholder="Phone" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="address" required placeholder="Address" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="pincode" required defaultValue="201301" className="border rounded-xl px-3 py-2 text-xs" />
                  <input name="city" required defaultValue="Noida" className="border rounded-xl px-3 py-2 text-xs" />
                  <input name="lat" required defaultValue="28.628" className="border rounded-xl px-3 py-2 text-xs" />
                  <input name="lng" required defaultValue="77.3649" className="border rounded-xl px-3 py-2 text-xs" />
                </div>
                <input name="gstin" placeholder="GSTIN" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="photoUrl" placeholder="Photo URL" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">Save Store</button>
              </form>

              <form
                className="bg-white rounded-3xl p-4 border border-slate-200 space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.target;
                  try {
                    await addService({
                      name: f.name.value,
                      category: serviceCategory || f.category?.value || 'other',
                      visitCharge: Number(f.visitCharge.value),
                      photoUrl: f.photoUrl.value || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80',
                      description: f.description.value,
                      provider: {
                        name: f.providerName.value,
                        phone: f.providerPhone.value,
                        experienceYears: Number(f.experienceYears.value || 3),
                        badge: f.badge.value || 'Verified Pro'
                      },
                      city: f.city.value || 'Noida',
                      status: 'approved'
                    });
                    notify(`Service ${f.name.value} saved to MongoDB`);
                    f.reset();
                  } catch (err) {
                    notify(err.message || 'Failed to add service');
                  }
                }}
              >
                <h4 className="font-black text-sm text-slate-800">+ Add Service (live)</h4>
                <input name="name" required placeholder="Service name" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <SearchableSelect
                  name="category"
                  options={[
                    { value: 'plumbing', label: 'Plumbing' },
                    { value: 'electrical', label: 'Electrical' },
                    { value: 'ac', label: 'AC' },
                    { value: 'cleaning', label: 'Cleaning' },
                    { value: 'appliance', label: 'Appliance' },
                    { value: 'carpentry', label: 'Carpentry' },
                    { value: 'beauty', label: 'Beauty' },
                    { value: 'other', label: 'Other' }
                  ]}
                  value={serviceCategory}
                  onChange={setServiceCategory}
                  placeholder="Search service category…"
                  required
                />
                <input name="visitCharge" required type="number" defaultValue="149" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="providerName" required placeholder="Provider name" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="providerPhone" required placeholder="Provider phone" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="experienceYears" type="number" defaultValue="5" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="badge" placeholder="Badge" defaultValue="Verified Pro" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="city" defaultValue="Noida" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <input name="photoUrl" placeholder="Photo URL" className="w-full border rounded-xl px-3 py-2 text-xs" />
                <textarea name="description" placeholder="Description" className="w-full border rounded-xl px-3 py-2 text-xs" rows={2} />
                <button type="submit" className="w-full py-2 bg-violet-600 text-white rounded-xl text-xs font-bold">Save Service</button>
              </form>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-slate-800">🛵 Pending Rider KYCs</h4>
                <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  {pendingDriverKYCs.length} Applications
                </span>
              </div>
              {pendingDriverKYCs.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-xs text-slate-400">
                  No pending rider KYCs
                </div>
              ) : (
                pendingDriverKYCs.map((app) => {
                  const appId = app.id || app._id;
                  return (
                  <div key={appId} className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-black text-sm text-slate-900">{app.name}</h5>
                        <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Pending KYC</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{app.phone} • {app.vehicleType} • {app.plateNumber}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">License {app.licenseNo} • Aadhaar {app.aadhaarNo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={async () => { try { await approveDriverKYC(appId); notify(`Rider ${app.name} approved!`); } catch (err) { notify(err.message); } }} className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs">Approve</button>
                      <button type="button" onClick={async () => { try { await rejectDriverKYC(appId); notify('Rider KYC rejected'); } catch (err) { notify(err.message); } }} className="px-3.5 py-2 bg-rose-100 text-rose-700 rounded-xl font-bold text-xs">Reject</button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-slate-800">🏬 Pending Store Merchant KYCs</h4>
                <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  {pendingStoreApprovals.length} Applications
                </span>
              </div>
              {pendingStoreApprovals.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-xs text-slate-400">
                  No pending store applications
                </div>
              ) : (
                pendingStoreApprovals.map((store) => {
                  const storeId = store.id || store._id;
                  return (
                  <div key={storeId} className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={store.photoUrl} className="w-12 h-12 rounded-xl object-cover border" alt="" />
                      <div>
                        <h5 className="font-black text-sm text-slate-900">{store.name}</h5>
                        <p className="text-xs text-slate-500">{store.ownerName} • {store.phone}</p>
                        <p className="text-[11px] text-slate-400">{store.address}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">
                          PAN {store.panNumber || '—'} · GST {store.gstNumber || store.gstin || '—'} · Enroll {store.enrollmentNumber || '—'} · FSSAI {store.fssai || '—'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Fee paid: {store.registrationFeePaid ? 'Yes' : 'No'} · Bank {store.bankAccount || '—'} / {store.ifsc || '—'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {store.panDocUrl && <a href={store.panDocUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600">PAN doc</a>}
                          {store.gstDocUrl && <a href={store.gstDocUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600">GST doc</a>}
                          {store.enrollmentDocUrl && <a href={store.enrollmentDocUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600">Enrollment doc</a>}
                          {store.bankProofUrl && <a href={store.bankProofUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600">Bank proof</a>}
                          {store.fssaiDocUrl && <a href={store.fssaiDocUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600">FSSAI doc</a>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={async () => { try { await approveStoreKYC(storeId); notify(`Store ${store.name} approved!`); } catch (err) { notify(err.message); } }} className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs">Approve</button>
                      <button type="button" onClick={async () => { try { await rejectStoreKYC(storeId); notify('Store KYC rejected'); } catch (err) { notify(err.message); } }} className="px-3.5 py-2 bg-rose-100 text-rose-700 rounded-xl font-bold text-xs">Reject</button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200">
              <h4 className="font-black text-sm text-slate-800 mb-3">🛵 Active Fleet ({drivers.length})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {drivers.map((d) => (
                  <div key={d.id || d._id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{d.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{d.plateNumber}</p>
                    </div>
                    <span className="badge-rating">{d.rating} ★</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400">Services in catalog: {services.length} (from MongoDB)</p>
          </div>
        )}
      </div>
    </div>
  );
}
