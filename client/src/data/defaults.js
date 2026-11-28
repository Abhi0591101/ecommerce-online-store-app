/**
 * Empty delivery location — never a hardcoded city/PIN.
 * Catalog loads only after GPS (or user-confirmed PIN) sets a real location.
 */
export const EMPTY_LOCATION = {
  pincode: '',
  area: '',
  city: '',
  state: '',
  lat: null,
  lng: null,
  radiusKm: 5
};

/** @deprecated use EMPTY_LOCATION — kept so older imports don't break */
export const FALLBACK_LOCATION = EMPTY_LOCATION;
