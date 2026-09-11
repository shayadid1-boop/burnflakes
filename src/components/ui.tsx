export function Card({ title, children, className = "", lift = false }: { title?: string; children: React.ReactNode; className?: string; lift?: boolean }) {
  return (
    <section className={`panel ${lift ? "lift" : ""} ${className}`}>
      {title && <h3 className="mb-3">{title}</h3>}
      {children}
    </section>
  );
}
/** Big number tile, like the demo's KPI row. tone: accent (planned) / good / bad / plain */
export function Kpi({ label, value, sub, tone = "" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "" | "accent" | "good" | "bad" }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
export function Pill({ tone, children }: { tone: "good" | "bad" | "warn" | "plan" | "muted"; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
export { Btn } from "./btn";
export const inputCls = "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm";
