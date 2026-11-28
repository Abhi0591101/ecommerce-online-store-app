import { useEffect, useState } from 'react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import RazorpayFeePay from '../components/RazorpayFeePay';
import { getFranchisePublicInfo, submitFranchiseApplication } from '../services/api';

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function FranchisePage({ onBack, onOpenLogin }) {
  const [info, setInfo] = useState(null);
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feePayment, setFeePayment] = useState(null);
  const [applicant, setApplicant] = useState({ ownerName: '', phone: '', email: '' });

  useEffect(() => {
    getFranchisePublicInfo()
      .then((r) => setInfo(r?.data || r))
      .catch(() =>
        setInfo({
          franchiseRegistrationFee: 500,
          franchiseFeeMin: 200000,
          franchiseFeeMax: 500000,
          franchiseFeeNote: '₹2,00,000 से ₹5,00,000 तक, शहर के अनुसार।',
          gstNote: 'GST फ्रेंचाइज़ी फीस से अलग लगेगा।',
          refundPolicy: 'फ्रेंचाइज़ी फीस Non-Refundable होगी।',
          agreementPeriod: '5 वर्ष',
          deliveryCommissionNote: 'Eligible delivery charge पर Head Office % के अनुसार साप्ताहिक कमीशन।',
          workingAreaNote: 'केवल Admin-approved PIN Codes में कार्य।',
          noSecurityDeposit: true
        })
      );
  }, []);

  const regFee = Number(info?.franchiseRegistrationFee ?? 500);

  const onSubmit = async (e) => {
    e.preventDefault();
    setFlash('');
    const fd = new FormData(e.target);
    const pw = String(fd.get('password') || password || '');
    if (pw.length < 6) {
      setFlash('Password required (min 6 characters)');
      return;
    }
    if (regFee > 0 && !feePayment?.paymentTxnId) {
      setFlash(`Pay registration fee ₹${regFee} via Razorpay before submitting`);
      return;
    }
    setBusy(true);
    try {
      const res = await submitFranchiseApplication({
        ownerName: fd.get('ownerName'),
        phone: fd.get('phone'),
        email: fd.get('email'),
        password: pw,
        city: fd.get('city'),
        pincode: fd.get('pincode'),
        state: fd.get('state'),
        houseNo: fd.get('houseNo'),
        streetArea: fd.get('streetArea'),
        businessExperience: fd.get('businessExperience'),
        message: fd.get('message'),
        promoter1Name: fd.get('promoter1Name'),
        promoter1Phone: fd.get('promoter1Phone'),
        promoter2Name: fd.get('promoter2Name'),
        promoter2Phone: fd.get('promoter2Phone'),
        name: fd.get('ownerName'),
        registrationFeeTxnId: feePayment?.paymentTxnId || '',
        registrationFeeRazorpayOrderId: feePayment?.razorpayOrderId || '',
        razorpayPaymentId: feePayment?.razorpayPaymentId || '',
        razorpayOrderId: feePayment?.razorpayOrderId || ''
      });
      const id = res?.data?.applicationId || res?.applicationId;
      setApplicationId(id || '');
      setFlash(res?.message || 'Application submitted — after approval, login with OTP or this password');
      e.target.reset();
      setPassword('');
      setFeePayment(null);
      setApplicant({ ownerName: '', phone: '', email: '' });
    } catch (err) {
      setFlash(err.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {busy ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center px-4">
          <div className="rounded-2xl bg-white shadow-xl border border-slate-200 px-6 py-5 max-w-sm w-full text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
            <p className="text-sm font-black text-slate-900">Submitting application…</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Confirmation email queue हो रहा है — कृपया प्रतीक्षा करें
            </p>
          </div>
        </div>
      ) : null}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap gap-2 justify-between items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Japto.in</p>
          <h1 className="text-lg font-black text-slate-900">Franchise</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white"
          >
            Storefront
          </button>
          <button
            type="button"
            onClick={onOpenLogin}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white"
          >
            Franchise login
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {flash ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
            {flash}
            {applicationId ? (
              <p className="mt-1 font-mono text-xs">Application ID: {applicationId}</p>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-black text-slate-900">Franchise details</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm font-semibold text-slate-700">
            <p>
              <span className="text-slate-500 text-xs font-black uppercase block">
                Registration fee
              </span>
              {money(info?.franchiseRegistrationFee ?? 500)}
            </p>
            <p>
              <span className="text-slate-500 text-xs font-black uppercase block">Franchise fee</span>
              {money(info?.franchiseFeeMin)} – {money(info?.franchiseFeeMax)}
              <span className="block text-xs text-slate-500 mt-1">{info?.franchiseFeeNote}</span>
            </p>
            <p>
              <span className="text-slate-500 text-xs font-black uppercase block">GST</span>
              {info?.gstNote}
            </p>
            <p>
              <span className="text-slate-500 text-xs font-black uppercase block">Refund policy</span>
              {info?.refundPolicy}
            </p>
            <p>
              <span className="text-slate-500 text-xs font-black uppercase block">Agreement</span>
              {info?.agreementPeriod}
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-500 text-xs font-black uppercase block">Delivery commission</span>
              {info?.deliveryCommissionNote}
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-500 text-xs font-black uppercase block">Working area</span>
              {info?.workingAreaNote}
            </p>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Security Deposit नहीं है। किस्त/भुगतान तरीके वेबसाइट पर नहीं दिखाए जाते।
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-black text-slate-900 mb-4">Franchise application form</h2>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Applicant name *</span>
              <input
                name="ownerName"
                className={inputCls}
                required
                value={applicant.ownerName}
                onChange={(e) => setApplicant((p) => ({ ...p, ownerName: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Mobile *</span>
              <input
                name="phone"
                className={inputCls}
                required
                value={applicant.phone}
                onChange={(e) => setApplicant((p) => ({ ...p, phone: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Email * (confirmation यहीं जाएगा)</span>
              <input
                name="email"
                type="email"
                className={inputCls}
                required
                value={applicant.email}
                onChange={(e) => setApplicant((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-black text-slate-500">
                Create password * (approval के बाद OTP या password से login)
              </span>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputCls} pr-14`}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-700 px-2"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <PasswordStrengthMeter password={password} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">City *</span>
              <input name="city" className={inputCls} required />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">PIN code *</span>
              <input name="pincode" className={inputCls} required />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Business experience *</span>
              <select name="businessExperience" className={inputCls} defaultValue="new" required>
                <option value="experienced">अनुभव है</option>
                <option value="new">नया व्यवसाय</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">House / building</span>
              <input name="houseNo" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Street / area</span>
              <input name="streetArea" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">State</span>
              <input name="state" className={inputCls} defaultValue="UP" />
            </label>
            <label className="sm:col-span-2 block">
              <span className="text-[10px] font-black text-slate-500">Message</span>
              <textarea name="message" className={inputCls} rows={2} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Promoter 1 name</span>
              <input name="promoter1Name" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Promoter 1 mobile</span>
              <input name="promoter1Phone" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Promoter 2 name</span>
              <input name="promoter2Name" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500">Promoter 2 mobile</span>
              <input name="promoter2Phone" className={inputCls} />
            </label>
            <div className="sm:col-span-2 space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="text-xs font-black text-indigo-950">
                Registration fee ₹{regFee} — pay via Razorpay
              </p>
              <RazorpayFeePay
                purpose="franchise_registration"
                amount={regFee}
                label={`Pay ₹${regFee} franchise registration fee`}
                customer={{
                  name: applicant.ownerName,
                  phone: applicant.phone,
                  email: applicant.email
                }}
                paidMeta={feePayment}
                onPaid={(meta) => {
                  setFeePayment(meta);
                  setFlash('');
                }}
                onError={(msg) => setFlash(msg)}
              />
            </div>
            <button
              type="submit"
              disabled={busy || (regFee > 0 && !feePayment?.paymentTxnId)}
              className="sm:col-span-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-3 inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Queuing confirmation emails…
                </>
              ) : (
                'Submit application'
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
