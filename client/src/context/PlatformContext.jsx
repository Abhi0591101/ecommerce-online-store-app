import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EMPTY_LOCATION } from '../data/defaults';
import { useAuth } from './AuthContext';
import {
  createCategory as createCategoryApi,
  createRider as createRiderApi,
  createService as createServiceApi,
  createStore as createStoreApi,
  deleteCategory as deleteCategoryApi,
  deleteProduct as deleteProductApi,
  getCategories,
  getCategoryTree,
  getLocations,
  getOrders,
  getPendingRiders,
  getPendingStores,
  getProducts,
  getRiders,
  getServices,
  getStores,
  reorderCategories as reorderCategoriesApi,
  setCategoryStatus as setCategoryStatusApi,
  toggleStoreStatus as toggleStoreStatusApi,
  updateCategory as updateCategoryApi,
  updateOrderStatus as updateOrderStatusApi,
  updateProduct as updateProductApi,
  updateRiderDuty,
  updateRiderStatus,
  updateStoreKycStatus
} from '../services/api';
import { getSocket, joinRidersRoom, joinStoreRooms, setRiderDutySocket } from '../services/socket';
import { withStoreDistances } from '../utils/geo';
import {
  ensureAudioUnlockedOnGesture,
  playAlert,
  playDoubleBeep
} from '../utils/audio';
import {
  loadPersistedLocation,
  loadPersistedOrders,
  persistLocation,
  persistOrders
} from '../utils/offlineStore';
import {
  detectCurrentDeliveryLocation,
  hasUsableDeliveryLocation,
  isFallbackLocation,
  isValidIndianPin
} from '../utils/detectLocation';

const PlatformContext = createContext(null);

const enrichProduct = (p) => ({
  ...p,
  categorySlug: p.categoryId?.slug || p.categorySlug,
  subcategorySlug: p.subcategoryId?.slug || p.subcategorySlug,
  storeOffers:
    Array.isArray(p.storeOffers) && p.storeOffers.length
      ? p.storeOffers
      : p.lowestStore
        ? [
            {
              storeId: p.lowestStore.storeId,
              price: p.lowestPrice,
              stockQuantity: 50,
              deliveryFee:
                p.lowestPrice >= (p.lowestStore.freeDeliveryAbove || 0)
                  ? 0
                  : p.lowestStore.baseDeliveryFee || 0,
              totalCost:
                p.lowestPrice +
                (p.lowestPrice >= (p.lowestStore.freeDeliveryAbove || 0)
                  ? 0
                  : p.lowestStore.baseDeliveryFee || 0)
            }
          ]
        : []
});

const isMainCategory = (c) => !c.parentId || c.parentId === null || c.isMain === true;

const normalizeIncomingOrder = (order) => {
  const storeId =
    typeof order.storeId === 'object' && order.storeId !== null
      ? order.storeId._id || order.storeId.id
      : order.storeId;

  const storeName =
    order.storeName ||
    (typeof order.storeId === 'object' ? order.storeId?.name : null) ||
    'Store';

  const [storeLng, storeLat] =
    typeof order.storeId === 'object' && order.storeId?.location?.coordinates
      ? order.storeId.location.coordinates
      : [order.storeLng, order.storeLat];

  return {
    id: order._id || order.orderId || order.id || `ord-${Date.now()}`,
    orderNumber: order.orderNumber,
    storeId,
    storeName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    pincode: order.pincode || '',
    items: (order.items || []).map((it) => ({
      ...it,
      name: it.productName || it.name,
      price: it.unitPrice ?? it.price,
      unit: it.unitSpec || it.unit,
      photoUrl: it.photoUrl
    })),
    itemsTotal: order.itemsTotal,
    deliveryFee: order.deliveryFee || 0,
    grandTotal: order.grandTotal,
    paymentMode: order.paymentMode || 'COD',
    orderType: order.orderType || 'delivery',
    timeSlot: order.timeSlot,
    status: order.status || 'placed',
    otpCode: order.otpCode,
    otp: order.otpCode,
    placedAt:
      order.placedAt ||
      (order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString()),
    storeLat: order.storeLat ?? storeLat,
    storeLng: order.storeLng ?? storeLng,
    customerLat: order.customerLat,
    customerLng: order.customerLng,
    driverId: order.driverId || null,
    payout: order.payout || Math.floor(45 + (order.deliveryFee || 15) * 1.5),
    savings: order.savings || 0
  };
};

