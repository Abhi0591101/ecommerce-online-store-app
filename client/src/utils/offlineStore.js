import { EMPTY_LOCATION } from '../data/defaults';

const KEYS = {
  cart: 'hyperlocal_cart_v1',
  selectedStore: 'hyperlocal_selected_store_v1',
  fulfillment: 'hyperlocal_fulfillment_v1',
  timeSlot: 'hyperlocal_timeslot_v1',
  location: 'hyperlocal_location_v1',
  orders: 'hyperlocal_orders_v1'
};

const safeParse = (raw, fallback) => {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export function loadJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  return safeParse(window.localStorage.getItem(key), fallback);
}

export function saveJSON(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function loadCartState() {
  return {
    cart: loadJSON(KEYS.cart, []),
    selectedStore: loadJSON(KEYS.selectedStore, null),
    fulfillmentMode: loadJSON(KEYS.fulfillment, 'delivery'),
    selectedTimeSlot: loadJSON(KEYS.timeSlot, '⚡ Express Delivery (15-25 Mins)')
  };
}

export function persistCartState({ cart, selectedStore, fulfillmentMode, selectedTimeSlot }) {
  saveJSON(KEYS.cart, cart || []);
  saveJSON(KEYS.selectedStore, selectedStore || null);
  saveJSON(KEYS.fulfillment, fulfillmentMode || 'delivery');
  saveJSON(KEYS.timeSlot, selectedTimeSlot || '⚡ Express Delivery (15-25 Mins)');
}

export function loadPersistedOrders() {
  return loadJSON(KEYS.orders, []);
}

export function persistOrders(orders) {
  saveJSON(KEYS.orders, Array.isArray(orders) ? orders.slice(0, 40) : []);
}

export function loadPersistedLocation() {
  return loadJSON(KEYS.location, null);
}

export function persistLocation(location) {
  if (!location || !location.pincode) {
    try {
      window.localStorage.removeItem(KEYS.location);
    } catch {
      /* ignore */
    }
    return;
  }
  saveJSON(KEYS.location, location);
}

export { KEYS, EMPTY_LOCATION, EMPTY_LOCATION as FALLBACK_LOCATION };
