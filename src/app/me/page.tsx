import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments, STATUS_HE, STATUS_TONE } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Pill } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";
import { ReportPaymentButton } from "@/components/report-payment-button";
import { money, money2 } from "@/lib/format";
import { deleteExpense, reportPayment } from "@/app/money-actions";

const ROLE_HE = { admin: "מנהל", dept_lead: "ראש מחלקה", member: "חבר" } as const;

export default async function MePage({ searchParams }: { searchParams: Promise<{ pay?: string; pay_error?: string }> }) {
  const sp = await searchParams;
  const payError = sp.pay_error ? sp.pay_error.slice(0, 200) : "";
  const paySent = sp.pay === "sent";
  const me = await requireMember();
  const supabase = await createClient();
  const depts = me.eventId ? await myDepartments(me.eventId) : [];

  if (!me.memberId) {
    return (
      <>
        <Nav me={me} />
        <main className="mx-auto w-full max-w-md p-6 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
            נכנסת עם <b dir="ltr">{me.userEmail}</b>, אבל המייל הזה לא רשום במאגר החברים. בקש מהמנהל להוסיף אותך.
          </div>
          <form action="/auth/signout" method="post"><button className="btn-signout">יציאה מהמערכת</button></form>
        </main>
      </>
    );
  }

  const [{ data: ledgerRows }, { data: em }, { data: myExpenses }, { data: departments }, { data: myShifts }, { data: ev }, { data: myPending }] = await Promise.all([
    me.eventId ? supabase.rpc("ledger", { p_event: me.eventId }) : Promise.resolve({ data: [] }),
    me.eventId ? supabase.from("event_members").select("id, tier, attending").eq("event_id", me.eventId).eq("member_id", me.memberId).maybeSingle() : Promise.resolve({ data: null }),
    me.eventId ? supabase.from("v_expenses").select("*").eq("event_id", me.eventId).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    supabase.from("departments").select("id, name_he").eq("is_active", true).eq("kind", "internal").order("sort_order"),
    me.eventId
      ? supabase.from("shift_assignments").select("shift_id, event_member_id, shifts!inner(event_id, day, title_he, departments(name_he), shift_roles(name_he))").eq("shifts.event_id", me.eventId).order("shift_id")
      : Promise.resolve({ data: [] }),
    me.eventId ? supabase.from("events").select("payment_link, payment_link_label, settled").eq("id", me.eventId).maybeSingle() : Promise.resolve({ data: null }),
    me.eventId ? supabase.from("payments").select("id, amount, paid_at, event_member_id").eq("event_id", me.eventId).eq("status", "pending").order("paid_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  // only MY reports — an admin can read everyone's payments, and summing those showed admins
  // "you reported 4,500 ₪" when it was three different members' reports
  const pendingSum = (myPending ?? []).filter((p) => p.event_member_id === em?.id).reduce((t, p) => t + Number(p.amount), 0);
  const ledger = (ledgerRows ?? []).find((r: { event_member_id: string }) => r.event_member_id === em?.id);
  const mine = (myExpenses ?? []).filter((x) => x.paid_by_event_member_id === em?.id || x.created_by === em?.id);
  const balance = Number(ledger?.balance ?? 0);
  // two stages: until the treasurer settles the event, a member just owes the dues; refunds come after
  const settled = ev?.settled === true;
  const due = Number(ledger?.due ?? 0), paid = Number(ledger?.paid ?? 0), fronted = Number(ledger?.fronted ?? 0);
  const duesLeft = Math.max(0, due - paid);
  const toPay = settled ? Math.max(0, balance) : duesLeft;
  const shifts = (myShifts ?? []).filter((a) => a.shifts && em && a.event_member_id === em.id).map((a) => {
    const s = a.shifts as unknown as { day: string; title_he: string | null; departments: { name_he: string } | null; shift_roles: { name_he: string } | null };
    return { id: a.shift_id, day: s.day, name: s.title_he ?? s.shift_roles?.name_he ?? "משמרת", dept: s.departments?.name_he ?? "" };
  }).sort((a, b) => a.day.localeCompare(b.day));

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-3xl space-y-6 p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">שלום {me.firstName} 👋</h1>
          <span className="text-sm text-stone-500">{me.eventName} · {me.role ? ROLE_HE[me.role] : "לא רשום השנה"}</span>
        </div>

        {em && (
          <Card title="החשבון שלי">
            {!settled ? (
              <>
                {/* before the event is settled: the dues are the dues — nothing is subtracted from them */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><div className="text-xs text-stone-500">דמי קמפ</div><div className="font-semibold">{money2(due)}</div></div>
                  <div><div className="text-xs text-stone-500">שילמתי</div><div className="font-semibold">{money2(paid)}</div></div>
                  <div className={`rounded-lg p-2 ${duesLeft > 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <div className="text-xs text-stone-500">{duesLeft > 0 ? "נשאר לשלם" : "דמי הקמפ"}</div>
                    <div className={`font-bold ${duesLeft > 0 ? "text-red-700" : "text-green-700"}`}>{duesLeft > 0 ? money2(duesLeft) : "שולמו במלואם ✓"}</div>
                  </div>
                </div>
                {fronted > 0 && (
                  <p className="mt-3 rounded-lg bg-stone-100 p-2 text-sm">
                    הוצאת מהכיס עבור הקמפ <b>{money2(fronted)}</b>. הסכום הזה לא מקוזז מדמי הקמפ — הוא יוחזר לך אחרי האירוע, כשכל החשבונות ייסגרו.
                  </p>
                )}
              </>
            ) : (
              <>
                {/* after the treasurer settled the event: the full account, refunds included */}
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                  <div><div className="text-xs text-stone-500">דמי קמפ</div><div className="font-semibold">{money2(due)}</div></div>
                  <div><div className="text-xs text-stone-500">שילמתי</div><div className="font-semibold">{money2(paid)}</div></div>
                  <div><div className="text-xs text-stone-500">הוצאתי מהכיס</div><div className="font-semibold">{money2(fronted)}</div></div>
                  <div><div className="text-xs text-stone-500">חלקי בעודף</div><div className="font-semibold">{money2(ledger?.surplus_share)}</div></div>
                  <div className={`rounded-lg p-2 ${balance > 0 ? "bg-red-50" : balance < 0 ? "bg-green-50" : "bg-stone-50"}`}>
                    <div className="text-xs text-stone-500">{balance > 0 ? "נשאר לשלם" : balance < 0 ? "מגיע לי החזר" : "מאוזן"}</div>
                    <div className={`font-bold ${balance > 0 ? "text-red-700" : balance < 0 ? "text-green-700" : ""}`}>{money2(Math.abs(balance))}</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-stone-500">החשבונות של האירוע נסגרו: ההוצאות מהכיס והחלק שלך בעודף כבר מחושבים כאן.</p>
              </>
            )}
            {toPay > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">
                {/* the payment link stays visible while anything is still owed — a report waiting for the treasurer is not money received yet */}
                {ev?.payment_link && <a href={ev.payment_link} target="_blank" rel="noopener" className="btn-brand rounded-lg px-3.5 py-1.5">לתשלום {money2(toPay)} ב‑{ev.payment_link_label ?? "PayBox"}</a>}
                {pendingSum > 0 ? (
                  <span className="text-stone-600">דיווחת על {money2(pendingSum)} — ממתין לאישור הגזבר.</span>
                ) : (
                  <ReportPaymentButton action={reportPayment} amount={toPay} label={`שילמתי ${money2(toPay)}`} />
                )}
              </div>
            )}
            {payError && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{payError}</p>}
            {paySent && pendingSum > 0 && <p className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-green-800">הדיווח נשלח לגזבר. אין צורך ללחוץ שוב — הוא יאשר כשיראה שהכסף הגיע.</p>}
            {!due && <p className="mt-2 text-xs text-stone-500">דמי הקמפ ייקבעו כשהמנהל יאשר את תרחיש התקציב של השנה.</p>}
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="רישום הוצאה מהכיס">
            {em?.attending ? <ExpenseForm departments={departments ?? []} back="/me" /> : <p className="text-sm text-stone-500">רק מי שמגיע השנה יכול לרשום הוצאות.</p>}
          </Card>
          <Card title="המשמרות שלי">
            {shifts.length === 0 ? <p className="text-sm text-stone-500">עדיין לא נרשמת למשמרות. <a href="/shifts" className="text-orange-700 underline">למסך המשמרות</a></p> : (
              <ul className="space-y-1 text-sm">
                {shifts.map((s) => <li key={s.id} className="flex justify-between border-b border-stone-100 py-1"><span>{s.day} · {s.name}</span><span className="text-stone-500">{s.dept}</span></li>)}
              </ul>
            )}
          </Card>
        </div>

        <Card title="ההוצאות שרשמתי">
          <table className="w-full text-sm">
            <tbody>
              {mine.map((x) => (
                <tr key={x.id} className="border-t border-stone-100">
                  <td className="p-2 whitespace-nowrap text-stone-500">{x.expense_date}</td>
                  <td className="p-2">{x.description} <span className="text-xs text-stone-400">· {x.department}</span></td>
                  <td className="p-2 tabular-nums">{money(x.amount)}</td>
                  <td className="p-2"><Pill tone={STATUS_TONE[x.status] ?? "muted"}>{STATUS_HE[x.status]}</Pill></td>
                  <td className="p-2">{x.status === "pending" && <form action={deleteExpense}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="back" value="/me" /><button className="text-xs text-stone-400 hover:underline">מחק</button></form>}</td>
                </tr>
              ))}
              {mine.length === 0 && <tr><td className="p-2 text-stone-400">אין עדיין</td></tr>}
            </tbody>
          </table>
        </Card>

        <div className="flex gap-4 text-sm text-stone-500">
          <a href="/set-password" className="underline">שינוי סיסמה</a>
          <form action="/auth/signout" method="post"><button className="btn-signout">יציאה מהמערכת</button></form>
        </div>
      </main>
    </>
  );
}
