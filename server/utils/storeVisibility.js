/**
 * Seller KYC + visibility rules (Japto/HyperLocal docs):
 * Unverified / incomplete KYC sellers cannot sell or appear on customer catalog.
 */

function hasCompleteSellerKyc(store) {
  if (!store) return false;
  const panOk = Boolean(String(store.panNumber || '').trim() && store.panDocUrl);
  const bankOk = Boolean(
    String(store.bankAccount || '').trim() &&
      String(store.ifsc || '').trim() &&
      store.bankProofUrl
  );
  const gstOk = Boolean(
    (String(store.gstNumber || '').trim() || String(store.gstin || '').trim()) && store.gstDocUrl
  );
  const enrollOk = Boolean(
    String(store.enrollmentNumber || '').trim() && store.enrollmentDocUrl
  );
  const taxOk = gstOk || enrollOk;
  if (store.dealsInFood) {
    if (!(String(store.fssai || '').trim() && store.fssaiDocUrl)) return false;
  }
  return panOk && bankOk && taxOk;
}

/** Customer-facing catalog / nearby stores */
function isCustomerVisibleStore(store) {
  return Boolean(
    store &&
      store.status === 'approved' &&
      store.isActive !== false &&
      store.isOnline === true &&
      hasCompleteSellerKyc(store)
  );
}

/**
 * Seller may turn Online only when approved, active, and KYC complete.
 * Going Offline is always allowed for the owner.
 */
function canSellerGoOnline(store) {
  if (!store) {
    return { ok: false, message: 'Store not found' };
  }
  if (store.status === 'rejected') {
    return {
      ok: false,
      message: 'Store was rejected by Admin. Visibility cannot be turned on.'
    };
  }
  if (store.status !== 'approved') {
    return {
      ok: false,
      message: 'Store must be approved by Admin before going online'
    };
  }
  if (store.isActive === false) {
    return {
      ok: false,
      message: 'Store is inactive. Contact Admin to reactivate before going online.'
    };
  }
  if (!hasCompleteSellerKyc(store)) {
    return {
      ok: false,
      message: 'Complete KYC documents and wait for Admin approval before going online'
    };
  }
  return { ok: true };
}

module.exports = {
  hasCompleteSellerKyc,
  isCustomerVisibleStore,
  canSellerGoOnline
};
