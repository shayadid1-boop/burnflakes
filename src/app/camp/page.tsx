import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { money } from "@/lib/format";

export default async function CampPage() {
  const me = await requireMember();
  if (!me.eventId) redirect("/me");
  const supabase = await createClient();
  const [depts, { data: rows }] = await Promise.all([
    myDepartments(me.eventId),
    supabase.from("v_department_budget_vs_actual").select("*").eq("event_id", me.eventId),
  ]);
  const list = (rows ?? []).filter((r) => Number(r.planned) > 0 || Number(r.actual) > 0 || Number(r.income_planned) > 0);
  const planned = list.reduce((s, r) => s + Number(r.planned), 0);
  const actual = list.reduce((s, r) => s + Number(r.actual), 0);

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <h1 className="text-2xl font-bold">תקציב הקמפ · {me.eventName}</h1>
        <Card title="מתוכנן מול בפועל לפי מחלקה">
          {list.length === 0 ? <p className="text-sm text-stone-500">עדיין אין תקציב מאושר לשנה הזו.</p> : (
            <table className="w-full text-sm">
              <thead className="text-stone-500"><tr className="text-right"><th className="p-2 font-normal">מחלקה</th><th className="p-2 font-normal">מתוכנן</th><th className="p-2 font-normal">בפועל</th><th className="p-2 font-normal">ניצול</th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const p = Number(r.planned), a = Number(r.actual); const pct = p ? Math.round(a / p * 100) : null; const over = a > p;
                  return (
                    <tr key={r.slug} className="border-t border-stone-100">
                      <td className="p-2">{r.department}{r.kind === "fundraiser" && <span className="text-xs text-stone-400"> · גיוס (הכנסה מתוכננת {money(r.income_planned)})</span>}</td>
                      <td className="p-2 tabular-nums">{money(p)}</td>
                      <td className={`p-2 tabular-nums ${over ? "font-semibold text-red-700" : ""}`}>{money(a)}</td>
                      <td className="p-2">
                        <div className="bar max-w-40"><i className={over ? "over" : ""} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
                        <span className="text-xs text-stone-500">{pct === null ? "" : `${pct}%`}</span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-stone-300 font-semibold"><td className="p-2">סה״כ</td><td className="p-2">{money(planned)}</td><td className={`p-2 ${actual > planned ? "text-red-700" : ""}`}>{money(actual)}</td><td /></tr>
              </tbody>
            </table>
          )}
        </Card>
        <p className="text-sm text-stone-500">המשמרות עברו למסך משלהן: <a href="/shifts" className="font-bold text-orange-700 hover:underline">משמרות</a>.</p>
      </main>
    </>
  );
}
