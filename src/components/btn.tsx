"use client";
import { useFormStatus } from "react-dom";

/** Button that disables itself while its parent form is submitting (prevents double submits). */
export function Btn({ children, variant = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const { pending } = useFormStatus();
  const cls = {
    primary: "btn-brand",
    ghost: "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  const busy = pending && (rest.type ?? "submit") === "submit";
  return (
    <button {...rest} disabled={rest.disabled || busy} aria-busy={busy} className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${cls} ${rest.className ?? ""}`}>
      {busy ? "רגע…" : children}
    </button>
  );
}
