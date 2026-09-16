import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Btn, inputCls } from "@/components/ui";
import { ShiftGrid, type GridShift } from "@/components/shift-grid";
import { createShiftType, updateShiftType, deleteShiftType, setShiftSettings } from "@/app/shift-actions";
import { num } from "@/lib/format";

export const dynamic = "force-dynamic";

/** The shift board: one grid per department — shift types down the side, event days across the top, names in the cells. */
export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const { dept: deptParam } = await searchParams;
  const me = await requireMember();
  const supabase = await createClient();
  if (!me.eventId || !me.memberId) return (<><Nav me={me} /><main className="p-6 text-sm text-stone-500">אין אירוע פעיל.</main></>);

  const [{ data: allDepts }, myDepts, { data: ev }, { data: em }, { data: counts }] = await Promise.all([
    supabase.from("departments").select("id, slug, name_he, sort_order").eq("is_active", true).eq("kind", "internal").order("sort_order"),
    myDepartments(me.eventId),
    supabase.from("events").select("starts_on, ends_on, event_starts_on, volunteer_shift_credit, volunteers_count_in_total").eq("id", me.eventId).single(),
    supabase.from("event_members").select("id, attending").eq("event_id", me.eventId).eq("member_id", me.memberId).maybeSingle(),
    supabase.from("v_member_shift_count").select("event_member_id, first_name, last_name, remaining").eq("event_id", me.eventId),
  ]);

  const depts = allDepts ?? [];
  const dept = depts.find((d) => d.slug === deptParam) ?? depts[0];
  if (!dept) return (<><Nav me={me} /><main className="p-6 text-sm text-stone-500">אין מחלקות פעילות.</main></>);
  const canEdit = me.role === "admin" || myDepts.some((d) => d.id === dept.id);
  const back = `/shifts?dept=${dept.slug}`;

  const days: string[] = [];
  if (ev?.starts_on && ev?.ends_on) {
    for (let d = new Date(ev.starts_on + "T00:00:00Z"); d.toISOString().slice(0, 10) <= ev.ends_on; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  }
  const buildDays = ev?.event_starts_on ? days.filter((d) => d < ev.event_starts_on!) : [];

  const [{ data: types }, { data: rawShifts }] = await Promise.all([
    supabase.from("shift_roles").select("id, name_he, description_he, slots_per_shift").eq("event_id", me.eventId).eq("department_id", dept.id).order("name_he"),
    supabase.from("shifts").select("id, day, shift_role_id, slots, shift_assignments(event_member_id, event_members(members(first_name, last_name)))")
      .eq("event_id", me.eventId).eq("department_id", dept.id),
  ]);

  const shifts: GridShift[] = (rawShifts ?? []).map((s) => ({
    id: s.id, day: s.day, shift_role_id: s.shift_role_id, slots: s.slots,
    people: (s.shift_assignments as unknown as { event_member_id: string; event_members: { members: { first_name: string; last_name: string | null } | null } | null }[])
      .map((a) => ({ emId: a.event_member_id, name: `${a.event_members?.members?.first_name ?? ""} ${a.event_members?.members?.last_name ?? ""}`.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, "he")),
  }));

  const people = (counts ?? []).map((c) => ({ id: c.event_member_id, name: `${c.first_name} ${c.last_name ?? ""}`.trim(), remaining: Number(c.remaining ?? 0) }));
  const totalSlots = shifts.reduce((t, s) => t + s.slots, 0);
  const totalFilled = shifts.reduce((t, s) => t + s.people.length, 0);

  return (
    <>
      <Nav me={me} depts={myDepts} />
      <main className="mx-auto w-full max-w-6xl space-y-5 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1>לוח משמרות · {me.eventName}</h1>
          <Link href={`/shifts/print?dept=${dept.slug}`} className="text-sm font-bold text-orange-700 hover:underline">הדפסה / PDF ↗</Link>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {depts.map((d) => (
            <Link key={d.slug} href={`/shifts?dept=${d.slug}`}
              className={`rounded-full border px-3.5 py-1 text-sm font-bold ${d.slug === dept.slug ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100"}`}>
              {d.name_he}
            </Link>
          ))}
        </div>

        <Card>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2>{dept.name_he}</h2>
            <span className="text-sm text-stone-500">{num(totalFilled)} מתוך {num(totalSlots)} מקומות מאוישים</span>
          </div>
          <ShiftGrid dept={dept} days={days} buildDays={buildDays} types={types ?? []} shifts={shifts}
            people={people} myEmId={em?.id ?? null} canEdit={canEdit} canTake={!!em?.attending} back={back} />
          <p className="mt-2 text-xs text-stone-500">
            {canEdit ? "תא ריק = אין משמרת כזו ביום הזה; ״+״ פותח אותה. ״סגור״ מבטל את המשמרת ביום הזה." : "מקום פנוי — לחץ ״אני לוקח״. אפשר לבטל עד תחילת האירוע."}
          </p>
        </Card>

        {canEdit && (
          <Card title="סוגי המשמרת של המחלקה">
            <p className="mb-3 text-sm text-stone-500">שם וכמה אנשים — זה הכול. בלי שעות: כולם יודעים מתי ארוחת בוקר.</p>
            <ul className="mb-3 space-y-1.5">
              {(types ?? []).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-md bg-stone-50 px-2 py-1.5">
                  <form action={updateShiftType} className="flex flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={t.id} /><input type="hidden" name="back" value={back} />
                    <input name="name_he" defaultValue={t.name_he} className={`${inputCls} flex-1`} required />
                    <input name="slots_per_shift" type="number" min="1" defaultValue={t.slots_per_shift} className={`${inputCls} w-20`} title="כמה אנשים" />
                    <Btn variant="ghost" type="submit">שמור</Btn>
                  </form>
                  <form action={deleteShiftType}>
                    <input type="hidden" name="id" value={t.id} /><input type="hidden" name="back" value={back} />
                    <button className="px-1 text-xs text-stone-400 hover:text-red-600" title="מוחק גם את המשמרות שנפתחו מהסוג הזה">מחק</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={createShiftType} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="department_id" value={dept.id} /><input type="hidden" name="back" value={back} />
              <input name="name_he" placeholder="למשל: ארוחת בוקר" className={`${inputCls} flex-1`} required />
              <input name="slots_per_shift" type="number" min="1" defaultValue="2" className={`${inputCls} w-20`} title="כמה אנשים" />
              <input name="description_he" placeholder="תיאור קצר (לא חובה)" className={`${inputCls} flex-1`} />
              <Btn type="submit">+ סוג משמרת</Btn>
            </form>
          </Card>
        )}

        {me.role === "admin" && (
          <Card title="חלוקה הוגנת — לתכנון שלך בלבד">
            <p className="mb-3 text-sm text-stone-500">החברים לא רואים מונים; זה המספר שעוזר לך לפזר את המשמרות.</p>
            <form action={setShiftSettings} className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">זיכוי למתנדב הפקה
                <input name="volunteer_shift_credit" type="number" min="0" defaultValue={ev?.volunteer_shift_credit ?? 1} className={`${inputCls} w-20`} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="volunteers_count_in_total" defaultChecked={!!ev?.volunteers_count_in_total} />
                הזיכויים נספרים גם במאגר
              </label>
              <Btn type="submit">שמור</Btn>
            </form>
          </Card>
        )}
      </main>
    </>
  );
}
