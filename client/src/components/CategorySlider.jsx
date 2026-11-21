import { useEffect, useRef, useState } from 'react';

export default function CategorySlider({ categories = [], activeCategory, onSelectCategory }) {
  const scrollerRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    checkArrows();
    const el = scrollerRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', checkArrows);
    window.addEventListener('resize', checkArrows);
    return () => {
      el.removeEventListener('scroll', checkArrows);
      window.removeEventListener('resize', checkArrows);
    };
  }, [categories]);

  const slide = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  const defaultImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=160&auto=format&fit=crop&q=80';

  return (
    <div className="relative group bg-white rounded-2xl p-2.5 md:p-3.5 border border-slate-200/80 shadow-sm mb-4">
      <button
        type="button"
        onClick={() => slide(-1)}
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 backdrop-blur shadow-lg border border-slate-200 text-slate-700 hover:text-indigo-600 hover:scale-110 active:scale-95 items-center justify-center transition-all cursor-pointer ${
          showLeft ? 'flex' : 'hidden'
        }`}
        title="Slide Left"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div
        ref={scrollerRef}
        className="flex items-center gap-4 md:gap-7 overflow-x-auto scroll-smooth no-scrollbar select-none px-2"
      >
        {categories.map((cat) => {
          const slug = cat.slug;
          const active = activeCategory === slug;
          return (
            <button
              key={cat._id || slug}
              type="button"
              onClick={() => onSelectCategory(slug)}
              className={`category-story-bubble flex flex-col items-center gap-1.5 focus:outline-none flex-shrink-0 cursor-pointer ${
                active ? 'active' : ''
              }`}
            >
              <div
                className={`bubble-avatar w-14 h-14 md:w-16 md:h-16 rounded-full p-0.5 border-2 ${
                  active ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200'
                } bg-white overflow-hidden shadow-xs hover:shadow-md transition`}
              >
                <img
                  src={cat.photoUrl || defaultImg}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = defaultImg;
                  }}
                  className="w-full h-full object-cover rounded-full pointer-events-none"
                  alt={cat.name}
                />
              </div>
              <span
                className={`bubble-text text-[11px] md:text-xs font-semibold ${
                  active ? 'text-indigo-600 font-bold' : 'text-slate-700'
                } whitespace-nowrap`}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => slide(1)}
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 backdrop-blur shadow-lg border border-slate-200 text-slate-700 hover:text-indigo-600 hover:scale-110 active:scale-95 items-center justify-center transition-all cursor-pointer ${
          showRight ? 'flex' : 'hidden'
        }`}
        title="Slide Right"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
