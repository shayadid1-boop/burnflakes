"use client";
import { useMemo, useState } from "react";

export type Recipient = { id: string; name: string; email: string; attending: boolean; lead: boolean };

const inputCls = "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm";

/**
 * Pick people, write the message, and hand it to the tools that already work:
 * the member's own mail app (addresses in BCC) or a calendar file they can send on.
 * No mail server, no credentials — the message leaves from Shay's own address.
 */
export function NotifyForm({ recipients }: { recipients: Recipient[] }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(recipients.filter((r) => r.attending).map((r) => r.id)));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [place, setPlace] = useState("");
  const [copied, setCopied] = useState(false);

  const chosen = useMemo(() => recipients.filter((r) => picked.has(r.id)), [recipients, picked]);
  const emails = chosen.map((r) => r.email).join(", ");

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setAll = (ids: string[]) => setPicked(new Set(ids));

  const mailto = `mailto:?bcc=${encodeURIComponent(chosen.map((r) => r.email).join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const tooLong = mailto.length > 1800;

  async function copyEmails() {
    try { await navigator.clipboard.writeText(emails); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard blocked — the box below is selectable */ }
  }

  const icsHref = `/members/invite?title=${encodeURIComponent(subject)}&desc=${encodeURIComponent(body)}&start=${encodeURIComponent(when)}&minutes=${minutes}&place=${encodeURIComponent(place)}&to=${encodeURIComponent(chosen.map((r) => r.email).join(","))}`;

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <b>למי שולחים</b>
          <span className="text-stone-500">נבחרו {chosen.length} מתוך {recipients.length}</span>
          <span className="ms-auto flex gap-1.5">
            <button type="button" onClick={() => setAll(recipients.map((r) => r.id))} className="rounded-full border border-stone-200 bg-white px-3 py-0.5 text-xs font-bold hover:bg-stone-100">כולם</button>
            <button type="button" onClick={() => setAll(recipients.filter((r) => r.attending).map((r) => r.id))} className="rounded-full border border-stone-200 bg-white px-3 py-0.5 text-xs font-bold hover:bg-stone-100">רק מי שמגיע</button>
            <button type="button" onClick={() => setAll(recipients.filter((r) => r.lead).map((r) => r.id))} className="rounded-full border border-stone-200 bg-white px-3 py-0.5 text-xs font-bold hover:bg-stone-100">ראשי מחלקות</button>
            <button type="button" onClick={() => setAll([])} className="rounded-full border border-stone-200 bg-white px-3 py-0.5 text-xs font-bold hover:bg-stone-100">נקה</button>
          </span>
        </div>
        <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-2 sm:grid-cols-2 md:grid-cols-3">
          {recipients.map((r) => (
            <label key={r.id} className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${picked.has(r.id) ? "bg-white" : ""}`}>
              <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
              <span className="flex-1 truncate">{r.name}</span>
              {r.lead && <span className="pill muted">ראש מחלקה</span>}
              {!r.attending && <span className="text-xs text-stone-400">לא מגיע</span>}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <b className="text-sm">ההודעה</b>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="נושא — למשל: פגישת הקמה ראשונה" className={inputCls} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="מה רוצים להגיד…" className={inputCls} />
      </section>

      <section className="space-y-2 rounded-lg border border-stone-200 p-3">
        <b className="text-sm">שליחה במייל</b>
        <p className="text-sm text-stone-500">נפתחת תוכנת המייל שלך עם כל הכתובות בעותק מוסתר (BCC), הנושא והתוכן. אתה לוחץ ״שלח״ — וההודעה יוצאת מהכתובת שלך.</p>
        <div className="flex flex-wrap items-center gap-2">
          <a href={chosen.length && !tooLong ? mailto : undefined}
            className={`btn-brand rounded-lg px-4 py-1.5 text-sm ${chosen.length && !tooLong ? "" : "pointer-events-none opacity-50"}`}>פתח בתוכנת המייל</a>
          <button type="button" onClick={copyEmails} disabled={!chosen.length}
            className="rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-sm font-bold disabled:opacity-50">{copied ? "הועתק ✓" : "העתק כתובות"}</button>
        </div>
        {tooLong && <p className="text-sm text-red-600">ההודעה ארוכה מדי לפתיחה אוטומטית. העתק את הכתובות והדבק אותן בגימייל.</p>}
        {chosen.length > 0 && (
          <textarea readOnly value={emails} rows={2} dir="ltr" className={`${inputCls} text-xs`} onFocus={(e) => e.currentTarget.select()} />
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-stone-200 p-3">
        <b className="text-sm">פגישה או אירוע ליומן</b>
        <p className="text-sm text-stone-500">מוריד קובץ הזמנה (ics) עם הנושא, התיאור והמוזמנים. פותחים אותו ביומן ושולחים, או מצרפים למייל.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-stone-600">מתי<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${inputCls} w-48`} /></label>
          <label className="text-xs text-stone-600">כמה דקות<input type="number" min={15} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${inputCls} w-24`} /></label>
          <label className="flex-1 text-xs text-stone-600">איפה<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="כתובת או קישור" className={inputCls} /></label>
          <a href={when && subject ? icsHref : undefined}
            className={`btn-brand rounded-lg px-4 py-1.5 text-sm ${when && subject ? "" : "pointer-events-none opacity-50"}`}>הורד הזמנה</a>
        </div>
      </section>
    </div>
  );
}
