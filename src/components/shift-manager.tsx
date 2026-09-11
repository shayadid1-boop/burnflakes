import { createClient } from "@/lib/supabase/server";
import { Btn, inputCls } from "@/components/ui";
import { money } from "@/lib/format";
import { createShiftRole, deleteShiftRole, openShifts, deleteShift, assignShift, deleteDayShifts } from "@/app/shift-actions";

/** Department lead tools: shift roles, opening shifts by day, assigning people. */
export async function ShiftManager({ eventId, departmentId, people, back }: { eventId: string; departmentId: string; people: { id: string; name: string }[]; back: string }) {
  const supabase = await createClient();
  const [{ data: roles }, { data: shifts }, { data: ev }] = await Promise.all([
    supabase.from("shift_roles").select("id, name_he, description_he, slots_per_shift, starts_at, ends_at, budget_amount").eq("event_id", eventId).eq("department_id", departmentId).order("name_he"),
    supabase.from("shifts").select("id, day, title_he, slots, starts_at, ends_at, shift_roles(name_he), shift_assignments(event_member_id)").eq("event_id", eventId).eq("department_id", departmentId).order("day").order("starts_at"),
    supabase.from("events").select("starts_on, ends_on").eq("id", eventId).maybeSingle(),
  ]);
  // every day of the event (build days + event days) as checkboxes
  const eventDays: string[] = [];
  if (ev?.starts_on && ev?.ends_on) {
    for (let d = new Date(ev.starts_on + "T00:00:00Z"); d.toISOString().slice(0, 10) <= ev.ends_on; d.setUTCDate(d.getUTCDate() + 1)) eventDays.push(d.toISOString().slice(0, 10));
  }
  const dayLabel = (iso: string) => { const [y, m, d] = iso.split("-"); void y; return `${d}.${m}`; };
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="mb-1 font-semibold">תפקידי משמרת</h3>
        <ul className="space-y-1">
          {(roles ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md bg-stone-50 px-2 py-1">
              <span><b>{r.name_he}</b> · {r.slots_per_shift} מקומות {r.starts_at && `· ${r.starts_at.slice(0, 5)}–${r.ends_at?.slice(0, 5)}`} {r.budget_amount && `· ${money(r.budget_amount)} למשמרת`}<span className="text-xs text-stone-500"> {r.description_he}</span></span>
              <form action={deleteShiftRole}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><button className="text-xs text-stone-400 hover:text-red-600">מחק</button></form>
            </li>
          ))}
        </ul>
        <form action={createShiftRole} className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
          <input type="hidden" name="department_id" value={departmentId} /><input type="hidden" name="back" value={back} />
          <input name="name_he" placeholder="תפקיד (צוות ארוחת ערב)" className={`${inputCls} col-span-2`} required />
          <input name="slots_per_shift" type="number" min="1" defaultValue="1" placeholder="מקומות" className={inputCls} />
          <input name="starts_at" type="time" className={inputCls} /><input name="ends_at" type="time" className={inputCls} />
          <input name="budget_amount" type="number" step="1" placeholder="תקציב ₪" className={inputCls} />
          <input name="description_he" placeholder="תיאור קצר" className={`${inputCls} col-span-2 md:col-span-5`} />
          <Btn variant="ghost" type="submit">+ תפקיד</Btn>
        </form>
      </div>

      <div>
        <h3 className="mb-1 font-semibold">פתיחת משמרות</h3>
        <form action={openShifts} className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <input type="hidden" name="department_id" value={departmentId} /><input type="hidden" name="back" value={back} />
          <select name="shift_role_id" className={`${inputCls} col-span-2`} defaultValue="">
            <option value="">חד‑פעמית (כתוב כותרת)</option>
            {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name_he}</option>)}
          </select>
          <input name="title_he" placeholder="כותרת (למשל: העמסת המשאית)" className={`${inputCls} col-span-2`} />
          <input name="slots" type="number" min="1" placeholder="מקומות" className={inputCls} />
          {eventDays.length > 0 ? (
            <div className="col-span-2 flex flex-wrap gap-2 md:col-span-3">
              {eventDays.map((d) => <label key={d} className="flex items-center gap-1 text-xs"><input type="checkbox" name="days" value={d} />{dayLabel(d)}</label>)}
            </div>
          ) : (
            <input name="days" placeholder="תאריכים: 2026-11-02, 2026-11-03" dir="ltr" className={`${inputCls} col-span-2 md:col-span-3`} required />
          )}
          <input name="starts_at" type="time" className={inputCls} /><input name="ends_at" type="time" className={inputCls} />
          <input name="time_slots" placeholder="כמה משמרות ביום? שעות מופרדות בפסיק: 08:00-10:00, 13:00-15:00, 19:00-21:00" dir="ltr" className={`${inputCls} col-span-2 md:col-span-5`} />
          <Btn variant="ghost" type="submit">פתח</Btn>
        </form>
        <p className="mt-1 text-xs text-stone-500">בלי שעות בשדה האחרון — נפתחת משמרת אחת ביום לפי שעות התפקיד. עם שעות — משמרת לכל טווח שעות בכל יום שסומן.</p>
      </div>

      <div>
        <h3 className="mb-1 font-semibold">משמרות המחלקה ושיבוץ</h3>
        <table className="w-full">
          <tbody>
            {(shifts ?? []).map((s, i, arr) => {
              const role = s.shift_roles as unknown as { name_he: string } | null;
              const firstOfDay = i === 0 || arr[i - 1].day !== s.day;
              const assigned = (s.shift_assignments as { event_member_id: string }[]).map((a) => a.event_member_id);
              return (
                <tr key={s.id} className="border-t border-stone-100 align-top">
                  <td className="p-2 whitespace-nowrap">{firstOfDay ? <b>{dayLabel(s.day)}</b> : <span className="text-stone-400">{dayLabel(s.day)}</span>}<br /><span className="text-xs text-stone-500">{s.starts_at ? `${s.starts_at.slice(0, 5)}–${s.ends_at?.slice(0, 5) ?? ""}` : ""}</span>
                    {firstOfDay && <form action={deleteDayShifts} className="mt-1"><input type="hidden" name="department_id" value={departmentId} /><input type="hidden" name="day" value={s.day} /><input type="hidden" name="back" value={back} /><button className="text-xs text-stone-400 hover:text-red-600">מחק את כל היום</button></form>}</td>
                  <td className="p-2">{s.title_he ?? role?.name_he} <span className="text-xs text-stone-500">{assigned.length}/{s.slots}</span></td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {assigned.map((id) => (
                        <form key={id} action={assignShift}><input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="event_member_id" value={id} /><input type="hidden" name="remove" value="1" /><input type="hidden" name="back" value={back} /><button className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">{nameOf.get(id) ?? "?"} ×</button></form>
                      ))}
                      {assigned.length < s.slots && (
                        <form action={assignShift} className="flex gap-1"><input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="back" value={back} />
                          <select name="event_member_id" className={`${inputCls} py-0.5 text-xs`}>{people.filter((p) => !assigned.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                          <button className="text-xs text-orange-700">שבץ</button>
                        </form>
                      )}
                    </div>
                  </td>
                  <td className="p-2"><form action={deleteShift}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={back} /><button className="text-xs text-stone-400 hover:text-red-600">מחק</button></form></td>
                </tr>
              );
            })}
            {(shifts ?? []).length === 0 && <tr><td className="p-2 text-stone-400">אין משמרות עדיין</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
