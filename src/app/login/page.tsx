"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputCls = "w-full rounded-lg border border-stone-300 bg-white p-3";

/**
 * Login: email + password by default. First-time members (or "forgot password") get a one-time
 * link by email; after that link they set a password (/set-password) and use it from then on.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("busy"); setMessage("");
    const supabase = createClient();
    const mail = email.trim().toLowerCase();
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (error) {
        setStatus("error");
        setMessage(/invalid/i.test(error.message) ? "מייל או סיסמה לא נכונים. אם עוד לא קבעת סיסמה — בקש קישור כניסה למייל." : error.message);
        return;
      }
      router.push("/me"); router.refresh();
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email: mail, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/set-password` } });
    if (error) { setStatus("error"); setMessage(error.message); } else setStatus("sent");
  }

  return (
    <main className="gate">
      <div className="gate-card space-y-5">
      <div className="space-y-1 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
        <img src="/logo.png" alt="ברנפלקס" className="gate-logo" />
        <h1 className="gate-title">ברוכים הבאים ללול התרנגולות</h1>
        <p className="gate-sub">מערכת לניהול הקמפ</p>
      </div>

      {status === "sent" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
          שלחנו קישור כניסה ל‑<b dir="ltr">{email}</b>. פתח את המייל ולחץ על הקישור (בדוק גם בספאם). אחרי הכניסה תתבקש לקבוע סיסמה.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm text-stone-600">המייל שרשום אצלנו בקמפ</span>
            <input type="email" required dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
          </label>
          {mode === "password" && (
            <label className="block space-y-1">
              <span className="text-sm text-stone-600">סיסמה</span>
              <input type="password" required dir="ltr" autoComplete="current-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </label>
          )}
          <button type="submit" disabled={status === "busy"} className="btn-brand w-full rounded-lg p-3">
            {status === "busy" ? "רגע…" : mode === "password" ? "כניסה" : "שלח לי קישור כניסה למייל"}
          </button>
          {status === "error" && <p className="text-sm text-red-600">{message}</p>}
          <p className="text-center text-sm text-stone-500">
            {mode === "password" ? (
              <button type="button" onClick={() => { setMode("link"); setStatus("idle"); }} className="underline">כניסה ראשונה או שכחתי סיסמה — שלחו לי קישור למייל</button>
            ) : (
              <button type="button" onClick={() => { setMode("password"); setStatus("idle"); }} className="underline">יש לי סיסמה — חזרה לכניסה</button>
            )}
          </p>
        </form>
      )}
      </div>
    </main>
  );
}