export function PlatformProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const isSuperAdmin = isAuthenticated && user?.role === 'superadmin';

  const [view, setView] = useState('customer');
  const [location, setLocationState] = useState(() => {
    const persisted = loadPersistedLocation();
    if (persisted && isValidIndianPin(persisted.pincode) && !isFallbackLocation(persisted)) {
      return { ...persisted, detecting: true };
    }
    // No hardcoded city/PIN — wait for live GPS (or user PIN picker)
    return {
      ...EMPTY_LOCATION,
      area: 'Detecting location…',
      detecting: true
    };
  });
  const [locationDetecting, setLocationDetecting] = useState(true);
  const [needLocationPicker, setNeedLocationPicker] = useState(false);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState(() => loadPersistedOrders());
  const [drivers, setDrivers] = useState([]);
  const [pendingStoreApprovals, setPendingStoreApprovals] = useState([]);
  const [pendingDriverKYCs, setPendingDriverKYCs] = useState([]);
  const [activeDriverId, setActiveDriverId] = useState(null);
  const [riderOnDuty, setRiderOnDuty] = useState(true);
  const [activeRunId, setActiveRunId] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [lastRadarOrder, setLastRadarOrder] = useState(null);
  const [catalogError, setCatalogError] = useState('');

  const setLocation = useCallback((next) => {
    setLocationState(next);
    persistLocation(next);
  }, []);

  useEffect(() => ensureAudioUnlockedOnGesture(), []);

  // Every page load / new browser session: refresh PIN from live GPS (like pincode.app)
  useEffect(() => {
    let cancelled = false;
    setLocationDetecting(true);
    setNeedLocationPicker(false);

    (async () => {
      // Small delay so React StrictMode remount does not abort a useful GPS read
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      let lastErr = null;
      for (let attempt = 0; attempt < 2 && !cancelled; attempt += 1) {
        try {
          const next = await detectCurrentDeliveryLocation({
            timeoutMs: 15000,
            minSamples: 2,
            targetAccuracyM: 80
          });
          if (cancelled || !isValidIndianPin(next.pincode)) continue;
          setLocation({
            pincode: next.pincode,
            area: next.area,
            city: next.city,
            state: next.state || '',
            lat: next.lat,
            lng: next.lng,
            radiusKm: 5,
            accuracyM: next.accuracyM,
            source: 'gps',
            confirmedAt: Date.now(),
            detecting: false
          });
          setLocationDetecting(false);
          setNeedLocationPicker(false);
          return;
        } catch (err) {
          lastErr = err;
          console.warn('[location] detect attempt failed:', err?.message || err);
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      if (cancelled) return;
      setLocationDetecting(false);
      // GPS is the source of truth — do not fall back to a hardcoded city PIN.
      // Only reuse last confirmed user PIN if GPS failed this session.
      const persisted = loadPersistedLocation();
      if (persisted && isValidIndianPin(persisted.pincode) && !isFallbackLocation(persisted)) {
        setLocation({ ...persisted, detecting: false });
      } else {
        setLocationState({
          ...EMPTY_LOCATION,
          area: 'Set delivery location',
          detecting: false
        });
        setNeedLocationPicker(true);
      }
      if (lastErr) console.warn('[location] auto-detect gave up:', lastErr?.message || lastErr);
    })();

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  useEffect(() => {
    persistOrders(orders);
  }, [orders]);

  const activeDriver = useMemo(
    () => drivers.find((d) => String(d.id) === String(activeDriverId)) || drivers[0] || null,
    [drivers, activeDriverId]
  );

  const activeStoreId = stores[0]?._id || null;
  const activeStore = stores.find((s) => String(s._id) === String(activeStoreId)) || stores[0];

  const mainCategories = useMemo(
    () => categories.filter((c) => isMainCategory(c) && c.isActive !== false),
    [categories]
  );

  const subcategoriesOf = useCallback(
    (mainIdOrSlug) =>
      categories.filter((c) => {
        if (isMainCategory(c) || c.isActive === false) return false;
        const parent = c.parentId;
        const parentId = typeof parent === 'object' && parent ? parent._id || parent.id : parent;
        const main = categories.find(
          (m) =>
            String(m._id) === String(mainIdOrSlug) ||
            m.slug === mainIdOrSlug
        );
        return main && String(parentId) === String(main._id);
      }),
    [categories]
  );

  const upsertOrder = useCallback((incoming) => {
    const normalized = normalizeIncomingOrder(incoming);
    setOrders((prev) => {
      const idx = prev.findIndex(
        (o) => o.orderNumber === normalized.orderNumber || o.id === normalized.id
      );
      if (idx === -1) return [normalized, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], ...normalized };
      return next;
    });
    return normalized;
  }, []);

  const refreshAdminQueues = useCallback(async () => {
    // Admin-only endpoints — skip when guest / customer / seller / etc. (avoids 401 console noise)
    if (!isSuperAdmin) {
      setPendingStoreApprovals([]);
      setPendingDriverKYCs([]);
      return;
    }
    try {
      const [pendingStores, pendingRiders, riders] = await Promise.all([
        getPendingStores().catch(() => ({ data: [] })),
        getPendingRiders().catch(() => ({ data: [] })),
        getRiders({ status: 'approved' }).catch(() => ({ data: [] }))
      ]);
      setPendingStoreApprovals(pendingStores.data || []);
      setPendingDriverKYCs(pendingRiders.data || []);
      const fleet = riders.data || [];
      setDrivers(fleet);
      setActiveDriverId((prev) => {
        if (prev && fleet.some((d) => String(d.id) === String(prev))) return prev;
        return fleet[0]?.id || null;
      });
    } catch {
      /* ignore */
    }
  }, [isSuperAdmin]);

  const hydrate = useCallback(async () => {
    try {
      const canFetchCatalog = hasUsableDeliveryLocation(location);
      const locQuery = canFetchCatalog
        ? {
            lat: location.lat,
            lng: location.lng,
            city: location.city,
            radiusKm: location.radiusKm || 40,
            pincode: location.pincode
          }
        : null;

      const [catRes, treeRes, prodRes, storeRes, orderRes, serviceRes, locationRes, riderRes] =
        await Promise.all([
          getCategories({ includeInactive: 1 }).catch(() => getCategories()),
          getCategoryTree(true).catch(() => ({ data: [] })),
          locQuery ? getProducts(locQuery) : Promise.resolve({ data: [] }),
          locQuery ? getStores(locQuery) : Promise.resolve({ data: [] }),
          getOrders(),
          location.city ? getServices({ city: location.city }) : Promise.resolve({ data: [] }),
          getLocations(),
          getRiders({ status: 'approved' })
        ]);

      setCategories(catRes.data || []);
      setCategoryTree(treeRes.data || []);
      setProducts(canFetchCatalog ? (prodRes.data || []).map(enrichProduct) : []);
      setStores(canFetchCatalog ? withStoreDistances(storeRes.data || [], location) : []);
      setServices(serviceRes.data || []);
      setServiceAreas(locationRes.data || []);

      if (orderRes?.data?.length) {
        setOrders((prev) => {
          const fromApi = orderRes.data.map(normalizeIncomingOrder);
          const merged = [...fromApi];
          prev.forEach((o) => {
            if (!merged.some((m) => m.orderNumber === o.orderNumber)) merged.push(o);
          });
          return merged;
        });
      }

      const fleet = riderRes.data || [];
      setDrivers(fleet);
      setActiveDriverId((prev) => {
        if (prev && fleet.some((d) => String(d.id) === String(prev))) return prev;
        return fleet[0]?.id || null;
      });

      setApiOnline(true);
      setCatalogError('');
      await refreshAdminQueues();
    } catch (err) {
      setApiOnline(false);
      setCatalogError(err.message || 'Unable to reach API / MongoDB');
      setCategories([]);
      setProducts([]);
      setStores([]);
      setServices([]);
    }
  }, [
    location.lat,
    location.lng,
    location.radiusKm,
    location.pincode,
    location.city,
    location.detecting,
    setLocation,
    refreshAdminQueues
  ]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // After admin session becomes available (token boot / login), load pending queues
  useEffect(() => {
    if (isSuperAdmin) refreshAdminQueues();
  }, [isSuperAdmin, refreshAdminQueues]);

  useEffect(() => {
    const socket = getSocket();

    const onNewOrder = (payload) => {
      upsertOrder(payload);
      playDoubleBeep();
    };
    const onStatus = (payload) => upsertOrder(payload);
    const onRadar = (payload) => {
      const normalized = upsertOrder({ ...payload, status: payload.status || 'ready_for_pickup' });
      setLastRadarOrder(normalized);
      playDoubleBeep();
      playAlert(980);
    };
    const onCompleted = (payload) => {
      upsertOrder({ ...payload, status: 'completed' });
      if (payload.orderId || payload.orderNumber) {
        setActiveRunId((current) => {
          if (!current) return current;
          if (
            String(current) === String(payload.orderId) ||
            String(current) === String(payload.orderNumber)
          ) {
            return null;
          }
          return current;
        });
      }
    };

    socket.on('order:new', onNewOrder);
    socket.on('order:placed', onNewOrder);
    socket.on('order:status', onStatus);
    socket.on('order:radar', onRadar);
    socket.on('order:completed', onCompleted);
    socket.on('delivery:completed', onCompleted);

    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('order:placed', onNewOrder);
      socket.off('order:status', onStatus);
      socket.off('order:radar', onRadar);
      socket.off('order:completed', onCompleted);
      socket.off('delivery:completed', onCompleted);
    };
  }, [upsertOrder]);

  useEffect(() => {
    const ids = stores.map((s) => s._id).filter(Boolean);
    if (ids.length) joinStoreRooms(ids);
  }, [stores]);

  useEffect(() => {
    setRiderDutySocket(riderOnDuty);
    if (riderOnDuty) joinRidersRoom();
  }, [riderOnDuty]);

  const toggleStoreOnline = useCallback(
    async (storeId) => {
      const id = storeId || activeStoreId;
      if (!id) return;
      try {
        const res = await toggleStoreStatusApi(id);
        setStores((prev) =>
          prev.map((s) =>
            String(s._id) === String(id) ? { ...s, isOnline: res.data?.isOnline } : s
          )
        );
      } catch {
        setStores((prev) =>
          prev.map((s) =>
            String(s._id) === String(id) ? { ...s, isOnline: !s.isOnline } : s
          )
        );
      }
    },
    [activeStoreId]
  );

  const setStoreOnline = useCallback((storeId, isOnline) => {
    setStores((prev) =>
      prev.map((s) =>
        String(s._id) === String(storeId) ? { ...s, isOnline: !!isOnline } : s
      )
    );
  }, []);

  const addOrder = useCallback((order) => upsertOrder(order), [upsertOrder]);

  const updateOrderStatus = useCallback(async (orderNumberOrId, status, extra = {}) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.orderNumber === orderNumberOrId || o.id === orderNumberOrId
          ? { ...o, status, ...extra }
          : o
      )
    );
    try {
      await updateOrderStatusApi(orderNumberOrId, status);
    } catch {
      /* local optimistic update kept */
    }
  }, []);

  const addProduct = useCallback((product) => {
    setProducts((prev) => [enrichProduct(product), ...prev]);
  }, []);

  const updateProductOffer = useCallback((productId, storeId, patch) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (String(p._id) !== String(productId)) return p;
        const offers = (p.storeOffers || []).map((o) =>
          String(o.storeId) === String(storeId) ? { ...o, ...patch } : o
        );
        if (!offers.some((o) => String(o.storeId) === String(storeId)) && storeId) {
          offers.push({
            storeId,
            price: p.lowestPrice || p.mrp,
            stockQuantity: patch.stockQuantity ?? 50,
            isAvailable: patch.isAvailable !== false,
            ...patch
          });
        }
        const available = offers.filter(
          (o) => o.isAvailable !== false && (o.stockQuantity ?? 0) > 0
        );
        const lowest = available.sort((a, b) => a.price - b.price)[0];
        return {
          ...p,
          storeOffers: offers,
          lowestPrice: lowest?.price ?? p.lowestPrice,
          inStock: available.length > 0,
          isAvailable: available.length > 0
        };
      })
    );
  }, []);

  const addStore = useCallback(
    async (storePayload) => {
      const res = await createStoreApi(storePayload);
      const store = res.data;
      if (store.status === 'approved') {
        setStores((prev) => withStoreDistances([store, ...prev], location));
      } else {
        setPendingStoreApprovals((prev) => [
          {
            id: String(store._id),
            _id: store._id,
            name: store.name,
            ownerName: store.ownerName,
            phone: store.phone,
            category: store.category,
            address: store.address,
            pincode: store.pincode,
            gstin: store.gstin,
            fssai: store.fssai,
            photoUrl: store.photoUrl,
            status: 'pending',
            submittedAt: new Date().toLocaleString()
          },
          ...prev
        ]);
      }
      return store;
    },
    [location]
  );

  const refreshCategories = useCallback(async () => {
    const [catRes, treeRes] = await Promise.all([
      getCategories({ includeInactive: 1 }).catch(() => getCategories()),
      getCategoryTree(true).catch(() => ({ data: [] }))
    ]);
    setCategories(catRes.data || []);
    setCategoryTree(treeRes.data || []);
    return catRes.data || [];
  }, []);

  /** Super Admin only — create main category or subcategory */
  const addCategory = useCallback(async (payload) => {
    const res = await createCategoryApi(payload);
    await refreshCategories();
    return res.data;
  }, [refreshCategories]);

  const editCategory = useCallback(async (id, payload) => {
    const res = await updateCategoryApi(id, payload);
    await refreshCategories();
    return res.data;
  }, [refreshCategories]);

  const toggleCategoryActive = useCallback(async (id, isActive) => {
    const res = await setCategoryStatusApi(id, isActive);
    await refreshCategories();
    return res.data;
  }, [refreshCategories]);

  const reorderCategoryList = useCallback(async (items) => {
    const res = await reorderCategoriesApi(items);
    await refreshCategories();
    return res.data;
  }, [refreshCategories]);

  const removeCategory = useCallback(async (id, opts = {}) => {
    const res = await deleteCategoryApi(id, { cascade: true, force: true, ...opts });
    await refreshCategories();
    // Refresh catalog so deactivated products drop out of storefront
    try {
      if (hasUsableDeliveryLocation(location)) {
        const prodRes = await getProducts({
          lat: location.lat,
          lng: location.lng,
          city: location.city,
          radiusKm: location.radiusKm || 40,
          pincode: location.pincode
        });
        setProducts((prodRes.data || []).map(enrichProduct));
      } else {
        setProducts([]);
      }
    } catch {
      /* ignore */
    }
    return res.data;
  }, [refreshCategories, location.lat, location.lng, location.city, location.radiusKm, location.pincode]);

  const editProduct = useCallback(async (id, payload) => {
    const res = await updateProductApi(id, payload);
    const enriched = enrichProduct(res.data);
    setProducts((prev) =>
      prev.map((p) => (String(p._id) === String(id) ? { ...p, ...enriched } : p))
    );
    return enriched;
  }, []);

  const removeProduct = useCallback(async (id) => {
    await deleteProductApi(id);
    setProducts((prev) => prev.filter((p) => String(p._id) !== String(id)));
  }, []);

  const addService = useCallback(async (servicePayload) => {
    const res = await createServiceApi(servicePayload);
    if (res.data?.status === 'approved') {
      setServices((prev) => [res.data, ...prev]);
    }
    return res.data;
  }, []);

  const addDriver = useCallback(async (driverPayload) => {
    const res = await createRiderApi({
      ...driverPayload,
      status: driverPayload.status || 'approved',
      isOnline: true
    });
    const driver = res.data;
    if (driver.status === 'approved') {
      setDrivers((prev) => [...prev, driver]);
      setActiveDriverId((prev) => prev || driver.id);
    } else {
      setPendingDriverKYCs((prev) => [driver, ...prev]);
    }
    return driver;
  }, []);

  const approveStoreKYC = useCallback(async (id) => {
    const res = await updateStoreKycStatus(id, 'approved');
    setPendingStoreApprovals((prev) => prev.filter((s) => String(s.id || s._id) !== String(id)));
    if (res.data) {
      setStores((prev) => withStoreDistances([res.data, ...prev], location));
    }
    return res.data;
  }, [location]);

  const rejectStoreKYC = useCallback(async (id) => {
    await updateStoreKycStatus(id, 'rejected');
    setPendingStoreApprovals((prev) => prev.filter((s) => String(s.id || s._id) !== String(id)));
  }, []);

  const approveDriverKYC = useCallback(async (id) => {
    const res = await updateRiderStatus(id, 'approved');
    setPendingDriverKYCs((prev) => prev.filter((d) => String(d.id || d._id) !== String(id)));
    if (res.data) {
      setDrivers((prev) => [...prev, res.data]);
    }
    return res.data;
  }, []);

  const rejectDriverKYC = useCallback(async (id) => {
    await updateRiderStatus(id, 'rejected');
    setPendingDriverKYCs((prev) => prev.filter((d) => String(d.id || d._id) !== String(id)));
  }, []);

  const submitDriverKYC = useCallback(async (payload) => {
    const res = await createRiderApi({ ...payload, status: 'pending' });
    setPendingDriverKYCs((prev) => [res.data, ...prev]);
    return res.data;
  }, []);

  const getDispatchableOrders = useCallback(() => {
    return orders.filter(
      (o) =>
        o.orderType !== 'pickup' &&
        ['placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery'].includes(
          o.status
        ) &&
        !o.driverId &&
        o.status !== 'completed' &&
        o.status !== 'delivered'
    ).filter(
      (o) =>
        ['accepted', 'packing', 'ready_for_pickup'].includes(o.status) || o.status === 'placed'
    );
  }, [orders]);

  const acceptDelivery = useCallback((orderId, driverId) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, driverId, status: 'driver_assigned' }
          : o
      )
    );
    setActiveRunId(orderId);
  }, []);

  const getActiveRun = useCallback(() => {
    if (!activeRunId) return null;
    return orders.find((o) => o.id === activeRunId || o.orderNumber === activeRunId) || null;
  }, [orders, activeRunId]);

  const completeDelivery = useCallback(
    async (orderId, payout = 55) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId || o.orderNumber === orderId ? { ...o, status: 'completed' } : o
        )
      );
      setDrivers((prev) =>
        prev.map((d) =>
          String(d.id) === String(activeDriverId)
            ? {
              ...d,
              todayEarnings: (d.todayEarnings || 0) + payout,
              completedDeliveries: (d.completedDeliveries || 0) + 1
            }
            : d
        )
      );
      if (activeDriverId) {
        const driver = drivers.find((d) => String(d.id) === String(activeDriverId));
        try {
          await updateRiderDuty(activeDriverId, {
            todayEarnings: (driver?.todayEarnings || 0) + payout,
            completedDeliveries: (driver?.completedDeliveries || 0) + 1
          });
        } catch {
          /* ignore */
        }
      }
      setActiveRunId(null);
    },
    [activeDriverId, drivers]
  );

  const generateDemoOrder = useCallback(() => {
    const store = stores[0];
    const product = products[0];
    if (!store || !product) return null;
    return addOrder({
      orderNumber: `ORD-${Math.random().toString(16).slice(2, 8).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`,
      otpCode: String(Math.floor(1000 + Math.random() * 9000)),
      storeId: store._id,
      storeName: store.name,
      customerName: 'Demo Customer',
      customerPhone: '9876543210',
      deliveryAddress: `Flat 402, Tower B, ${location.area}`,
      items: [
        {
          productId: product._id,
          name: product.name,
          photoUrl: product.photoUrl,
          unit: product.unit,
          quantity: 1,
          price: product.lowestPrice || product.mrp,
          storeId: store._id
        }
      ],
      itemsTotal: product.lowestPrice || 100,
      deliveryFee: store.baseDeliveryFee || 20,
      grandTotal: (product.lowestPrice || 100) + (store.baseDeliveryFee || 20),
      paymentMode: 'COD',
      orderType: 'delivery',
      timeSlot: '⚡ Express Delivery (15-25 Mins)',
      status: 'packing',
      storeLat: store.lat || 28.628,
      storeLng: store.lng || 77.3649,
      customerLat: (store.lat || 28.628) - 0.0035,
      customerLng: (store.lng || 77.3649) + 0.0025
    });
  }, [addOrder, stores, products, location]);

  const value = {
    view,
    setView,
    location,
    setLocation,
    locationDetecting,
    needLocationPicker,
    setNeedLocationPicker,
    serviceAreas,
    categories,
    categoryTree,
    mainCategories,
    subcategoriesOf,
    stores,
    products,
    services,
    orders,
    drivers,
    pendingStoreApprovals,
    pendingDriverKYCs,
    activeDriverId,
    setActiveDriverId,
    activeDriver,
    activeStore,
    activeStoreId,
    riderOnDuty,
    setRiderOnDuty,
    activeRunId,
    setActiveRunId,
    toggleStoreOnline,
    setStoreOnline,
    addOrder,
    updateOrderStatus,
    addProduct,
    updateProductOffer,
    addStore,
    addCategory,
    editCategory,
    toggleCategoryActive,
    reorderCategoryList,
    removeCategory,
    refreshCategories,
    editProduct,
    removeProduct,
    addService,
    addDriver,
    approveStoreKYC,
    rejectStoreKYC,
    approveDriverKYC,
    rejectDriverKYC,
    submitDriverKYC,
    getDispatchableOrders,
    acceptDelivery,
    getActiveRun,
    completeDelivery,
    generateDemoOrder,
    setProducts,
    setStores,
    setCategories,
    setServices,
    apiOnline,
    catalogError,
    refreshCatalog: hydrate,
    refreshAdminQueues,
    lastRadarOrder,
    clearLastRadarOrder: () => setLastRadarOrder(null)
  };

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}

export default PlatformContext;
