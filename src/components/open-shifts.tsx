import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { registerShift, unregisterShift } from "@/app/shift-actions";
import { dayHead } from "@/components/shift-grid";

type Row = {
  id: string; day: string; slots: number;
  departments: { slug: string; name_he: string } | null;
  shift_roles: { name_he: string; description_he: string | null } | null;
  shift_assignments: { event_member_id: string; event_members: { members: { first_name: string; last_name: string | null } | null } | null }[];
};

/**
 * One screen with every open shift in the camp, whatever department opened it.
 * This is where members sign up: pick a day, see what still needs people, take it.
 */
export async function OpenShifts({ eventId, myEmId, canTake, day, deptSlug, back }: {
  eventId: string; myEmId: string | null; canTake: boolean; day?: string; deptSlug?: string; back: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase.from("shifts")
    .select("id, day, slots, departments(slug, name_he), shift_roles(name_he, description_he), shift_assignments(event_member_id, event_members(members(first_name, last_name)))")
    .eq("event_id", eventId).order("day");
  const rows = (data ?? []) as unknown as Row[];

  const nameOf = (r: Row) => r.shift_roles?.name_he ?? "משמרת";
  const peopleOf = (r: Row) => r.shift_assignments.map((a) => `${a.event_members?.members?.first_name ?? ""} ${a.event_members?.members?.last_name ?? ""}`.trim()).filter(Boolean);
  const isMine = (r: Row) => !!myEmId && r.shift_assignments.some((a) => a.event_member_id === myEmId);

  const mine = rows.filter(isMine).sort((a, b) => a.day.localeCompare(b.day));
  const open = rows.filter((r) => r.shift_assignments.length < r.slots && !isMine(r));

  const days = Array.from(new Set(open.map((r) => r.day))).sort();
  const depts = Array.from(new Map(open.map((r) => [r.departments?.slug ?? "", r.departments?.name_he ?? ""])).entries()).filter(([s]) => s);

  const shown = open.filter((r) => (!day || r.day === day) && (!deptSlug || r.departments?.slug === deptSlug));
  const byDay = days.filter((d) => !day || d === day).map((d) => [d, shown.filter((r) => r.day === d)] as const).filter(([, list]) => list.length > 0);

  const link = (patch: { day?: string | null; dept?: string | null }) => {
    const p = new URLSearchParams({ view: "open" });
    const nd = patch.day === undefined ? day : patch.day; const ndp = patch.dept === undefined ? deptSlug : patch.dept;
    if (nd) p.set("day", nd); if (ndp) p.set("dept", ndp);
    return `/shifts?${p.toString()}`;
  };
  const chip = (on: boolean) => `whitespace-nowrap rounded-full border px-3 py-1 text-sm ${on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100"}`;

  return (
    <div className="space-y-5">
      {mine.length > 0 && (
        <section className="panel">
          <h3 className="mb-2">המשמרות שלי</h3>
          <ul className="space-y-1.5">
            {mine.map((r) => {
              const { dow, date } = dayHead(r.day);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm">
                  <span className="font-bold">{dow} {date}</span>
                  <span>{nameOf(r)}</span>
                  <span className="pill muted">{r.departments?.name_he}</span>
                  <span className="text-xs text-stone-500">{peopleOf(r).join(", ")}</span>
                  {canTake && (
                    <form action={unregisterShift} className="ms-auto">
                      <input type="hidden" name="shift_id" value={r.id} /><input type="hidden" name="back" value={back} />
                      <button className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs font-bold">בטל</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3>משמרות פתוחות</h3>
          <span className="text-sm text-stone-500">{open.length} משמרות מחכות לאיוש</span>
        </div>

        {days.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            <Link href={link({ day: null })} className={chip(!day)}>כל הימים</Link>
            {days.map((d) => { const { dow, date } = dayHead(d); return <Link key={d} href={link({ day: d })} className={chip(day === d)}>{dow} {date}</Link>; })}
          </div>
        )}
        {depts.length > 1 && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <Link href={link({ dept: null })} className={chip(!deptSlug)}>כל המחלקות</Link>
            {depts.map(([slug, nm]) => <Link key={slug} href={link({ dept: slug })} className={chip(deptSlug === slug)}>{nm}</Link>)}
          </div>
        )}

        {byDay.length === 0 ? (
          <p className="text-sm text-stone-500">{open.length === 0 ? "כל המשמרות מאוישות 🙌" : "אין משמרות פתוחות בסינון הזה."}</p>
        ) : (
          <div className="space-y-4">
            {byDay.map(([d, list]) => {
              const { dow, date } = dayHead(d);
              return (
                <div key={d}>
                  <h4 className="mb-1.5 border-b-2 border-stone-300 pb-1 font-serif text-base font-bold">{dow} {date}</h4>
                  <ul className="space-y-1.5">
                    {list.map((r) => {
                      const left = r.slots - r.shift_assignments.length;
                      const taken = peopleOf(r);
                      return (
                        <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
                          <span className="font-bold">{nameOf(r)}</span>
                          <span className="pill muted">{r.departments?.name_he}</span>
                          <span className="text-xs text-stone-500">
                            {taken.length > 0 ? `${taken.join(", ")} · ` : ""}נשאר{left > 1 ? `ו ${left} מקומות` : " מקום אחד"}
                          </span>
                          {r.shift_roles?.description_he && <span className="w-full text-xs text-stone-400">{r.shift_roles.description_he}</span>}
                          {canTake ? (
                            <form action={registerShift} className="ms-auto">
                              <input type="hidden" name="shift_id" value={r.id} /><input type="hidden" name="back" value={back} />
                              <button className="btn-brand rounded-lg px-4 py-1.5 text-sm">אני לוקח</button>
                            </form>
                          ) : <span className="ms-auto text-xs text-stone-400">רק מי שמגיע יכול להירשם</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
