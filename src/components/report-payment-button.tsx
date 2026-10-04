"use client";
import { useFormStatus } from "react-dom";

/** "I paid" — asks once before sending, and locks itself while the report is on its way,
 *  so a few fast taps can't send the treasurer the same payment several times. */
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-bold hover:bg-stone-100 disabled:opacity-50">
      {pending ? "שולח לגזבר…" : label}
    </button>
  );
}

export function ReportPaymentButton({ action, amount, label }: { action: (fd: FormData) => Promise<void>; amount: number; label: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!window.confirm(`לדווח לגזבר שהעברת ${amount.toLocaleString("he-IL")} ₪? הגזבר יאשר כשיראה שהכסף הגיע.`)) e.preventDefault(); }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="amount" value={amount.toFixed(2)} />
      <span className="text-stone-600">שילמת?</span>
      <Submit label={label} />
    </form>
  );
}
