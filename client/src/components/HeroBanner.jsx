import { useEffect, useState } from 'react';
import { getPublicBanners, getPublicSettings } from '../services/api';

export default function HeroBanner({ location }) {
  const [settings, setSettings] = useState(null);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, b] = await Promise.all([
          getPublicSettings().catch(() => null),
          getPublicBanners({ active: '1' }).catch(() => null)
        ]);
        if (!alive) return;
        setSettings(s?.data || null);
        const list = Array.isArray(b?.data) ? b.data : [];
        const city = location?.city || '';
        const match =
          list.find((x) => x.city && city && x.city.toLowerCase() === city.toLowerCase()) ||
          list.find((x) => !x.city) ||
          list[0];
        setBanner(match || null);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      alive = false;
    };
  }, [location?.city]);

  const headline = settings?.homepageHeadline || 'Compare Nearby Stores • 15-Min Delivery • 45-Min Home Services';
  const sub =
    settings?.homepageSubtext ||
    `Comparing real-time prices & 15-min delivery across verified merchant stores in ${
      location?.area || 'your neighborhood'
    }.`;
  const bg = banner?.imageUrl || settings?.bannerUrl;

  return (
    <div
      className="rounded-3xl p-5 md:p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4 mb-6 border border-slate-800 overflow-hidden relative"
      style={
        bg
          ? {
              backgroundImage: `linear-gradient(90deg, rgba(15,23,42,0.92), rgba(15,23,42,0.75)), url(${bg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }
          : undefined
      }
    >
      {!bg ? (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 -z-10" />
      ) : null}
      <div className="relative z-10">
        <span className="bg-emerald-700/80 backdrop-blur text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded tracking-wider">
          {settings?.siteName || 'Japto.in'} · Lowest prices nearby
        </span>
        <h2 className="text-xl md:text-2xl font-black mt-2">{banner?.title || headline}</h2>
        <p className="text-xs md:text-sm text-slate-300 mt-1">{banner?.text || sub}</p>
        {banner?.linkUrl ? (
          <a
            href={banner.linkUrl}
            className="inline-block mt-3 text-xs font-bold text-emerald-300 underline"
            target="_blank"
            rel="noreferrer"
          >
            View offer →
          </a>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0 relative z-10">
        <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-2xl border border-white/20 text-center">
          <span className="text-xs font-bold text-amber-300 block">Express Slot</span>
          <span className="text-sm font-black">15-25 Mins</span>
        </div>
        <div className="bg-white/10 backdrop-blur px-4 py-2.5 rounded-2xl border border-white/20 text-center">
          <span className="text-xs font-bold text-emerald-300 block">Verified Pros</span>
          <span className="text-sm font-black">Doorstep 45m</span>
        </div>
      </div>
    </div>
  );
}
