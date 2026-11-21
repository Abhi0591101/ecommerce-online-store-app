import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCategories, getProducts, getStores, API_BASE } from '../services/api';
import { loadCartState, persistCartState } from '../utils/offlineStore';

const CartContext = createContext(null);

export { API_BASE };

export async function fetchLiveCatalog({ lat = 28.628, lng = 77.3649, category, search } = {}) {
  const [categories, products, stores] = await Promise.all([
    getCategories(),
    getProducts({ category, search }),
    getStores({ lat, lng })
  ]);
  return {
    categories: categories?.data || [],
    products: products?.data || [],
    stores: stores?.data || [],
    apiOnline: true
  };
}

const EXPRESS_SLOT = '⚡ Express Delivery (15-25 Mins)';
const PICKUP_SLOT = '🏬 Instant Store Pickup (Ready in 15 mins)';

const TIME_SLOTS = [
  { id: 'slot-1', type: 'delivery', label: EXPRESS_SLOT, tag: 'FASTEST', fee: 25 },
  { id: 'slot-2', type: 'delivery', label: '🕒 Evening Slot (06:00 PM - 08:00 PM)', tag: 'POPULAR', fee: 10 },
  { id: 'slot-3', type: 'delivery', label: '🌅 Tomorrow Morning (07:00 AM - 09:00 AM)', tag: 'SAVER', fee: 0 },
  { id: 'slot-4', type: 'pickup', label: PICKUP_SLOT, tag: 'NO WAIT', fee: 0 },
  { id: 'slot-5', type: 'pickup', label: '📦 Evening Pickup (07:00 PM - 09:00 PM)', tag: 'FLEXIBLE', fee: 0 }
];

export function CartProvider({ children }) {
  const initial = loadCartState();
  const [cart, setCart] = useState(initial.cart);
  const [fulfillmentMode, setFulfillmentMode] = useState(initial.fulfillmentMode || 'delivery');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(
    initial.selectedTimeSlot || EXPRESS_SLOT
  );
  const [selectedStore, setSelectedStore] = useState(initial.selectedStore);

  useEffect(() => {
    persistCartState({ cart, selectedStore, fulfillmentMode, selectedTimeSlot });
  }, [cart, selectedStore, fulfillmentMode, selectedTimeSlot]);

  const clearCart = () => {
    setCart([]);
    setSelectedStore(null);
  };

  const addToCart = (product, store, customPrice = null) => {
    if (!product || !store) return false;

    const storeId = store._id || store.storeId || store.id;
    const storeName = store.name || store.storeName;
    const productId = product._id || product.id;
    const price =
      customPrice !== null && customPrice !== undefined
        ? customPrice
        : product.lowestPrice ?? store.itemPrice ?? product.mrp;

    if (cart.length > 0 && cart[0].storeId !== storeId) {
      const confirmed = window.confirm(
        `Your cart already contains items from "${cart[0].storeName}". Would you like to clear cart and add items from "${storeName}"?`
      );
      if (!confirmed) return false;
      setCart([]);
    }

    setSelectedStore({
      _id: storeId,
      name: storeName,
      baseDeliveryFee: store.baseDeliveryFee ?? store.deliveryFee ?? 20,
      freeDeliveryAbove: store.freeDeliveryAbove ?? 300,
      estDeliveryMins: store.estDeliveryMins ?? 20,
      address: store.address,
      phone: store.phone,
      lat: store.lat,
      lng: store.lng
    });

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === productId && item.storeId === storeId
      );

      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1
        };
        return next;
      }

      return [
        ...prev,
        {
          productId,
          name: product.name,
          photoUrl: product.photoUrl,
          unit: product.unit,
          price,
          mrp: product.mrp,
          quantity: 1,
          storeId,
          storeName,
          deliveryFee: store.baseDeliveryFee ?? store.deliveryFee ?? 20
        }
      ];
    });

    return true;
  };

  const updateCartQty = (productId, delta) => {
    setCart((prev) => {
      const next = prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0);

      if (next.length === 0) {
        setSelectedStore(null);
      }
      return next;
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const next = prev.filter((item) => item.productId !== productId);
      if (next.length === 0) setSelectedStore(null);
      return next;
    });
  };

  const setOrderType = (mode) => {
    const nextMode = mode === 'pickup' ? 'pickup' : 'delivery';
    setFulfillmentMode(nextMode);
    setSelectedTimeSlot(nextMode === 'pickup' ? PICKUP_SLOT : EXPRESS_SLOT);
  };

  const totals = useMemo(() => {
    const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const itemsTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const mrpTotal = cart.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
    const savings = Math.max(0, mrpTotal - itemsTotal);

    let deliveryFee = 0;
    if (fulfillmentMode === 'pickup') {
      deliveryFee = 0;
    } else {
      const storeDeliveryFee =
        selectedStore?.baseDeliveryFee ??
        cart[0]?.deliveryFee ??
        20;

      const slotObj = TIME_SLOTS.find(
        (s) => s.label === selectedTimeSlot || s.id === selectedTimeSlot
      );

      if (slotObj && slotObj.fee !== undefined) {
        deliveryFee = slotObj.fee;
      } else if (
        selectedTimeSlot &&
        (selectedTimeSlot.includes('Tomorrow') || selectedTimeSlot.includes('Saver'))
      ) {
        deliveryFee = 0;
      } else if (selectedTimeSlot && selectedTimeSlot.includes('Evening')) {
        deliveryFee = 10;
      } else {
        deliveryFee = storeDeliveryFee;
      }

      if (
        selectedStore &&
        selectedStore.freeDeliveryAbove > 0 &&
        itemsTotal >= selectedStore.freeDeliveryAbove
      ) {
        if (!selectedTimeSlot || !selectedTimeSlot.includes('Express')) {
          deliveryFee = 0;
        }
      }
    }

    return {
      itemsCount,
      itemsTotal,
      mrpTotal,
      savings,
      deliveryFee,
      grandTotal: itemsTotal + deliveryFee
    };
  }, [cart, fulfillmentMode, selectedTimeSlot, selectedStore]);

  const buildCheckoutPayload = (customer = {}) => ({
    storeId: selectedStore?._id || cart[0]?.storeId,
    items: cart.map((item) => ({
      productId: item.productId,
      productName: item.name,
      name: item.name,
      unitSpec: item.unit,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.price,
      price: item.price
    })),
    orderType: fulfillmentMode,
    timeSlot: selectedTimeSlot,
    deliveryFee: totals.deliveryFee,
    customerName: customer.name,
    customerPhone: customer.phone,
    deliveryAddress:
      fulfillmentMode === 'pickup'
        ? selectedStore?.address || 'Store Pickup'
        : customer.address,
    pincode: customer.pincode || '201301',
    paymentMode: customer.paymentMode || 'COD',
    customerId: customer.customerId,
    couponCode: customer.couponCode || '',
    discountAmount: customer.discountAmount || 0,
    walletUsed: customer.walletUsed || 0,
    paymentTxnId: customer.paymentTxnId || ''
  });

  const value = {
    cart,
    selectedStore,
    fulfillmentMode,
    orderType: fulfillmentMode,
    selectedTimeSlot,
    timeSlots: TIME_SLOTS,
    totals,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    setFulfillmentMode: setOrderType,
    setOrderType,
    setSelectedTimeSlot,
    buildCheckoutPayload,
    apiBase: API_BASE,
    fetchLiveCatalog
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}

export default CartContext;
