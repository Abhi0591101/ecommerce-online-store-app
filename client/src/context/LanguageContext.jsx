import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DICT = {
  en: {
    account: 'My Account',
    loginPrompt: 'Please log in to manage your Japto customer account.',
    close: 'Close',
    save: 'Save',
    loading: 'Loading…',
    error: 'Something went wrong',
    saved: 'Saved',
    tab_profile: 'Profile',
    tab_addresses: 'Addresses',
    tab_wishlist: 'Wishlist',
    tab_orders: 'Orders',
    tab_payments: 'Payments',
    tab_coupons: 'Coupons',
    tab_wallet: 'Wallet',
    tab_referral: 'Referral',
    tab_notifications: 'Notifications',
    tab_support: 'Support',
    tab_reviews: 'Reviews',
    tab_settings: 'Settings',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    city: 'City',
    password: 'Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    changePassword: 'Change password',
    addAddress: 'Add address',
    pincode: 'Pincode',
    default: 'Default',
    remove: 'Remove',
    cancelOrder: 'Request cancellation',
    reason: 'Reason',
    shareWhatsApp: 'Share on WhatsApp',
    referralCode: 'Referral code',
    language: 'Language',
    english: 'English',
    hindi: 'हिंदी',
    privacyPolicy: 'Privacy policy',
    termsOfUse: 'Terms of use',
    deleteAccount: 'Request account deletion',
    logoutNote: 'To sign out, use Logout in the site header.',
    markAllRead: 'Mark all read',
    newComplaint: 'New complaint',
    subject: 'Subject',
    message: 'Message',
    submit: 'Submit',
    noData: 'Nothing here yet',
    serviceable: 'Delivery available',
    notServiceable: 'Not serviceable',
    openOrders: 'Open full orders',
    balance: 'Balance',
    referred: 'Friends joined'
  },
  hi: {
    account: 'मेरा खाता',
    loginPrompt: 'खाता देखने के लिए लॉगिन करें।',
    close: 'बंद करें',
    save: 'सहेजें',
    loading: 'लोड हो रहा है…',
    error: 'कुछ गलत हो गया',
    saved: 'सहेजा गया',
    tab_profile: 'प्रोफ़ाइल',
    tab_addresses: 'पते',
    tab_wishlist: 'पसंदीदा',
    tab_orders: 'ऑर्डर',
    tab_payments: 'भुगतान',
    tab_coupons: 'कूपन',
    tab_wallet: 'वॉलेट',
    tab_referral: 'रेफ़रल',
    tab_notifications: 'सूचनाएँ',
    tab_support: 'सहायता',
    tab_reviews: 'समीक्षा',
    tab_settings: 'सेटिंग',
    name: 'नाम',
    phone: 'फ़ोन',
    email: 'ईमेल',
    city: 'शहर',
    password: 'पासवर्ड',
    currentPassword: 'वर्तमान पासवर्ड',
    newPassword: 'नया पासवर्ड',
    changePassword: 'पासवर्ड बदलें',
    addAddress: 'पता जोड़ें',
    pincode: 'पिनकोड',
    default: 'डिफ़ॉल्ट',
    remove: 'हटाएँ',
    cancelOrder: 'रद्दीकरण अनुरोध',
    reason: 'कारण',
    shareWhatsApp: 'WhatsApp पर साझा करें',
    referralCode: 'रेफ़रल कोड',
    language: 'भाषा',
    english: 'English',
    hindi: 'हिंदी',
    privacyPolicy: 'गोपनीयता नीति',
    termsOfUse: 'उपयोग की शर्तें',
    deleteAccount: 'खाता हटाने का अनुरोध',
    logoutNote: 'लॉगआउट के लिए ऊपर हेडर में Logout दबाएँ।',
    markAllRead: 'सभी पढ़ा',
    newComplaint: 'नई शिकायत',
    subject: 'विषय',
    message: 'संदेश',
    submit: 'जमा करें',
    noData: 'अभी कुछ नहीं',
    serviceable: 'डिलीवरी उपलब्ध',
    notServiceable: 'सेवा उपलब्ध नहीं',
    openOrders: 'सभी ऑर्डर खोलें',
    balance: 'शेष',
    referred: 'मित्र जुड़े'
  }
};

export function t(key, lang = 'en') {
  const bucket = DICT[lang] || DICT.en;
  return bucket[key] ?? DICT.en[key] ?? key;
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children, initial = 'en' }) {
  const [language, setLanguage] = useState(initial);

  const translate = useCallback((key) => t(key, language), [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t: translate }),
    [language, setLanguage, translate]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key) => t(key, 'en')
    };
  }
  return ctx;
}

export default LanguageContext;