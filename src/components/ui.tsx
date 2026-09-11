export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-4 ${className}`}>
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
export function Btn({ children, variant = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const cls = {
    primary: "bg-orange-600 text-white hover:bg-orange-700",
    ghost: "border border-stone-300 bg-white hover:bg-stone-50",
    danger: "border border-red-300 text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button {...rest} className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${cls} ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}
export const inputCls = "rounded-md border border-stone-300 bg-white px-2 py-1 text-sm";
