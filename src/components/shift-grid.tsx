import { toggleShiftDay, assignShift, registerShift, unregisterShift } from "@/app/shift-actions";

export type GridDept = { id: string; slug: string; name_he: string };
export type GridType = { id: string; name_he: string; description_he: string | null; slots_per_shift: number };
export type GridShift = { id: string; day: string; shift_role_id: string | null; slots: number; people: { emId: string; name: string }[] };

const DAY_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export function dayHead(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return { dow: DAY_HE[d.getDay()], date: `${d.getDate()}.${d.getMonth() + 1}` };
}

/**
 * The board: shift types down the side, event days across the top, people in the cells.
 * Same grid for everyone — a lead/admin also gets the buttons that open, close, assign and remove.
 */
export function ShiftGrid({ dept, days, buildDays, types, shifts, people, myEmId, canEdit, canTake, back, print = false }: {
  dept: GridDept; days: string[]; buildDays: string[]; types: GridType[]; shifts: GridShift[];
  people: { id: string; name: string; remaining: number }[]; myEmId: string | null;
  canEdit: boolean; canTake: boolean; back: string; print?: boolean;
}) {
  const at = (typeId: string, day: string) => shifts.find((s) => s.shift_role_id === typeId && s.day === day);
  const sorted = [...people].sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name, "he"));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            <th className="sticky start-0 z-10 border border-stone-200 bg-stone-100 p-2 text-start text-xs font-bold text-stone-600">סוג המשמרת</th>
            {days.map((d) => {
              const { dow, date } = dayHead(d);
              const build = buildDays.includes(d);
              return (
                <th key={d} className={`border border-stone-200 p-2 text-center text-xs font-bold ${print ? "text-stone-900" : build ? "bg-stone-200 text-stone-600" : "bg-stone-100 text-stone-700"}`}>
                  {dow} {date}
                  {build && <span className="block text-[10px] font-normal text-stone-500">הקמה</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id}>
              <th className="sticky start-0 z-10 border border-stone-200 bg-stone-50 p-2 text-start align-top text-sm">
                <span className="font-bold">{t.name_he}</span>
                <span className="block text-xs font-normal text-stone-500">{t.slots_per_shift} אנשים{t.description_he ? ` · ${t.description_he}` : ""}</span>
              </th>
              {days.map((d) => {
                const s = at(t.id, d);
                if (!s) {
                  return (
                    <td key={d} className="border border-stone-200 bg-stone-50/60 p-1 text-center align-top">
                      {canEdit && !print && (
                        <form action={toggleShiftDay}>
                          <input type="hidden" name="shift_role_id" value={t.id} /><input type="hidden" name="day" value={d} />
                          <input type="hidden" name="department_id" value={dept.id} /><input type="hidden" name="back" value={back} />
                          <button className="w-full rounded-md border border-dashed border-stone-300 px-1 py-2 text-xs text-stone-400 hover:border-stone-500 hover:text-stone-700" title="פתח משמרת ביום הזה">+</button>
                        </form>
                      )}
                    </td>
                  );
                }
                const full = s.people.length >= s.slots;
                const mine = myEmId ? s.people.some((p) => p.emId === myEmId) : false;
                return (
                  <td key={d} className={`border border-stone-200 p-1.5 align-top text-sm ${mine ? "bg-orange-50" : "bg-white"}`}>
                    {s.people.map((p) => (
                      <span key={p.emId} className="flex items-center justify-between gap-1 border-b border-dotted border-stone-200 py-0.5 last:border-b-0">
                        <span className={p.emId === myEmId ? "font-bold" : ""}>{p.name}</span>
                        {canEdit && !print && (
                          <form action={assignShift}>
                            <input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="event_member_id" value={p.emId} />
                            <input type="hidden" name="remove" value="1" /><input type="hidden" name="back" value={back} />
                            <button className="text-xs text-stone-300 hover:text-red-600" title="הסר">×</button>
                          </form>
                        )}
                      </span>
                    ))}
                    {!print && !full && canEdit && (
                      <form action={assignShift} className="mt-1 flex gap-1">
                        <input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="back" value={back} />
                        <select name="event_member_id" defaultValue="" className="w-full rounded border border-stone-200 bg-white px-1 py-0.5 text-xs">
                          <option value="">מי לוקח?</option>
                          {sorted.filter((p) => !s.people.some((x) => x.emId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button className="rounded bg-stone-100 px-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200" title="הוסף">↵</button>
                      </form>
                    )}
                    {!print && !canEdit && canTake && myEmId && (mine ? (
                      <form action={unregisterShift} className="mt-1">
                        <input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="back" value={back} />
                        <button className="w-full rounded-md border border-stone-300 bg-white py-0.5 text-xs font-bold">בטל</button>
                      </form>
                    ) : !full ? (
                      <form action={registerShift} className="mt-1">
                        <input type="hidden" name="shift_id" value={s.id} /><input type="hidden" name="back" value={back} />
                        <button className="btn-brand w-full rounded-md py-0.5 text-xs">אני לוקח</button>
                      </form>
                    ) : null)}
                    {!print && !full && <span className="mt-0.5 block text-[11px] text-stone-400">{s.people.length}/{s.slots}</span>}
                    {canEdit && !print && (
                      <form action={toggleShiftDay} className="mt-0.5">
                        <input type="hidden" name="shift_role_id" value={t.id} /><input type="hidden" name="day" value={d} />
                        <input type="hidden" name="department_id" value={dept.id} /><input type="hidden" name="back" value={back} />
                        <input type="hidden" name="confirm" value="1" />
                        <button className="text-[11px] text-stone-300 hover:text-red-600" title="סגור את המשמרת ביום הזה">סגור</button>
                      </form>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {types.length === 0 && (
            <tr><td colSpan={days.length + 1} className="border border-stone-200 p-4 text-center text-sm text-stone-500">אין עדיין סוגי משמרת במחלקה הזו.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
