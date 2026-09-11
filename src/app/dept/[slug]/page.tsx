import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments, STATUS_HE, PAID_FROM_HE } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Btn, inputCls } from "@/components/ui";
import { ExpenseForm } from "@/components/expense-form";
import { ShiftManager } from "@/components/shift-manager";
import { money, num } from "@/lib/format";
import { setExpenseStatus, deleteExpense, recordIncome } from "@/app/money-actions";

export default async function DeptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await requireMember();
  if (!me.eventId) redirect("/me");
  const supabase = await createClient();
  const depts = await myDepartments(me.eventId);
  const dept = depts.find((d) => d.slug === slug);
  if (!dept) notFound();          // not my department (or not a lead) — 404 on purpose
  const back = `/dept/${slug}`;

  const [{ data: lines }, { data: expenses }, { data: people }, { data: incomes }, { data: net }] = await Promise.all([
    supabase.from("budget_lines").select("id, name_he, planned_amount, department_id").eq("event_id", me.eventId).eq("department_id", dept.id).order("name_he"),
    supabase.from("v_expenses").select("*").eq("event_id", me.eventId).eq("department_id", dept.id).order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("event_members").select("id, members(first_name, last_name)").eq("event_id", me.eventId).eq("attending", true),
    dept.kind === "fundraiser"
      ? supabase.from("incomes").select("id, source_name, amount, received_at").eq("event_id", me.eventId).eq("department_id", dept.id).order("received_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; source_name: string; amount: number; received_at: string }[] }),
    dept.kind === "fundraiser"
      ? supabase.from("v_fundraiser_net").select("*").eq("event_id", me.eventId).eq("department_id", dept.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const active = (expenses ?? []).filter((x) => x.status !== "rejected");
  const planned = (lines ?? []).reduce((s, l) => s + Number(l.planned_amount), 0);
  const actual = active.reduce((s, x) => s + Number(x.amount), 0);
  const over = actual > planned && planned > 0;
  const byLine = new Map<string | null, number>();
  for (const x of active) byLine.set(x.budget_line_id, (byLine.get(x.budget_line_id) ?? 0) + Number(x.amount));
  const unplanned = byLine.get(null) ?? 0;
  const persons = (people ?? []).map((p) => {
    const m = p.members as unknown as { first_name: string; last_name: string | null } | null;
    return { id: p.id, name: `${m?.first_name ?? ""} ${m?.last_name ?? ""}`.trim() };
  }).sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4">
        <h1 className="text-2xl font-bold">{dept.name_he}</h1>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><div className="text-xs text-stone-500">תקציב מאושר</div><div className="text-xl font-bold">{money(planned)}</div></Card>
          <Card className={over ? "border-red-300 bg-red-50" : ""}><div className="text-xs text-stone-500">הוצא בפועל</div><div className={`text-xl font-bold ${over ? "text-red-700" : ""}`}>{money(actual)}</div></Card>
          <Card><div className="text-xs text-stone-500">יתרה</div><div className={`text-xl font-bold ${over ? "text-red-700" : "text-green-700"}`}>{money(planned - actual)}</div></Card>
        </div>
        {planned === 0 && <p className="text-sm text-amber-700">עדיין אין תקציב מאושר לשנה הזו — המנהל צריך לאשר תרחיש.</p>}

        {dept.kind === "fundraiser" && (
          <Card title="אירוע גיוס — הכנסות ורווח">
            <div className="grid gap-2 text-sm md:grid-cols-4">
              <div>הכנסות מתוכננות: <b>{money(net?.income_planned)}</b></div>
              <div>הכנסות בפועל: <b>{money(net?.income_actual)}</b></div>
              <div>הוצאות בפועל: <b>{money(net?.cost_actual)}</b></div>
              <div>רווח: <b className={Number(net?.income_actual ?? 0) - Number(net?.cost_actual ?? 0) >= 0 ? "text-green-700" : "text-red-700"}>{money(Number(net?.income_actual ?? 0) - Number(net?.cost_actual ?? 0))}</b></div>
            </div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {(incomes ?? []).map((i) => (
                  <tr key={i.id} className="border-t border-stone-100"><td className="p-2">{i.source_name}</td><td className="p-2 text-stone-500">{i.received_at}</td><td className="p-2 text-left">{money(i.amount)}</td></tr>
                ))}
              </tbody>
            </table>
            <form action={recordIncome} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="department_id" value={dept.id} />
              <input type="hidden" name="fund_kind" value="fundraiser" />
              <input name="source_name" placeholder="למשל: כרטיסים למסיבה" className={inputCls} required />
              <input name="amount" type="number" step="0.01" placeholder="סכום" className={`${inputCls} w-28`} required />
              <input name="received_at" type="date" className={inputCls} />
              <Btn variant="ghost" type="submit">+ הכנסה</Btn>
            </form>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card title="תקציב מול בפועל לפי סעיף" className="md:col-span-2">
            <table className="w-full text-sm">
              <thead className="text-stone-500"><tr className="text-right"><th className="p-2 font-normal">סעיף</th><th className="p-2 font-normal">מתוכנן</th><th className="p-2 font-normal">בפועל</th><th className="p-2 font-normal">יתרה</th></tr></thead>
              <tbody>
                {(lines ?? []).map((l) => {
                  const a = byLine.get(l.id) ?? 0; const p = Number(l.planned_amount);
                  return (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="p-2">{l.name_he}</td><td className="p-2 tabular-nums">{money(p)}</td><td className="p-2 tabular-nums">{money(a)}</td>
                      <td className={`p-2 tabular-nums ${a > p ? "text-red-700 font-semibold" : "text-stone-600"}`}>{money(p - a)}</td>
                    </tr>
                  );
                })}
                {unplanned > 0 && <tr className="border-t border-stone-100 bg-amber-50"><td className="p-2">לא מתוכנן</td><td className="p-2">—</td><td className="p-2 tabular-nums">{money(unplanned)}</td><td className="p-2 text-red-700">−{money(unplanned)}</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="רישום הוצאה">
            <ExpenseForm departments={[dept]} fixedDepartment={dept} lines={lines ?? []} people={persons} lead back={back} />
          </Card>
        </div>

        <Card title={`הוצאות (${num(active.length)})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-stone-500"><tr className="text-right"><th className="p-2 font-normal">תאריך</th><th className="p-2 font-normal">מה</th><th className="p-2 font-normal">מי שילם</th><th className="p-2 font-normal">סעיף</th><th className="p-2 font-normal">סכום</th><th className="p-2 font-normal">מצב</th><th className="p-2 font-normal"></th></tr></thead>
              <tbody>
                {(expenses ?? []).map((x) => (
                  <tr key={x.id} className={`border-t border-stone-100 ${x.status === "rejected" ? "text-stone-400 line-through" : ""}`}>
                    <td className="p-2 whitespace-nowrap">{x.expense_date}</td>
                    <td className="p-2">{x.description}{x.has_receipt && <span title="יש קבלה"> 🧾</span>}</td>
                    <td className="p-2">{x.paid_by} <span className="text-xs text-stone-400">{PAID_FROM_HE[x.paid_from]}</span></td>
                    <td className="p-2 text-stone-500">{x.budget_line ?? "לא מתוכנן"}</td>
                    <td className="p-2 tabular-nums">{money(x.amount)}</td>
                    <td className="p-2">{STATUS_HE[x.status]}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {x.status === "pending" && (
                          <form action={setExpenseStatus}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="status" value="approved" /><input type="hidden" name="back" value={back} /><button className="text-xs text-green-700 hover:underline">אשר</button></form>
                        )}
                        {x.status === "pending" && (
                          <form action={setExpenseStatus}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="status" value="rejected" /><input type="hidden" name="back" value={back} /><button className="text-xs text-red-700 hover:underline">דחה</button></form>
                        )}
                        {x.status !== "reimbursed" && x.status !== "settled" && (
                          <form action={deleteExpense}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="back" value={back} /><button className="text-xs text-stone-400 hover:underline">מחק</button></form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(expenses ?? []).length === 0 && <tr><td className="p-2 text-stone-400" colSpan={7}>עדיין אין הוצאות</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="לוח המשמרות של המחלקה">
          <ShiftManager eventId={me.eventId} departmentId={dept.id} people={persons} back={back} />
        </Card>
      </main>
    </>
  );
}
