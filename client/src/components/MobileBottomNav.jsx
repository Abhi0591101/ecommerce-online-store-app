export default function MobileBottomNav({
  active = 'home',
  cartCount = 0,
  onHome,
  onGrocery,
  onOrders,
  onServices,
  onCart
}) {
  const itemClass = (key) =>
    `flex flex-col items-center gap-0.5 transition ${
      active === key ? 'text-indigo-600' : 'hover:text-indigo-600'
    }`;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 z-40 px-3 py-2 flex items-center justify-around text-[10px] font-bold text-slate-500">
      <button type="button" onClick={onHome} className={itemClass('home')}>
        <span className="text-lg">🏠</span>
        <span>Home</span>
      </button>
      <button type="button" onClick={onGrocery} className={itemClass('grocery')}>
        <span className="text-lg">🛒</span>
        <span>Grocery</span>
      </button>
      <button type="button" onClick={onOrders} className={itemClass('orders')}>
        <span className="text-lg">📦</span>
        <span>Orders</span>
      </button>
      <button type="button" onClick={onServices} className={itemClass('services')}>
        <span className="text-lg">🛠️</span>
        <span>Services</span>
      </button>
      <button type="button" onClick={onCart} className={`relative ${itemClass('cart')} text-slate-900`}>
        <span className="text-lg">🛍️</span>
        <span>Cart</span>
        {cartCount > 0 && (
          <span className="absolute -top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </button>
    </nav>
  );
}
