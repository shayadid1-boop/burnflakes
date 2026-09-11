import { registerShift, unregisterShift } from "@/app/shift-actions";
import { createClient } from "@/lib/supabase/server";

type Row = { id: string; day: string; title_he: string | null; slots: number; starts_at: string | null; ends_at: string | null;
  departments: { slug: string; name_he: string } | null; shift_roles: { name_he: string; description_he: string | null } | null;
  shift_assignments: { event_member_id: string; event_members: { members: { first_name: string; last_name: string | null } | null } | null }[] };

const DAY_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export function fmtDay(d: string) { const dt = new Date(d + "T00:00:00"); return `יום ${DAY_HE[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}`; }

/** The camp-wide shift board (or one department's, when departmentId is given). Attending members self-register. */
export async function ShiftBoard({ eventId, myEmId, departmentId, day, back, canRegister = true }: { eventId: string; myEmId: string | null; departmentId?: string; day?: string; back: string; canRegister?: boolean }) {
  const supabase = await createClient();
  let q = supabase.from("shifts")
    .select("id, day, title_he, slots, starts_at, ends_at, departments(slug, name_he), shift_roles(name_he, description_he), shift_assignments(event_member_id, event_members(members(first_name, last_name)))")
    .eq("event_id", eventId).order("day").order("starts_at");
  if (departmentId) q = q.eq("department_id", departmentId);
  if (day) q = q.eq("day", day);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const day_ = day;
  const days = Array.from(new Set(rows.map((r) => r.day)));
  if (rows.length === 0) return <p className="text-sm text-stone-500">{day ? "אין משמרות ביום הזה." : "עדיין לא נפתחו משמרות."}</p>;

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day}>
          {!day_ && <h3 className="mb-1 font-semibold">{fmtDay(day)}</h3>}
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {rows.filter((r) => r.day === day).map((r) => {
              const name = r.title_he ?? r.shift_roles?.name_he ?? "משמרת";
              const filled = r.shift_assignments.length;
              const mine = myEmId ? r.shift_assignments.some((a) => a.event_member_id === myEmId) : false;
              const full = filled >= r.slots;
              const people = r.shift_assignments.map((a) => `${a.event_members?.members?.first_name ?? ""} ${a.event_members?.members?.last_name ?? ""}`.trim()).join(", ");
              return (
                <div key={r.id} className={`rounded-lg border p-3 text-sm ${mine ? "border-orange-300 bg-orange-50" : full ? "border-stone-200 bg-stone-50" : "border-stone-200 bg-white"}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{name}{!departmentId && <span className="pill muted mr-1">{r.departments?.name_he}</span>}</span>
                    <span className="text-xs text-stone-500">{r.starts_at ? `${r.starts_at.slice(0, 5)}–${r.ends_at?.slice(0, 5) ?? ""}` : ""}</span>
                  </div>
                  {r.shift_roles?.description_he && <div className="text-xs text-stone-500">{r.shift_roles.description_he}</div>}
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`text-xs ${full ? "text-stone-500" : "text-green-700"}`}>{filled}/{r.slots} {people && `· ${people}`}</span>
                    {canRegister && myEmId && (mine ? (
                      <form action={unregisterShift}><input type="hidden" name="shift_id" value={r.id} /><input type="hidden" name="back" value={back} /><button className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-xs font-bold">בטל הרשמה</button></form>
                    ) : !full ? (
                      <form action={registerShift}><input type="hidden" name="shift_id" value={r.id} /><input type="hidden" name="back" value={back} /><button className="rounded-md bg-orange-600 px-2.5 py-0.5 text-xs font-bold text-white">הרשם</button></form>
                    ) : <span className="text-xs text-stone-400">מלא</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
