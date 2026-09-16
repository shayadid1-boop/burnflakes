import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments, STATUS_TONE } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Btn, Pill, inputCls } from "@/components/ui";
import { money, money2, num } from "@/lib/format";
import { newScenario, cloneScenario, approveScenario } from "./actions";

const STATUS_HE: Record<string, string> = { draft: "טיוטה", approved: "מאושר ✔", archived: "ארכיון" };

export default async function ScenariosPage() {
  const me = await requireMember();
  if (me.role !== "admin") redirect("/me");
  const supabase = await createClient();
  const depts = me.eventId ? await myDepartments(me.eventId) : [];

  const [{ data: events }, { data: rows }] = await Promise.all([
    supabase.from("events").select("id, name, year, status").order("year", { ascending: false }),
    supabase.from("v_scenario_summary").select("*"),
  ]);
  const { data: scenarios } = await supabase.from("scenarios").select("id, event_id, name, status, created_at, computed_at");
  const summary = new Map((rows ?? []).map((r) => [r.scenario_id, r]));

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4">
        <h1 className="text-2xl font-bold">תרחישי תקציב</h1>
        <p className="text-sm text-stone-600">
          כל תרחיש הוא שילוב של הגדרות (מספר חברים, הצללה, ארוחות, גיפט, רזרבה) + הכנסות מתוכננות. אישור תרחיש הופך אותו לתקציב המאושר של השנה.
        </p>

        {(events ?? []).map((ev) => {
          const list = (scenarios ?? []).filter((s) => s.event_id === ev.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
          // a closed year whose scenarios are all in the archive (2022) is history, not something to plan with —
          // the data stays in the database, it just does not clutter the planning screen
          if (ev.id !== me.eventId && list.every((s) => s.status === "archived")) return null;
          return (
            <Card key={ev.id} title={`${ev.name} · ${ev.year}`}>
              {list.length === 0 && <p className="text-sm text-stone-500">אין עדיין תרחישים לשנה הזו.</p>}
              {list.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-stone-500">
                      <tr className="text-right">
                        <th className="p-2 font-normal">תרחיש</th>
                        <th className="p-2 font-normal">מצב</th>
                        <th className="p-2 font-normal">חברים</th>
                        <th className="p-2 font-normal">הוצאות</th>
                        <th className="p-2 font-normal">רזרבה</th>
                        <th className="p-2 font-normal">הכנסות אחרות</th>
                        <th className="p-2 font-normal">דמי קמפ לחבר</th>
                        <th className="p-2 font-normal"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((s) => {
                        const r = summary.get(s.id);
                        return (
                          <tr key={s.id} className="border-t border-stone-100">
                            <td className="p-2">
                              <Link href={`/scenarios/${s.id}`} className="font-medium text-orange-700 hover:underline">{s.name}</Link>
                            </td>
                            <td className="p-2"><Pill tone={STATUS_TONE[s.status] ?? "muted"}>{STATUS_HE[s.status] ?? s.status}</Pill></td>
                            <td className="p-2">{num(r?.member_count)}</td>
                            <td className="p-2">{money(r?.total)}</td>
                            <td className="p-2">{r?.buffer_pct ? `${num(r.buffer_pct)}%` : ""}{Number(r?.buffer_amount) > 0 ? ` + ${money(r?.buffer_amount)}` : ""}</td>
                            <td className="p-2">{money(r?.other_income)}</td>
                            <td className="p-2 font-semibold">{money2(r?.dues_per_member)}</td>
                            <td className="p-2">
                              <div className="flex gap-1">
                                <form action={cloneScenario}>
                                  <input type="hidden" name="scenario_id" value={s.id} />
                                  <input type="hidden" name="name" value={`${s.name} — עותק`} />
                                  <Btn variant="ghost" type="submit">שכפול</Btn>
                                </form>
                                {s.status === "draft" && (
                                  <form action={approveScenario}>
                                    <input type="hidden" name="scenario_id" value={s.id} />
                                    <Btn type="submit">אישור</Btn>
                                  </form>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {ev.status !== "closed" && (
                <form action={newScenario} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="event_id" value={ev.id} />
                  <input name="name" placeholder="שם לתרחיש חדש" className={inputCls} required />
                  <Btn variant="ghost" type="submit">+ תרחיש חדש מברירות המחדל</Btn>
                </form>
              )}
            </Card>
          );
        })}
      </main>
    </>
  );
}
