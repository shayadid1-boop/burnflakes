import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Kpi, Btn, Pill, inputCls } from "@/components/ui";
import { ShiftBoard, fmtDay } from "@/components/shift-board";
import { ShiftManager } from "@/components/shift-manager";
import { setShiftSettings } from "@/app/shift-actions";
import { num } from "@/lib/format";

/** Shifts section: the camp's shift board by day, my quota, and (for leads/admin) each department's planner. */
export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ day?: string; dept?: string }> }) {
  const { day: dayParam, dept: deptParam } = await searchParams;
  const me = await requireMember();
  const supabase = await createClient();
  if (!me.eventId || !me.memberId) return (<><Nav me={me} /><main className="p-6 text-sm text-stone-500">אין אירוע פעיל.</main></>);

  const [depts, { data: ev }, { data: fair }, { data: counts }, { data: em }, { data: shiftDays }] = await Promise.all([
    myDepartments(me.eventId),
    supabase.from("events").select("starts_on, ends_on, volunteer_shift_credit, volunteers_count_in_total").eq("id", me.eventId).single(),
    supabase.from("v_shift_fair_share").select("*").eq("event_id", me.eventId).maybeSingle(),
    supabase.from("v_member_shift_count").select("*").eq("event_id", me.eventId).order("remaining", { ascending: false }).order("first_name"),
    supabase.from("event_members").select("id, attending, production_volunteer").eq("event_id", me.eventId).eq("member_id", me.memberId).maybeSingle(),
    supabase.from("shifts").select("day, slots, shift_assignments(event_member_id)").eq("event_id", me.eventId),
  ]);

  // event days (build + event)
  const days: string[] = [];
  if (ev?.starts_on && ev?.ends_on) for (let d = new Date(ev.starts_on + "T00:00:00Z"); d.toISOString().slice(0, 10) <= ev.ends_on; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  const perDay = new Map<string, { slots: number; filled: number }>();
  for (const s of shiftDays ?? []) { const c = perDay.get(s.day) ?? { slots: 0, filled: 0 }; c.slots += s.slots; c.filled += (s.shift_assignments as unknown[]).length; perDay.set(s.day, c); }
  const today = new Date().toISOString().slice(0, 10);
  const day = dayParam && days.includes(dayParam) ? dayParam : (days.includes(today) ? today : days[0]);
  const mine = (counts ?? []).find((c) => c.event_member_id === em?.id);
  const totalFilled = Array.from(perDay.values()).reduce((t, c) => t + c.filled, 0);

  // planner: departments I lead (admin: all), chosen by ?dept=
  const manageable = depts.filter((d) => d.kind === "internal");
  const manageDept = manageable.find((d) => d.slug === deptParam) ?? null;
  const people = manageDept ? (counts ?? []).map((c) => ({ id: c.event_member_id, name: `${c.first_name} ${c.last_name ?? ""}`.trim() })) : [];
  const back = `/shifts?day=${day}${manageDept ? `&dept=${manageDept.slug}` : ""}`;

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1>משמרות · {me.eventName}</h1>
          <p className="text-sm text-stone-500">כל חבר שמגיע לוקח את חלקו: סך המשמרות חלקי מספר המגיעים. מתנדב בהפקה מקבל זיכוי.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Kpi label="משמרות השנה (מקומות)" value={num(fair?.total_slots)} sub={`${num(totalFilled)} כבר משובצים`} />
          <Kpi label="מגיעים" value={num(fair?.attendees)} sub={`${num(fair?.volunteers)} מתנדבים בהפקה`} />
          <Kpi label="משמרות לחבר" value={num(fair?.target_per_member)} tone="accent" sub={fair?.volunteers_count_in_total ? "כולל זיכויי מתנדבים במאגר" : "זיכוי מתנדב מחוץ למאגר"} />
          {mine ? (
            <Kpi label="החלק שלי" value={`${num(mine.taken)}/${num(mine.target_per_member)}`}
              tone={Number(mine.remaining) === 0 ? "good" : ""}
              sub={Number(mine.remaining) === 0 ? "השלמת את חלקך 🙌" : `נשארו ${num(mine.remaining)}${Number(mine.credit) > 0 ? ` (זיכוי מתנדב ${num(mine.credit)})` : ""}`} />
          ) : <Kpi label="החלק שלי" value="—" sub="לא רשום כמגיע השנה" />}
        </div>

        <Card>
          <div className="mb-3 flex gap-1 overflow-x-auto">
            {days.map((d) => {
              const c = perDay.get(d); const on = d === day;
              return (
                <Link key={d} href={`/shifts?day=${d}${manageDept ? `&dept=${manageDept.slug}` : ""}`} className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm ${on ? "border-orange-600 bg-orange-50 font-bold text-orange-800" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100"}`}>
                  {fmtDay(d).replace("יום ", "")}
                  <span className="mr-1 text-xs text-stone-400">{c ? `${c.filled}/${c.slots}` : "—"}</span>
                </Link>
              );
            })}
          </div>
          {day && <ShiftBoard eventId={me.eventId} myEmId={em?.id ?? null} day={day} back={back} canRegister={!!em?.attending} />}
        </Card>

        {manageable.length > 0 && (
          <Card title="תכנון משמרות של המחלקה">
            <div className="mb-3 flex flex-wrap gap-1">
              {manageable.map((d) => (
                <Link key={d.slug} href={`/shifts?day=${day}&dept=${d.slug}`} className={`pill ${manageDept?.slug === d.slug ? "plan" : "muted"}`}>{d.name_he}</Link>
              ))}
            </div>
            {manageDept ? (
              <ShiftManager eventId={me.eventId} departmentId={manageDept.id} people={people} back={back} />
            ) : <p className="text-sm text-stone-500">בחר מחלקה כדי להגדיר תפקידים, לפתוח משמרות לפי ימים ושעות, ולשבץ.</p>}
          </Card>
        )}

        {me.role === "admin" && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="הגדרות חלוקה">
              <form action={setShiftSettings} className="space-y-3 text-sm">
                <label className="block">זיכוי משמרות למתנדב בהפקה
                  <input name="volunteer_shift_credit" type="number" min="0" defaultValue={ev?.volunteer_shift_credit ?? 1} className={`${inputCls} mt-1 w-full`} />
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" name="volunteers_count_in_total" defaultChecked={!!ev?.volunteers_count_in_total} /> הזיכויים נספרים גם במאגר המשמרות (מעלה את המכסה לכולם)</label>
                <Btn type="submit">שמור</Btn>
                <p className="text-xs text-stone-500">מי נחשב מתנדב בהפקה מסמנים במסך חברים, בפרטי השנה.</p>
              </form>
            </Card>
            <Card title="מי לקח כמה" className="md:col-span-2">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-right"><th className="p-2 font-normal">חבר</th><th className="p-2 font-normal">לקח</th><th className="p-2 font-normal">זיכוי</th><th className="p-2 font-normal">נשאר</th></tr></thead>
                  <tbody>
                    {(counts ?? []).map((c) => (
                      <tr key={c.event_member_id}>
                        <td className="p-2">{c.first_name} {c.last_name}{c.production_volunteer && <span className="pill plan mr-1">מתנדב/ת</span>}</td>
                        <td className="p-2 tabular-nums">{num(c.taken)}</td>
                        <td className="p-2 tabular-nums">{num(c.credit)}</td>
                        <td className="p-2">{Number(c.remaining) === 0 ? <Pill tone="good">הושלם</Pill> : <Pill tone="warn">עוד {num(c.remaining)}</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
