/** Visible field label — use instead of relying on input placeholders as the only name. */
export default function FormField({ label, children, className = '', hint = '' }) {
  return (
    <label className={`block space-y-1 min-w-0 ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[10px] font-semibold text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}
