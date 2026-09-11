import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Kpi, Btn, inputCls } from "@/components/ui";
import { money, money2, num } from "@/lib/format";
import { setAllParams, overrideLine, resetLine, addManualLine, addIncome, deleteIncome, cloneScenario, approveScenario, renameScenario, deleteScenario } from "../actions";

const FUND_HE: Record<string, string> = { fundraiser: "אירוע גיוס", donation: "תרומה", sponsorship: "ספונסר", sale: "מכירה", carryover: "יתרה משנה קודמת", other: "אחר" };
const DRIVER_HE: Record<string, string> = { fixed: "קבוע", per_member: "לפי חבר", per_sqm: 'לפי מ"ר', per_meal: "לפי ארוחה" };

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember();
  if (me.role !== "admin") redirect("/me");
  const supabase = await createClient();

  const { data: scenario } = await supabase.from("scenarios").select("id, name, status, event_id, computed_at, events(name, year)").eq("id", id).maybeSingle();
  if (!scenario) notFound();
  const frozen = scenario.status === "approved";
  const depts = await myDepartments(scenario.event_id);

  const [{ data: params_ }, { data: options }, { data: values }, { data: summary }, { data: byDept }, { data: lines }, { data: incomes }, { data: departments }] =
    await Promise.all([
      supabase.from("scenario_parameters").select("id, key, label_he, value_type, default_value").order("sort_order"),
      supabase.from("scenario_parameter_options").select("parameter_id, value, label_he").order("sort_order"),
      supabase.from("scenario_parameter_values").select("parameter_id, value").eq("scenario_id", id),
      supabase.from("v_scenario_summary").select("*").eq("scenario_id", id).maybeSingle(),
      supabase.from("v_scenario_by_department").select("*").eq("scenario_id", id),
      supabase.from("v_scenario_lines").select("*").eq("scenario_id", id).order("department_order").order("name_he"),
      supabase.from("scenario_income_lines").select("id, fund_kind, department_id, name_he, amount").eq("scenario_id", id),
      supabase.from("departments").select("id, slug, name_he, kind").eq("is_active", true).order("sort_order"),
    ]);
  const valueOf = new Map((values ?? []).map((v) => [v.parameter_id, v.value]));
  const total = Number(summary?.total ?? 0);
  const buffer = total * Number(summary?.buffer_pct ?? 0) / 100 + Number(summary?.buffer_amount ?? 0);
  const otherIncome = Number(summary?.other_income ?? 0);
  const ev = scenario.events as unknown as { name: string; year: number } | null;

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/scenarios" className="text-sm text-stone-500 hover:underline">← כל התרחישים</Link>
          <form action={renameScenario} className="flex items-center gap-2">
            <input type="hidden" name="scenario_id" value={id} />
            <input name="name" defaultValue={scenario.name} className="rounded-md border border-transparent bg-transparent text-2xl font-bold hover:border-stone-300" />
          </form>
          <span className={`rounded-full px-2 py-0.5 text-xs ${frozen ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600"}`}>
            {frozen ? "מאושר — תקציב השנה (קפוא)" : scenario.status === "archived" ? "ארכיון" : "טיוטה"}
          </span>
          <span className="text-sm text-stone-500">{ev?.name} {ev?.year}</span>
          <div className="mr-auto flex gap-2">
            <form action={cloneScenario}>
              <input type="hidden" name="scenario_id" value={id} />
              <input type="hidden" name="name" value={`${scenario.name} — עותק`} />
              <Btn variant="ghost" type="submit">שכפול</Btn>
            </form>
            {!frozen && (
              <form action={approveScenario}>
                <input type="hidden" name="scenario_id" value={id} />
                <Btn type="submit">אישור כתקציב השנה</Btn>
              </form>
            )}
            {!frozen && (
              <form action={deleteScenario}>
                <input type="hidden" name="scenario_id" value={id} />
                <Btn variant="danger" type="submit">מחיקה</Btn>
              </form>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Kpi label="סך הוצאות" value={money(total)} />
          <Kpi label="רזרבה" value={money(buffer)} />
          <Kpi label="הכנסות אחרות" value={<>− {money(otherIncome)}</>} />
          <Kpi label={`דמי קמפ לחבר (${num(summary?.member_count)} חברים)`} value={money2(summary?.dues_per_member)} tone="accent" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card title="הגדרות התרחיש" className="md:col-span-1">
            <form action={setAllParams} className="space-y-3">
              <input type="hidden" name="scenario_id" value={id} />
              {(params_ ?? []).map((p) => {
                const current = valueOf.get(p.id) ?? p.default_value;
                const name = `param:${p.key}:${p.value_type}`;
                return (
                  <label key={`${p.id}:${String(current)}`} className="block space-y-1 text-sm">
                    <span className="text-stone-600">{p.label_he}</span>
                    {p.value_type === "enum" ? (
                      <select name={name} defaultValue={String(current)} disabled={frozen} className={`${inputCls} w-full`}>
                        {(options ?? []).filter((o) => o.parameter_id === p.id).map((o) => (
                          <option key={o.value} value={o.value}>{o.label_he}</option>
                        ))}
                      </select>
                    ) : p.value_type === "boolean" ? (
                      <select name={name} defaultValue={String(current)} disabled={frozen} className={`${inputCls} w-full`}>
                        <option value="true">כן</option><option value="false">לא</option>
                      </select>
                    ) : (
                      <input name={name} type="number" step="any" defaultValue={String(current)} disabled={frozen} className={`${inputCls} w-full`} />
                    )}
                  </label>
                );
              })}
              {!frozen && <Btn type="submit" className="w-full">חשב מחדש</Btn>}
            </form>
          </Card>

          <Card title="תוצאה לפי מחלקה" className="md:col-span-2">
            <table className="w-full text-sm">
              <tbody>
                {(byDept ?? []).map((d) => (
                  <tr key={d.slug} className="border-t border-stone-100">
                    <td className="p-2">{d.department}</td>
                    <td className="p-2 text-left tabular-nums">{money(d.amount)}</td>
                    <td className="p-2 text-xs text-stone-400">{total ? `${Math.round(Number(d.amount) / total * 100)}%` : ""}</td>
                    <td className="w-1/3 p-2 align-middle"><div className="bar"><i style={{ width: `${total ? Math.min(100, Number(d.amount) / total * 100) : 0}%` }} /></div></td>
                  </tr>
                ))}
                <tr className="border-t-2 border-stone-300 font-semibold">
                  <td className="p-2">סה״כ</td><td className="p-2 text-left">{money(total)}</td><td /><td />
                </tr>
              </tbody>
            </table>

            <h3 className="mb-2 mt-6 font-semibold">הכנסות מתוכננות (מקטינות את דמי הקמפ)</h3>
            <table className="w-full text-sm">
              <tbody>
                {(incomes ?? []).map((i) => (
                  <tr key={i.id} className="border-t border-stone-100">
                    <td className="p-2">{i.name_he}</td>
                    <td className="p-2 text-xs text-stone-500">{FUND_HE[i.fund_kind] ?? i.fund_kind}</td>
                    <td className="p-2 text-left tabular-nums">{money(i.amount)}</td>
                    <td className="p-2 text-left">
                      {!frozen && (
                        <form action={deleteIncome}><input type="hidden" name="scenario_id" value={id} /><input type="hidden" name="id" value={i.id} /><button className="text-xs text-red-600">הסר</button></form>
                      )}
                    </td>
                  </tr>
                ))}
                {(incomes ?? []).length === 0 && <tr><td className="p-2 text-stone-400">אין הכנסות מתוכננות</td></tr>}
              </tbody>
            </table>
            {!frozen && (
              <form action={addIncome} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="scenario_id" value={id} />
                <input name="name_he" placeholder="למשל: מסיבת גיוס" className={inputCls} required />
                <select name="fund_kind" className={inputCls} defaultValue="fundraiser">
                  {Object.entries(FUND_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select name="department_id" className={inputCls} defaultValue="">
                  <option value="">— בלי מחלקה —</option>
                  {(departments ?? []).filter((d) => d.kind === "fundraiser").map((d) => <option key={d.id} value={d.id}>{d.name_he}</option>)}
                </select>
                <input name="amount" type="number" step="any" placeholder="סכום" className={`${inputCls} w-28`} required />
                <Btn variant="ghost" type="submit">+ הכנסה</Btn>
              </form>
            )}
          </Card>
        </div>

        <Card title="סעיפים (לחיצה על סעיף מאפשרת דריסה ידנית)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-stone-500">
                <tr className="text-right">
                  <th className="p-2 font-normal">מחלקה</th><th className="p-2 font-normal">סעיף</th><th className="p-2 font-normal">כלל</th>
                  <th className="p-2 font-normal">כמות</th><th className="p-2 font-normal">מחיר יחידה</th><th className="p-2 font-normal">סכום</th><th className="p-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {(lines ?? []).map((l) => (
                  <tr key={l.id} className={`border-t border-stone-100 ${l.is_override ? "bg-amber-50" : ""}`}>
                    <td className="p-2 text-stone-500">{l.department}</td>
                    <td className="p-2">{l.name_he}{l.is_override && <span className="mr-1 text-xs text-amber-700">(ידני)</span>}</td>
                    <td className="p-2 text-xs text-stone-400">{DRIVER_HE[l.quantity_driver] ?? ""}</td>
                    {frozen ? (
                      <>
                        <td className="p-2 tabular-nums">{num(l.quantity)}</td>
                        <td className="p-2 tabular-nums">{money2(l.unit_cost)}</td>
                        <td className="p-2 tabular-nums font-medium">{money(l.amount)}</td>
                        <td />
                      </>
                    ) : (
                      <>
                        <td className="p-2" colSpan={2}>
                          <form action={overrideLine} className="flex items-center gap-1" id={`f-${l.id}`}>
                            <input type="hidden" name="scenario_id" value={id} />
                            <input type="hidden" name="line_id" value={l.id} />
                            <input name="quantity" type="number" step="any" defaultValue={String(l.quantity)} className={`${inputCls} w-20`} />
                            <span className="text-stone-400">×</span>
                            <input name="unit_cost" type="number" step="any" defaultValue={String(l.unit_cost)} className={`${inputCls} w-24`} />
                            <button className="text-xs text-orange-700 hover:underline">שמור</button>
                          </form>
                        </td>
                        <td className="p-2 tabular-nums font-medium">{money(l.amount)}</td>
                        <td className="p-2">
                          {l.is_override && (
                            <form action={resetLine}><input type="hidden" name="scenario_id" value={id} /><input type="hidden" name="line_id" value={l.id} /><button className="text-xs text-stone-500 hover:underline">אפס</button></form>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!frozen && (
            <form action={addManualLine} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="scenario_id" value={id} />
              <select name="department_id" className={inputCls} required>
                {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name_he}</option>)}
              </select>
              <input name="name_he" placeholder="סעיף חדש (ידני)" className={inputCls} required />
              <input name="quantity" type="number" step="any" defaultValue="1" className={`${inputCls} w-20`} />
              <input name="unit_cost" type="number" step="any" placeholder="מחיר" className={`${inputCls} w-24`} required />
              <Btn variant="ghost" type="submit">+ סעיף ידני</Btn>
            </form>
          )}
        </Card>
      </main>
    </>
  );
}
