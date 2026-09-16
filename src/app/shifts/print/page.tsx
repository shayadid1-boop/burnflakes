import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShiftGrid, type GridShift } from "@/components/shift-grid";

export const dynamic = "force-dynamic";

/** The sheet that gets hung in the container: one department, all days, names. Print or save as PDF from the browser. */
export default async function ShiftPrintPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const { dept: deptParam } = await searchParams;
  const me = await requireMember();
  const supabase = await createClient();
  if (!me.eventId) return <main className="p-6 text-sm">אין אירוע פעיל.</main>;

  const [{ data: allDepts }, { data: ev }] = await Promise.all([
    supabase.from("departments").select("id, slug, name_he, sort_order").eq("is_active", true).eq("kind", "internal").order("sort_order"),
    supabase.from("events").select("name, starts_on, ends_on, event_starts_on").eq("id", me.eventId).single(),
  ]);
  const depts = allDepts ?? [];
  const dept = depts.find((d) => d.slug === deptParam) ?? depts[0];
  if (!dept) return <main className="p-6 text-sm">אין מחלקות פעילות.</main>;

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

  const fmt = (iso?: string | null) => (iso ? `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}` : "");

  return (
    <main className="mx-auto w-full max-w-5xl bg-white p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-4 border-b-[3px] border-stone-800 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
        <img src="/logo.png" alt="ברנפלקס" className="w-20" />
        <div className="text-center">
          <h1 className="text-2xl">לוח משמרות · {dept.name_he}</h1>
          <p className="text-sm text-stone-500">{ev?.name} · {fmt(ev?.starts_on)}–{fmt(ev?.ends_on)}</p>
        </div>
        <span className="w-20" />
      </div>

      <ShiftGrid dept={dept} days={days} buildDays={buildDays} types={types ?? []} shifts={shifts}
        people={[]} myEmId={null} canEdit={false} canTake={false} back="" print />

      <div className="mt-3 flex justify-between text-[11px] text-stone-400">
        <span>הודפס {new Date().toLocaleDateString("he-IL")}</span>
        <span>ברנפלקס · לול התרנגולות</span>
      </div>

      <div className="mt-6 flex gap-3 print:hidden">
        {depts.map((d) => (
          <a key={d.slug} href={`/shifts/print?dept=${d.slug}`} className={`text-sm ${d.slug === dept.slug ? "font-bold text-stone-900" : "text-stone-500 hover:underline"}`}>{d.name_he}</a>
        ))}
        <a href={`/shifts?dept=${dept.slug}`} className="ms-auto text-sm text-orange-700 hover:underline">← חזרה ללוח</a>
      </div>
    </main>
  );
}
