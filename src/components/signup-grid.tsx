import { createClient } from "@/lib/supabase/server";
import { registerShift, unregisterShift } from "@/app/shift-actions";
import { dayHead } from "@/components/shift-grid";

type Row = {
  id: string; day: string; slots: number; department_id: string; shift_role_id: string | null;
  departments: { slug: string; name_he: string; sort_order: number } | null;
  shift_roles: { name_he: string; description_he: string | null } | null;
  shift_assignments: { event_member_id: string; event_members: { members: { first_name: string; last_name: string | null } | null } | null }[];
};

/**
 * The sign-up table: every shift in the camp at once — shift types (with their department) down the
 * side, the event days across the top. A member reads a column for the day they want and takes a cell.
 */
export async function SignupGrid({ eventId, myEmId, canTake, days, buildDays, back }: {
  eventId: string; myEmId: string | null; canTake: boolean; days: string[]; buildDays: string[]; back: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase.from("shifts")
    .select("id, day, slots, department_id, shift_role_id, departments(slug, name_he, sort_order), shift_roles(name_he, description_he), shift_assignments(event_member_id, event_members(members(first_name, last_name)))")
    .eq("event_id", eventId);
  const rows = (data ?? []) as unknown as Row[];

  if (rows.length === 0) {
    return <p className="text-sm text-stone-500">עדיין לא נפתחו משמרות. ראשי המחלקות פותחים אותן בלוח לפי מחלקה.</p>;
  }

  // one line per (department, shift type), ordered like the departments menu
  const lines = new Map<string, { key: string; dept: string; deptOrder: number; name: string; desc: string | null }>();
  for (const r of rows) {
    const key = `${r.department_id}|${r.shift_role_id ?? "x"}`;
    if (!lines.has(key)) lines.set(key, {
      key, dept: r.departments?.name_he ?? "", deptOrder: r.departments?.sort_order ?? 999,
      name: r.shift_roles?.name_he ?? "משמרת", desc: r.shift_roles?.description_he ?? null,
    });
  }
  const ordered = [...lines.values()].sort((a, b) => a.deptOrder - b.deptOrder || a.name.localeCompare(b.name, "he"));
  const at = (key: string, day: string) => rows.find((r) => `${r.department_id}|${r.shift_role_id ?? "x"}` === key && r.day === day);
  const peopleOf = (r: Row) => r.shift_assignments.map((a) => ({
    emId: a.event_member_id,
    name: `${a.event_members?.members?.first_name ?? ""} ${a.event_members?.members?.last_name ?? ""}`.trim(),
  })).filter((p) => p.name);

  const openCount = rows.filter((r) => r.shift_assignments.length < r.slots).length;
  const mineCount = myEmId ? rows.filter((r) => r.shift_assignments.some((a) => a.event_member_id === myEmId)).length : 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-stone-500">{openCount} משמרות עוד מחכות לאנשים</span>
        {mineCount > 0 && <span className="font-bold text-orange-800">לקחת {mineCount} משמרות</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              <th className="sticky start-0 z-10 border border-stone-200 bg-stone-100 p-2 text-start text-xs font-bold text-stone-600">המשמרת</th>
              {days.map((d) => {
                const { dow, date } = dayHead(d);
                const build = buildDays.includes(d);
                return (
                  <th key={d} className={`border border-stone-200 p-2 text-center text-xs font-bold ${build ? "bg-stone-200 text-stone-600" : "bg-stone-100 text-stone-700"}`}>
                    {dow} {date}
                    {build && <span className="block text-[10px] font-normal text-stone-500">הקמה</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordered.map((ln) => (
              <tr key={ln.key}>
                <th className="sticky start-0 z-10 border border-stone-200 bg-stone-50 p-2 text-start align-top text-sm">
                  <span className="font-bold">{ln.name}</span>
                  <span className="block text-xs font-normal text-stone-500">{ln.dept}{ln.desc ? ` · ${ln.desc}` : ""}</span>
                </th>
                {days.map((d) => {
                  const s = at(ln.key, d);
                  if (!s) return <td key={d} className="border border-stone-200 bg-stone-50/60 p-1" />;
                  const people = peopleOf(s);
                  const mine = !!myEmId && s.shift_assignments.some((a) => a.event_member_id === myEmId);
                  const full = s.shift_assignments.length >= s.slots;
                  return (
                    <td key={d} className={`border border-stone-200 p-1.5 text-center align-top text-xs ${mine ? "bg-orange-50" : full ? "bg-stone-50" : "bg-white"}`}>
                      {people.length > 0 && (
                        <span className="mb-1 block leading-tight text-stone-600">
                          {people.map((p) => <span key={p.emId} className={`block ${p.emId === myEmId ? "font-bold" : ""}`}>{p.name}</span>)}
                        </span>
                      )}
                      {mine ? (
                        <form action={unregisterShift}>
                          <input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="back" value={back} />
                          <button className="w-full rounded-md border border-stone-300 bg-white py-0.5 text-[11px] font-bold">בטל</button>
                        </form>
                      ) : full ? (
                        <span className="text-[11px] text-stone-400">מלא</span>
                      ) : canTake ? (
                        <form action={registerShift}>
                          <input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="back" value={back} />
                          <button className="btn-brand w-full rounded-md py-1 text-[11px]">אני לוקח</button>
                          <span className="mt-0.5 block text-[10px] text-stone-400">{s.shift_assignments.length}/{s.slots}</span>
                        </form>
                      ) : (
                        <span className="text-[11px] text-stone-400">{s.shift_assignments.length}/{s.slots}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">תא ריק = אין משמרת כזו ביום הזה. לחיצה על ״אני לוקח״ רושמת אותך; אפשר לבטל עד תחילת האירוע.</p>
    </div>
  );
}
