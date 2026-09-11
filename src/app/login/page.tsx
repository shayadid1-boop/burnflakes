"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="mx-auto w-full max-w-sm p-6 pt-16 space-y-6">
      <div className="space-y-1">
        <div className="font-serif text-3xl font-bold">ברנפלקס</div>
        <h1 className="text-lg font-normal text-stone-500">כניסה לניהול תקציב הקמפ</h1>
      </div>
      {status === "sent" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
          שלחנו קישור כניסה ל‑<b dir="ltr">{email}</b>. פתח את המייל ולחץ על הקישור
          (בדוק גם בספאם).
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm text-stone-600">המייל שרשום אצלנו בקמפ</span>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white p-3"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-lg bg-orange-600 p-3 font-bold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {status === "sending" ? "שולח…" : "שלח לי קישור כניסה"}
          </button>
          {status === "error" && <p className="text-sm text-red-600">שגיאה: {message}</p>}
        </form>
      )}
    </main>
  );
}
