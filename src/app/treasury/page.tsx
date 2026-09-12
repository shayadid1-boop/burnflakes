import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments, STATUS_HE, PAID_FROM_HE, METHOD_HE } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Kpi, Btn, inputCls } from "@/components/ui";
import { money, money2, num } from "@/lib/format";
import { setExpenseStatus, recordPayment, recordPayout, recordIncome, setPaymentStatus, setPaymentLink } from "@/app/money-actions";

type Ledger = { event_member_id: string; first_name: string; last_name: string | null; tier: string; participation_share: number; due: number; paid: number; fronted: number; paid_out: number; surplus_share: number; balance: number };

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = "all" } = await searchParams;
  const me = await requireMember();
  if (me.role !== "admin") redirect("/me");
  if (!me.eventId) redirect("/me");
  const supabase = await createClient();

  const [{ data: ledgerRows }, { data: pending }, { data: funds }, { data: payments }, { data: pendingPayments }, { data: ev }, { data: incomes }, depts] = await Promise.all([
    supabase.rpc("ledger", { p_event: me.eventId }),
    supabase.from("v_expenses").select("*").eq("event_id", me.eventId).eq("status", "pending").order("created_at"),
    supabase.from("funds").select("id, key, name_he, from_members").eq("event_id", me.eventId),
    supabase.from("payments").select("id, amount, method, paid_at, event_member_id, funds(name_he)").eq("event_id", me.eventId).eq("status", "confirmed").order("paid_at", { ascending: false }).limit(15),
    supabase.from("payments").select("id, amount, paid_at, event_member_id, notes").eq("event_id", me.eventId).eq("status", "pending").order("paid_at"),
    supabase.from("events").select("payment_link, payment_link_label").eq("id", me.eventId).maybeSingle(),
    supabase.from("incomes").select("id, source_name, amount, received_at, funds(name_he)").eq("event_id", me.eventId).order("received_at", { ascending: false }).limit(15),
    myDepartments(me.eventId),
  ]);
  const ledger = ((ledgerRows ?? []) as Ledger[]).filter((r) => Number(r.due) > 0 || Number(r.paid) > 0 || Number(r.fronted) > 0);
  const shown = ledger.filter((r) => filter === "owe" ? Number(r.balance) > 0 : filter === "refund" ? Number(r.balance) < 0 : true);
  const memberFunds = (funds ?? []).filter((f) => f.from_members);
  const nameOf = new Map(ledger.map((r) => [r.event_member_id, `${r.first_name} ${r.last_name ?? ""}`.trim()]));
  const totals = ledger.reduce((t, r) => ({ due: t.due + Number(r.due), paid: t.paid + Number(r.paid), fronted: t.fronted + Number(r.fronted), owe: t.owe + Math.max(0, Number(r.balance)), refund: t.refund + Math.max(0, -Number(r.balance)) }), { due: 0, paid: 0, fronted: 0, owe: 0, refund: 0 });

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4">
        <h1 className="text-2xl font-bold">כספים · {me.eventName}</h1>

        <div className="grid gap-3 md:grid-cols-5">
          <Kpi label="דמי קמפ צפויים" value={money(totals.due)} />
          <Kpi label="נגבה" value={money(totals.paid)} />
          <Kpi label="הוצאות מהכיס של חברים" value={money(totals.fronted)} />
          <Kpi label="עוד לא שולם" value={money(totals.owe)} tone="bad" />
          <Kpi label="החזרים לביצוע" value={money(totals.refund)} tone="good" />
        </div>

        {(pendingPayments ?? []).length > 0 && (
          <Card title={`תשלומים שחברים דיווחו — לאישור (${num(pendingPayments!.length)})`} className="border-amber-300">
            <table className="w-full text-sm"><tbody>
              {pendingPayments!.map((p) => (
                <tr key={p.id}>
                  <td className="p-2 text-stone-500">{p.paid_at}</td><td className="p-2 font-medium">{nameOf.get(p.event_member_id) ?? "?"}</td>
                  <td className="p-2 tabular-nums font-medium">{money2(p.amount)}</td><td className="p-2 text-xs text-stone-500">{p.notes}</td>
                  <td className="p-2"><div className="flex gap-2">
                    <form action={setPaymentStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="confirmed" /><Btn type="submit">התקבל</Btn></form>
                    <form action={setPaymentStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="cancelled" /><Btn variant="danger" type="submit">לא התקבל</Btn></form>
                  </div></td>
                </tr>
              ))}
            </tbody></table>
            <p className="mt-2 text-xs text-stone-500">בדוק בפייבוקס שהכסף באמת הגיע לפני ״התקבל״.</p>
          </Card>
        )}

        {(pending ?? []).length > 0 && (
          <Card title={`הוצאות ממתינות לאישור (${num(pending!.length)})`} className="border-amber-300">
            <table className="w-full text-sm">
              <tbody>
                {pending!.map((x) => (
                  <tr key={x.id} className="border-t border-stone-100">
                    <td className="p-2 text-stone-500">{x.expense_date}</td><td className="p-2">{x.description}{x.has_receipt && " 🧾"}</td>
                    <td className="p-2 text-stone-500">{x.department}</td><td className="p-2">{x.paid_by} <span className="text-xs text-stone-400">{PAID_FROM_HE[x.paid_from]}</span></td>
                    <td className="p-2 tabular-nums font-medium">{money(x.amount)}</td>
                    <td className="p-2"><div className="flex gap-2">
                      <form action={setExpenseStatus}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="status" value="approved" /><input type="hidden" name="back" value="/treasury" /><Btn type="submit">אשר</Btn></form>
                      <form action={setExpenseStatus}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="status" value="rejected" /><input type="hidden" name="back" value="/treasury" /><Btn variant="danger" type="submit">דחה</Btn></form>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Card title="ספר החשבונות של החברים">
          <div className="mb-2 flex gap-2 text-sm">
            {[["all", "כולם"], ["owe", "חייבים"], ["refund", "מגיע להם החזר"]].map(([k, l]) => (
              <a key={k} href={`/treasury?filter=${k}`} className={`rounded-md px-2 py-1 ${filter === k ? "bg-stone-800 text-white" : "bg-stone-100"}`}>{l}</a>
            ))}
          </div>
          {ledger.length === 0 && <p className="text-sm text-stone-500">אין עדיין חיובים — אשר תרחיש תקציב כדי לקבוע דמי קמפ.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-stone-500"><tr className="text-right">
                <th className="p-2 font-normal">חבר</th><th className="p-2 font-normal">חוב</th><th className="p-2 font-normal">שילם</th><th className="p-2 font-normal">מהכיס</th><th className="p-2 font-normal">חלק בעודף</th><th className="p-2 font-normal">הוחזר</th><th className="p-2 font-normal">יתרה</th><th className="p-2 font-normal"></th>
              </tr></thead>
              <tbody>
                {shown.map((r) => {
                  const b = Number(r.balance);
                  return (
                    <tr key={r.event_member_id} className="border-t border-stone-100">
                      <td className="p-2 whitespace-nowrap">{r.first_name} {r.last_name}{Number(r.participation_share) !== 1 && <span className="text-xs text-stone-500"> ×{r.participation_share}</span>}</td>
                      <td className="p-2 tabular-nums">{money2(r.due)}</td><td className="p-2 tabular-nums">{money2(r.paid)}</td><td className="p-2 tabular-nums">{money2(r.fronted)}</td>
                      <td className="p-2 tabular-nums">{money2(r.surplus_share)}</td><td className="p-2 tabular-nums">{money2(r.paid_out)}</td>
                      <td className={`p-2 tabular-nums font-semibold ${b > 0 ? "text-red-700" : b < 0 ? "text-green-700" : ""}`}>{b > 0 ? `חייב ${money2(b)}` : b < 0 ? `להחזיר ${money2(-b)}` : "מאוזן"}</td>
                      <td className="p-2">
                        {b < 0 && (
                          <form action={recordPayout} className="flex items-center gap-1">
                            <input type="hidden" name="event_member_id" value={r.event_member_id} />
                            <input type="hidden" name="amount" value={(-b).toFixed(2)} />
                            <select name="method" className={inputCls} defaultValue="bit">{Object.entries(METHOD_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                            <Btn variant="ghost" type="submit">סמן החזר בוצע</Btn>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="רישום תשלום שהתקבל מחבר">
            {memberFunds.length === 0 ? <p className="text-sm text-stone-500">אין קופה לגבייה — אשר תרחיש.</p> : (
              <form action={recordPayment} className="grid grid-cols-2 gap-2 text-sm">
                <select name="event_member_id" className={`${inputCls} col-span-2`} required>
                  {ledger.map((r) => <option key={r.event_member_id} value={r.event_member_id}>{r.first_name} {r.last_name}</option>)}
                </select>
                <select name="fund_id" className={inputCls}>{memberFunds.map((f) => <option key={f.id} value={f.id}>{f.name_he}</option>)}</select>
                <input name="amount" type="number" step="0.01" placeholder="סכום" className={inputCls} required />
                <select name="method" className={inputCls} defaultValue="paybox">{Object.entries(METHOD_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input name="paid_at" type="date" className={inputCls} />
                <input name="notes" placeholder="הערה" className={`${inputCls} col-span-2`} />
                <Btn type="submit" className="col-span-2">רשום תשלום</Btn>
              </form>
            )}
            <ul className="mt-3 space-y-1 text-xs text-stone-600">
              {(payments ?? []).map((p) => <li key={p.id}>{p.paid_at} · {nameOf.get(p.event_member_id) ?? "?"} · {money(p.amount)} · {METHOD_HE[p.method]}</li>)}
            </ul>
          </Card>
          <Card title="הכנסה שאינה מחבר (תרומה, ספונסר, מכירה)">
            <form action={recordIncome} className="grid grid-cols-2 gap-2 text-sm">
              <input type="hidden" name="back" value="/treasury" />
              <input name="source_name" placeholder="מקור" className={`${inputCls} col-span-2`} required />
              <select name="fund_kind" className={inputCls} defaultValue="donation">
                <option value="fundraiser">אירוע גיוס</option><option value="donation">תרומה</option><option value="sponsorship">ספונסר</option><option value="sale">מכירה</option><option value="carryover">יתרה משנה קודמת</option><option value="other">אחר</option>
              </select>
              <input name="amount" type="number" step="0.01" placeholder="סכום" className={inputCls} required />
              <input name="received_at" type="date" className={inputCls} />
              <Btn type="submit">רשום הכנסה</Btn>
            </form>
            <ul className="mt-3 space-y-1 text-xs text-stone-600">
              {(incomes ?? []).map((i) => { const f = i.funds as unknown as { name_he: string } | null; return <li key={i.id}>{i.received_at} · {i.source_name} · {money(i.amount)} · {f?.name_he}</li>; })}
            </ul>
          </Card>
        </div>
        <Card title="קישור לתשלום דמי קמפ">
          <form action={setPaymentLink} className="flex flex-wrap items-center gap-2 text-sm">
            <input name="payment_link" defaultValue={ev?.payment_link ?? ""} dir="ltr" placeholder="https://links.payboxapp.com/…" className={`${inputCls} w-80`} />
            <input name="payment_link_label" defaultValue={ev?.payment_link_label ?? "PayBox"} placeholder="שם (PayBox / Bit)" className={`${inputCls} w-28`} />
            <Btn variant="ghost" type="submit">שמור</Btn>
          </form>
          <p className="mt-2 text-xs text-stone-500">מופיע כפתור ״שלם״ ב״החשבון שלי״ לכל חבר שיש לו יתרה לתשלום. אחרי התשלום החבר לוחץ ״שילמתי״ ואתה מאשר כאן.</p>
        </Card>
        <p className="text-xs text-stone-400">מצבי הוצאה: {Object.values(STATUS_HE).join(" · ")}</p>
      </main>
    </>
  );
}
