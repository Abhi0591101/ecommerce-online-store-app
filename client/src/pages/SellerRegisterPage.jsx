import { useEffect, useState } from 'react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import RazorpayFeePay from '../components/RazorpayFeePay';
import { getPublicSettings, registerSeller, sendSellerOtp } from '../services/api';

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const Field = ({ label, required, children }) => (
  <div>
    <label className="font-bold text-slate-700 block mb-1">
      {label}
      {required ? ' *' : ''}
    </label>
    {children}
  </div>
);

/**
 * Seller registration per Japto Seller Panel requirements:
 * OTP, PAN+doc, GST XOR Enrollment + doc, bank+proof, promoters, optional FSSAI,
 * registration fee amount from Admin config.
 */
export default function SellerRegisterPage({ onSuccess, onBackToLogin }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState('');
  const [taxMode, setTaxMode] = useState('gst'); // gst | enrollment
  const [dealsInFood, setDealsInFood] = useState(false);
  const [feePayment, setFeePayment] = useState(null);
  const [registrationFee, setRegistrationFee] = useState(216);
  const [ownerNameDraft, setOwnerNameDraft] = useState('');
  const [docs, setDocs] = useState({
    panDocUrl: '',
    gstDocUrl: '',
    enrollmentDocUrl: '',
    bankProofUrl: '',
    fssaiDocUrl: '',
    photoUrl: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicSettings()
      .then((res) => {
        const fee = Number(res?.data?.sellerRegistrationFee);
        if (!cancelled && Number.isFinite(fee) && fee >= 0) setRegistrationFee(fee);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onFile = async (key, file) => {
    if (!file) return;
    const url = await fileToDataUrl(file);
    setDocs((d) => ({ ...d, [key]: url }));
  };

  const sendOtp = async () => {
    setError('');
    if (!phone.trim()) {
      setError('Enter mobile number');
      return;
    }
    try {
      const res = await sendSellerOtp({ phone: phone.trim() });
      setOtpSent(true);
      const code = res.demoOtp || res.otp;
      if (code) {
        setOtp(String(code));
        setOtpHint(res.message || `OTP sent. Use ${code}`);
      } else {
        setOtp('');
        setOtpHint(res.message || 'OTP sent to your mobile number');
      }
    } catch (err) {
      setError(err.message || 'OTP failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.target);

    if (!otpSent || !otp.trim()) {
      setError('Verify mobile with OTP first');
      return;
    }
    if (!docs.panDocUrl) {
      setError('Upload PAN document');
      return;
    }
    if (taxMode === 'gst' && (!fd.get('gstNumber') || !docs.gstDocUrl)) {
      setError('GST number and document required (or switch to Enrollment)');
      return;
    }
    if (taxMode === 'enrollment' && (!fd.get('enrollmentNumber') || !docs.enrollmentDocUrl)) {
      setError('Enrollment number and document required');
      return;
    }
    if (!docs.bankProofUrl) {
      setError('Upload bank proof');
      return;
    }
    if (dealsInFood && (!fd.get('fssai') || !docs.fssaiDocUrl)) {
      setError('FSSAI number and document required for food sellers');
      return;
    }
    if (registrationFee > 0 && !feePayment?.paymentTxnId) {
      setError(`Pay registration fee ₹${registrationFee} via Razorpay before submitting`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: fd.get('ownerName'),
        ownerName: fd.get('ownerName'),
        phone: phone.trim(),
        password: fd.get('password'),
        email: fd.get('email') || undefined,
        otp: otp.trim(),
        storeName: fd.get('storeName'),
        address: fd.get('address'),
        pincode: fd.get('pincode'),
        city: fd.get('city') || 'Noida',
        lat: Number(fd.get('lat')) || 28.628,
        lng: Number(fd.get('lng')) || 77.3649,
        photoUrl:
          docs.photoUrl ||
          'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=500&auto=format&fit=crop&q=80',
        panNumber: fd.get('panNumber'),
        panDocUrl: docs.panDocUrl,
        gstNumber: taxMode === 'gst' ? fd.get('gstNumber') : '',
        gstDocUrl: taxMode === 'gst' ? docs.gstDocUrl : '',
        enrollmentNumber: taxMode === 'enrollment' ? fd.get('enrollmentNumber') : '',
        enrollmentDocUrl: taxMode === 'enrollment' ? docs.enrollmentDocUrl : '',
        bankAccount: fd.get('bankAccount'),
        ifsc: fd.get('ifsc'),
        bankProofUrl: docs.bankProofUrl,
        dealsInFood,
        fssai: dealsInFood ? fd.get('fssai') : '',
        fssaiDocUrl: dealsInFood ? docs.fssaiDocUrl : '',
        promoter1Name: fd.get('promoter1Name') || '',
        promoter1Phone: fd.get('promoter1Phone') || '',
        promoter2Name: fd.get('promoter2Name') || '',
        promoter2Phone: fd.get('promoter2Phone') || '',
        registrationFeePaid: true,
        registrationFeeTxnId: feePayment?.paymentTxnId || '',
        registrationFeeRazorpayOrderId: feePayment?.razorpayOrderId || '',
        razorpayPaymentId: feePayment?.razorpayPaymentId || '',
        category: 'grocery'
      };
      const res = await registerSeller(payload);
      onSuccess?.(res);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border rounded-xl px-3 py-2';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-black text-xl text-slate-900">Seller Registration</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              OTP · KYC docs · ₹{registrationFee} fee · Admin approval
            </p>
          </div>
          <button type="button" onClick={onBackToLogin} className="text-xs font-bold text-indigo-600">
            Back to login
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <section className="space-y-2 border-b border-slate-100 pb-4">
            <h2 className="font-black text-sm text-slate-800">1. Mobile OTP verification</h2>
            <Field label="Mobile number" required>
              <div className="flex gap-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`flex-grow ${inputClass}`}
                />
                <button type="button" onClick={sendOtp} className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold whitespace-nowrap">
                  Send OTP
                </button>
              </div>
            </Field>
            {otpSent && (
              <Field label="OTP code" required>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className={inputClass}
                />
                <p className="text-[10px] text-emerald-700 font-bold mt-1">{otpHint}</p>
              </Field>
            )}
          </section>

          <section className="space-y-2 border-b border-slate-100 pb-4">
            <h2 className="font-black text-sm text-slate-800">2. Account & store</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Owner name" required>
                <input
                  name="ownerName"
                  required
                  className={inputClass}
                  value={ownerNameDraft}
                  onChange={(e) => setOwnerNameDraft(e.target.value)}
                />
              </Field>
              <Field label="Password" required>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className={`${inputClass} pr-14`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
              </Field>
              <Field label="Email">
                <input name="email" type="email" className={inputClass} />
              </Field>
              <Field label="Store name" required>
                <input name="storeName" required className={inputClass} />
              </Field>
            </div>
            <Field label="Store address" required>
              <input name="address" required className={inputClass} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="PIN code" required>
                <input name="pincode" required className={inputClass} />
              </Field>
              <Field label="City">
                <input name="city" defaultValue="Noida" className={inputClass} />
              </Field>
              <Field label="Store photo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFile('photoUrl', e.target.files?.[0])}
                  className="text-[10px] file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:font-bold file:text-indigo-700"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Field label="Promoter 1 name">
                <input name="promoter1Name" className={inputClass} />
              </Field>
              <Field label="Promoter 1 mobile">
                <input name="promoter1Phone" className={inputClass} />
              </Field>
              <Field label="Promoter 2 name">
                <input name="promoter2Name" className={inputClass} />
              </Field>
              <Field label="Promoter 2 mobile">
                <input name="promoter2Phone" className={inputClass} />
              </Field>
            </div>
          </section>

          <section className="space-y-2 border-b border-slate-100 pb-4">
            <h2 className="font-black text-sm text-slate-800">3. PAN (required)</h2>
            <Field label="PAN number" required>
              <input name="panNumber" required className={inputClass} />
            </Field>
            <Field label="PAN document upload" required>
              <input
                type="file"
                accept="image/*,.pdf"
                required={!docs.panDocUrl}
                onChange={(e) => onFile('panDocUrl', e.target.files?.[0])}
                className="text-[10px] file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:font-bold file:text-indigo-700"
              />
              {docs.panDocUrl && <p className="text-[10px] text-emerald-600 font-bold mt-1">PAN document attached</p>}
            </Field>
          </section>

          <section className="space-y-2 border-b border-slate-100 pb-4">
            <h2 className="font-black text-sm text-slate-800">4. GST or Enrollment (one required)</h2>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
              {[
                ['gst', 'GST Number'],
                ['enrollment', 'Enrollment Number']
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTaxMode(id)}
                  className={`px-3 py-1.5 rounded-xl font-bold ${
                    taxMode === id ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {taxMode === 'gst' ? (
              <>
                <Field label="GSTIN" required>
                  <input name="gstNumber" className={inputClass} />
                </Field>
                <Field label="GST document upload" required>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => onFile('gstDocUrl', e.target.files?.[0])}
                    className="text-[10px] file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:font-bold file:text-indigo-700"
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Enrollment number" required>
                  <input name="enrollmentNumber" className={inputClass} />
                </Field>
                <Field label="Enrollment document upload" required>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => onFile('enrollmentDocUrl', e.target.files?.[0])}
                    className="text-[10px] file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:font-bold file:text-indigo-700"
                  />
                </Field>
              </>
            )}
          </section>

          <section className="space-y-2 border-b border-slate-100 pb-4">
            <h2 className="font-black text-sm text-slate-800">5. Bank details</h2>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Account number" required>
                <input name="bankAccount" required className={inputClass} />
              </Field>
              <Field label="IFSC" required>
                <input name="ifsc" required className={inputClass} />
              </Field>
            </div>
            <Field label="Bank proof upload" required>
              <input
                type="file"
                accept="image/*,.pdf"
                required={!docs.bankProofUrl}
                onChange={(e) => onFile('bankProofUrl', e.target.files?.[0])}
                className="text-[10px] file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:font-bold file:text-indigo-700"
              />
            </Field>
            <p className="text-[10px] text-slate-400">Exact bank-proof formats pending Company policy.</p>
          </section>

          <section className="space-y-2 border-b border-slate-100 pb-4">
            <label className="flex items-center gap-2 font-bold text-slate-700">
              <input type="checkbox" checked={dealsInFood} onChange={(e) => setDealsInFood(e.target.checked)} />
              I sell food products (FSSAI required)
            </label>
            {dealsInFood && (
              <>
                <Field label="FSSAI licence number" required>
                  <input name="fssai" className={inputClass} />
                </Field>
                <Field label="FSSAI document upload" required>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => onFile('fssaiDocUrl', e.target.files?.[0])}
                    className="text-[10px] file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:font-bold file:text-indigo-700"
                  />
                </Field>
              </>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-black text-sm text-slate-800">6. Registration fee (Razorpay)</h2>
            <p className="text-slate-500">
              Pay ₹{registrationFee} online via Razorpay (UPI / Card / Netbanking). Then submit the
              form for Admin document verification.
            </p>
            <RazorpayFeePay
              purpose="seller_registration"
              amount={registrationFee}
              label={`Pay ₹${registrationFee} registration fee`}
              customer={{ name: ownerNameDraft, phone }}
              paidMeta={feePayment}
              onPaid={(meta) => {
                setFeePayment(meta);
                setError('');
              }}
              onError={(msg) => setError(msg)}
            />
          </section>

          <button
            type="submit"
            disabled={submitting || (registrationFee > 0 && !feePayment?.paymentTxnId)}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl font-black text-sm"
          >
            {submitting ? 'Submitting…' : 'Submit for Admin verification'}
          </button>
        </form>
      </div>
    </div>
  );
}
