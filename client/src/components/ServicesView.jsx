import { useMemo, useState } from 'react';

const SERVICE_CATEGORY_CHIPS = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'plumbing', label: 'Plumbing', emoji: '🔧' },
  { id: 'electrical', label: 'Electrical', emoji: '💡' },
  { id: 'ac', label: 'AC Repair', emoji: '❄️' },
  { id: 'cleaning', label: 'Deep Cleaning', emoji: '🧹' },
  { id: 'appliance', label: 'Appliance Repair', emoji: '🔌' },
  { id: 'carpentry', label: 'Carpentry', emoji: '🪚' },
  { id: 'beauty', label: 'Beauty', emoji: '💅' }
];

const SLOT_OPTIONS = [
  { id: 'express', label: '⚡ Express 45-min', tag: 'FASTEST', feeNote: 'Same visit charge' },
  { id: 'today_eve', label: '🕒 Today Evening (6–8 PM)', tag: 'POPULAR', feeNote: 'Scheduled' },
  { id: 'tomorrow_am', label: '🌅 Tomorrow Morning (9–11 AM)', tag: 'FLEXIBLE', feeNote: 'Scheduled' }
];

function BookingModal({ service, location, onClose, onConfirmed }) {
  const [slot, setSlot] = useState('express');
  const [address, setAddress] = useState(
    `Flat 402, Tower B, ${location?.area || location?.city || 'your area'}`
  );
  const [phone, setPhone] = useState('9876543210');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 450));
    const ref = `SRV-${Math.random().toString(16).slice(2, 6).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    onConfirmed({
      bookingRef: ref,
      service,
      slot: SLOT_OPTIONS.find((s) => s.id === slot),
      address,
      phone,
      date,
      visitCharge: service.visitCharge
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Book Instant Service</p>
            <h3 className="font-black text-slate-900 text-base">{service.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex items-center gap-3">
            <img src={service.photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover border" />
            <div>
              <p className="font-bold text-slate-900">{service.provider?.name || 'Verified Technician'}</p>
              <p className="text-slate-500">
                ★ {service.rating} • {service.provider?.experienceYears || 5}+ Years • Visit ₹{service.visitCharge}
              </p>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Preferred Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-2">Time Slot</label>
            <div className="space-y-2">
              {SLOT_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                    slot === opt.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="serviceSlot"
                      checked={slot === opt.id}
                      onChange={() => setSlot(opt.id)}
                    />
                    <span className="font-bold text-slate-900">{opt.label}</span>
                  </div>
                  <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-full">
                    {opt.tag}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Service Address *</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Contact Phone *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={submitting || !address.trim()}
            onClick={confirm}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-600/30"
          >
            {submitting ? 'Confirming…' : `Confirm Booking • ₹${service.visitCharge}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesView({ services = [], location }) {
  const [chip, setChip] = useState('all');
  const [bookingService, setBookingService] = useState(null);
  const [confirmed, setConfirmed] = useState(null);

  const filtered = useMemo(() => {
    if (chip === 'all') return services;
    return services.filter((s) => (s.category || '').toLowerCase() === chip);
  }, [services, chip]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-800/50 shadow-md">
        <div>
          <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
            🛠️ Verified Local Pros
          </span>
          <h3 className="text-lg md:text-xl font-black mt-1.5">
            Doorstep Home Services & Repairs in 45 Minutes
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Plumbing, Electrical, AC, Cleaning & Appliance experts near {location?.area || 'you'}.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="bg-white/10 backdrop-blur px-3 py-2 rounded-xl text-center border border-white/10">
            <span className="text-xs font-bold text-amber-300 block">⚡ Instant Slot</span>
            <span className="text-sm font-black">Within 45m</span>
          </div>
          <div className="bg-white/10 backdrop-blur px-3 py-2 rounded-xl text-center border border-white/10">
            <span className="text-xs font-bold text-emerald-300 block">🛡️ Guarantee</span>
            <span className="text-sm font-black">100% Safe</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SERVICE_CATEGORY_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChip(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              chip === c.id
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500 bg-white rounded-3xl p-8 border border-slate-100">
          <p className="font-bold text-slate-800 text-lg">No services in this category yet</p>
          <p className="text-sm text-slate-400 mt-1">Try another category or add services from Seller Panel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div
              key={s._id}
              className="product-card overflow-hidden flex flex-col justify-between bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:border-indigo-300 transition"
            >
              <div>
                <img src={s.photoUrl} alt={s.name} className="w-full h-44 object-cover" />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {s.category}
                    </span>
                    <span className="badge-rating font-black text-xs">
                      ★ {s.rating}{' '}
                      <span className="text-slate-400 font-normal">({s.reviews || 25})</span>
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base mt-2">{s.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>

                  <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2.5">
                    {s.provider?.photoUrl ? (
                      <img
                        src={s.provider.photoUrl}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                        {(s.provider?.name || 'T').charAt(0)}
                      </div>
                    )}
                    <div className="text-xs min-w-0">
                      <p className="font-bold text-slate-800 truncate">
                        {s.provider?.name || 'Verified Technician'}
                      </p>
                      <p className="text-slate-400 text-[10px]">
                        {s.provider?.experienceYears || 5}+ Years • {s.provider?.badge || 'Verified Pro'}
                      </p>
                    </div>
                    <span className="ml-auto text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg whitespace-nowrap">
                      Doorstep 45m
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Inspection / Visit Fee
                  </span>
                  <span className="font-black text-lg text-slate-950">₹{s.visitCharge}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingService(s)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition"
                >
                  Book Instant Service
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {bookingService && (
        <BookingModal
          service={bookingService}
          location={location}
          onClose={() => setBookingService(null)}
          onConfirmed={(booking) => {
            setBookingService(null);
            setConfirmed(booking);
          }}
        />
      )}

      {confirmed && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-3 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto font-black">
              ✓
            </div>
            <h3 className="font-black text-slate-900 text-lg">Service Booked!</h3>
            <p className="text-xs text-slate-500">
              {confirmed.service.name} with {confirmed.service.provider?.name || 'technician'}
            </p>
            <p className="font-mono font-black text-indigo-600 text-sm bg-indigo-50 rounded-xl py-2">
              Ref: {confirmed.bookingRef}
            </p>
            <p className="text-[11px] text-slate-500">
              {confirmed.slot?.label} • ₹{confirmed.visitCharge} visit fee
            </p>
            <button
              type="button"
              onClick={() => setConfirmed(null)}
              className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
