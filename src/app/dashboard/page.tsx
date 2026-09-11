import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { money, num } from "@/lib/format";

type Ledger = { first_name: string; last_name: string | null; due: number; paid: number; balance: number };

export default async function DashboardPage() {
  const me = await requireMember();
  if (me.role !== "admin" || !me.eventId) redirect("/me");
  const supabase = await createClient();
  const [depts, { data: dash }, { data: balance }, { data: byDept }, { data: pending }, { data: ledgerRows }] = await Promise.all([
    myDepartments(me.eventId),
    supabase.from("v_management_dashboard").select("*").eq("event_id", me.eventId).maybeSingle(),
    supabase.from("v_event_balance").select("*").eq("event_id", me.eventId),
    supabase.from("v_department_budget_vs_actual").select("*").eq("event_id", me.eventId),
    supabase.from("v_expenses").select("id, description, amount, department, paid_by").eq("event_id", me.eventId).eq("status", "pending"),
    supabase.rpc("ledger", { p_event: me.eventId }),
  ]);
  const income = (balance ?? []).filter((b) => b.side === "income");
  const expense = (balance ?? []).filter((b) => b.side === "expense").filter((b) => Number(b.planned) > 0 || Number(b.actual) > 0);
  const sum = (rows: { planned: number; actual: number }[], k: "planned" | "actual") => rows.reduce((s, r) => s + Number(r[k]), 0);
  const overDepts = (byDept ?? []).filter((d) => Number(d.actual) > Number(d.planned) && Number(d.planned) > 0);
  const notPaid = ((ledgerRows ?? []) as Ledger[]).filter((r) => Number(r.due) > 0 && Number(r.paid) < Number(r.due));
  const refunds = ((ledgerRows ?? []) as Ledger[]).filter((r) => Number(r.balance) < 0);

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">לוח ניהול · {me.eventName}</h1>
          <a href="/export" className="mr-auto rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50">⬇ ייצוא לאקסל (גיבוי)</a>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <Card><div className="text-xs text-stone-500">תקציב מאושר</div><div className="text-lg font-bold">{money(dash?.planned_total)}</div></Card>
          <Card><div className="text-xs text-stone-500">הוצא בפועל</div><div className="text-lg font-bold">{money(dash?.actual_total)}</div></Card>
          <Card><div className="text-xs text-stone-500">נגבה מחברים</div><div className="text-lg font-bold">{money(dash?.collected_total)}</div></Card>
          <Card><div className="text-xs text-stone-500">הכנסות אחרות</div><div className="text-lg font-bold">{money(dash?.other_income_total)}</div></Card>
          <Card className={Number(dash?.net_result ?? 0) >= 0 ? "bg-green-50" : "bg-red-50"}><div className="text-xs text-stone-500">תוצאה נטו</div><div className="text-lg font-bold">{money(dash?.net_result)}</div></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card title="התראות" className="md:col-span-1">
            <ul className="space-y-2 text-sm">
              {overDepts.map((d) => <li key={d.slug} className="rounded-md bg-red-50 p-2 text-red-800">🔴 {d.department} בחריגה: {money(d.actual)} מתוך {money(d.planned)}</li>)}
              {(pending ?? []).length > 0 && <li className="rounded-md bg-amber-50 p-2 text-amber-800">🟡 {num(pending!.length)} הוצאות ממתינות לאישור ({money(pending!.reduce((s, x) => s + Number(x.amount), 0))}) — <Link href="/treasury" className="underline">לאישור</Link></li>}
              {notPaid.length > 0 && <li className="rounded-md bg-amber-50 p-2 text-amber-800">🟡 {num(notPaid.length)} חברים לא השלימו תשלום — <Link href="/treasury?filter=owe" className="underline">רשימה</Link></li>}
              {refunds.length > 0 && <li className="rounded-md bg-green-50 p-2 text-green-800">🟢 {num(refunds.length)} החזרים לביצוע ({money(refunds.reduce((s, r) => s - Number(r.balance), 0))}) — <Link href="/treasury?filter=refund" className="underline">רשימה</Link></li>}
              {overDepts.length + (pending ?? []).length + notPaid.length + refunds.length === 0 && <li className="text-stone-500">הכל שקט 🙂</li>}
            </ul>
          </Card>

          <Card title="מאזן: הכנסות מול הוצאות" className="md:col-span-2">
            <table className="w-full text-sm">
              <thead className="text-stone-500"><tr className="text-right"><th className="p-2 font-normal"></th><th className="p-2 font-normal">מתוכנן</th><th className="p-2 font-normal">בפועל</th><th className="p-2 font-normal">הפרש</th></tr></thead>
              <tbody>
                <tr className="bg-stone-50 font-semibold"><td className="p-2" colSpan={4}>הכנסות</td></tr>
                {income.map((b) => <tr key={b.category + b.name} className="border-t border-stone-100"><td className="p-2 pr-6">{b.name}</td><td className="p-2 tabular-nums">{money(b.planned)}</td><td className="p-2 tabular-nums">{money(b.actual)}</td><td className="p-2 tabular-nums text-stone-500">{money(Number(b.actual) - Number(b.planned))}</td></tr>)}
                <tr className="border-t border-stone-200 font-medium"><td className="p-2">סה״כ הכנסות</td><td className="p-2">{money(sum(income, "planned"))}</td><td className="p-2">{money(sum(income, "actual"))}</td><td /></tr>
                <tr className="bg-stone-50 font-semibold"><td className="p-2" colSpan={4}>הוצאות</td></tr>
                {expense.map((b) => { const over = Number(b.actual) > Number(b.planned); return <tr key={b.category} className="border-t border-stone-100"><td className="p-2 pr-6">{b.name}</td><td className="p-2 tabular-nums">{money(b.planned)}</td><td className={`p-2 tabular-nums ${over ? "text-red-700 font-semibold" : ""}`}>{money(b.actual)}</td><td className={`p-2 tabular-nums ${over ? "text-red-700" : "text-stone-500"}`}>{money(Number(b.planned) - Number(b.actual))}</td></tr>; })}
                <tr className="border-t border-stone-200 font-medium"><td className="p-2">סה״כ הוצאות</td><td className="p-2">{money(sum(expense, "planned"))}</td><td className="p-2">{money(sum(expense, "actual"))}</td><td /></tr>
                <tr className="border-t-2 border-stone-400 font-bold"><td className="p-2">תוצאה</td><td className="p-2">{money(sum(income, "planned") - sum(expense, "planned"))}</td><td className="p-2">{money(sum(income, "actual") - sum(expense, "actual"))}</td><td /></tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-stone-500">דמי הקמפ המתוכננים = מספר החברים × דמי קמפ לחבר מהתרחיש המאושר; דמי הקמפ בפועל = מה שנגבה.</p>
          </Card>
        </div>
      </main>
    </>
  );
}
