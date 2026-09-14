"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputCls = "w-full rounded-lg border border-stone-300 bg-white p-3";

/** Set (or change) the password of the logged-in member. Reached after a first magic-link entry, or from "החשבון שלי". */
export default function SetPasswordPage() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p1 !== p2) { setStatus("error"); setMessage("הסיסמאות לא זהות."); return; }
    setStatus("busy");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: p1, data: { has_password: true } });
    if (error) { setStatus("error"); setMessage(error.message); return; }
    router.push("/me"); router.refresh();
  }

  return (
    <main className="gate">
      <div className="gate-card space-y-5">
      <div className="space-y-1 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
        <img src="/logo.png" alt="ברנפלקס" className="gate-logo" />
        <h1 className="text-base font-normal text-stone-500">קביעת סיסמה</h1>
        <p className="text-sm text-stone-500">מעכשיו נכנסים עם המייל והסיסמה. קישור למייל נשאר רק ל״שכחתי סיסמה״.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-stone-600">סיסמה חדשה (לפחות 6 תווים)</span>
          <input type="password" required dir="ltr" autoComplete="new-password" minLength={6} value={p1} onChange={(e) => setP1(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-stone-600">עוד פעם, לוודא</span>
          <input type="password" required dir="ltr" autoComplete="new-password" minLength={6} value={p2} onChange={(e) => setP2(e.target.value)} className={inputCls} />
        </label>
        <button type="submit" disabled={status === "busy"} className="btn-brand w-full rounded-lg p-3">
          {status === "busy" ? "רגע…" : "שמור סיסמה"}
        </button>
        {status === "error" && <p className="text-sm text-red-600">{message}</p>}
        <p className="text-center text-sm"><a href="/me" className="text-stone-500 underline">אחר כך</a></p>
      </form>
      </div>
    </main>
  );
}
