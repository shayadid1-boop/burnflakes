import { Card, Btn, Pill, inputCls } from "@/components/ui";
import { money } from "@/lib/format";
import { setShoppingShifts, updateShoppingItem, addShoppingItem, deleteShoppingItem } from "@/app/shopping-actions";

export type ShoppingItem = {
  id: string; name_he: string; unit_he: string; per_shift: number; in_stock: number;
  unit_price: number; budget_line: string | null; notes_he: string | null;
};

const small = `${inputCls} w-20 px-1.5 py-1 text-center`;

/**
 * The department's shopping list: how much one shift uses × how many shifts, minus what is already in
 * the store. Every item is paid from one of the department's budget lines, so the list is checked
 * against the approved budget before anyone goes shopping.
 */
export function ShoppingList({ deptId, back, items, shifts, lines }: {
  deptId: string; back: string; items: ShoppingItem[]; shifts: number;
  lines: { name_he: string; planned_amount: number }[];
}) {
  const rows = items.map((it) => {
    const need = Math.ceil(Number(it.per_shift) * shifts);
    const buy = Math.max(0, need - Number(it.in_stock));
    return { ...it, need, buy, cost: buy * Number(it.unit_price) };
  });
  const total = rows.reduce((s, r) => s + r.cost, 0);

  // one check per budget line the list draws on
  const byLine = new Map<string, number>();
  for (const r of rows) if (r.budget_line) byLine.set(r.budget_line, (byLine.get(r.budget_line) ?? 0) + r.cost);
  const checks = Array.from(byLine.entries()).map(([name, cost]) => {
    const planned = Number(lines.find((l) => l.name_he === name)?.planned_amount ?? 0);
    return { name, cost, planned, over: cost > planned };
  });

  return (
    <Card title="רשימת קניות">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          כמה לקנות מחושב לבד: <b>כמה נגמר במשמרת אחת</b> (לפי מה שנספר בשנה שעברה) × <b>מספר המשמרות</b>, פחות <b>מה שכבר יש במחסן</b>.
          אפשר לתקן כל מספר בטבלה — והרשימה מתעדכנת.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <form action={setShoppingShifts} className="flex items-end gap-2">
            <input type="hidden" name="department_id" value={deptId} />
            <input type="hidden" name="back" value={back} />
            <label className="text-sm font-bold">
              כמה משמרות יהיו השנה?
              <input name="shift_count" type="number" min={0} max={30} defaultValue={shifts} className={`${inputCls} mr-2 w-20 text-center text-base font-bold`} />
            </label>
            <Btn type="submit" variant="ghost">חשב מחדש</Btn>
          </form>
          <div className="flex flex-wrap gap-2">
            {checks.map((c) => (
              <div key={c.name} className={`rounded-lg px-3 py-2 text-sm ${c.over ? "bg-red-50" : "bg-green-50"}`}>
                <b>{c.name}:</b> {money(c.cost)} מתוך {money(c.planned)}{" "}
                {c.over ? <Pill tone="bad">חריגה של {money(c.cost - c.planned)}</Pill> : <Pill tone="good">נשאר {money(c.planned - c.cost)}</Pill>}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right">
                <th className="p-2">מוצר</th><th className="p-2">למשמרת</th><th className="p-2">צריך</th>
                <th className="p-2">במחסן</th><th className="p-2">לקנות</th><th className="p-2">מחיר ליח׳</th>
                <th className="p-2">עלות</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fid = `shop-${r.id}`;
                return (
                  <tr key={r.id}>
                    <td className="p-2">
                      <div className="font-bold">{r.name_he}</div>
                      <div className="text-xs text-stone-500">{r.unit_he}{r.budget_line ? ` · ${r.budget_line}` : ""}{r.notes_he ? ` · ${r.notes_he}` : ""}</div>
                    </td>
                    <td className="p-2"><input form={fid} name="per_shift" type="number" step="0.5" min={0} defaultValue={Number(r.per_shift)} className={small} aria-label={`${r.name_he} — כמה למשמרת`} /></td>
                    <td className="p-2 text-stone-600">{r.need}</td>
                    <td className="p-2"><input form={fid} name="in_stock" type="number" step="1" min={0} defaultValue={Number(r.in_stock)} className={small} aria-label={`${r.name_he} — כמה במחסן`} /></td>
                    <td className="p-2 text-base font-bold">{r.buy}</td>
                    <td className="p-2"><input form={fid} name="unit_price" type="number" step="0.1" min={0} defaultValue={Number(r.unit_price)} className={small} aria-label={`${r.name_he} — מחיר`} /></td>
                    <td className="p-2 font-bold">{money(r.cost)}</td>
                    <td className="p-2 whitespace-nowrap">
                      <form id={fid} action={updateShoppingItem} className="inline">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                        <button className="text-xs font-bold text-orange-700 hover:underline">שמור</button>
                      </form>
                      <form action={deleteShoppingItem} className="mr-3 inline">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                        <button className="text-xs text-stone-400 hover:underline">הסר</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="p-2 font-bold" colSpan={6}>סה״כ לקנות</td>
                <td className="p-2 text-base font-bold">{money(total)}</td><td />
              </tr>
            </tbody>
          </table>
        </div>

        <details className="rounded-lg border border-stone-200 p-3">
          <summary className="cursor-pointer text-sm font-bold">+ הוספת מוצר לרשימה</summary>
          <form action={addShoppingItem} className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="department_id" value={deptId} /><input type="hidden" name="back" value={back} />
            <label className="flex flex-col gap-1">שם<input name="name_he" required className={inputCls} placeholder="למשל: פתיתי שוקולד" /></label>
            <label className="flex flex-col gap-1">יחידה<input name="unit_he" className={`${inputCls} w-24`} placeholder="קופסה" /></label>
            <label className="flex flex-col gap-1">למשמרת<input name="per_shift" type="number" step="0.5" min={0} className={small} /></label>
            <label className="flex flex-col gap-1">במחסן<input name="in_stock" type="number" min={0} className={small} /></label>
            <label className="flex flex-col gap-1">מחיר<input name="unit_price" type="number" step="0.1" min={0} className={small} /></label>
            <label className="flex flex-col gap-1">משורת תקציב
              <select name="budget_line" className={inputCls}>
                <option value="">—</option>
                {lines.map((l) => <option key={l.name_he} value={l.name_he}>{l.name_he}</option>)}
              </select>
            </label>
            <Btn type="submit">הוסף</Btn>
          </form>
        </details>

        <p className="text-xs text-stone-500">
          לפני שהולכים לקנות — לספור מה באמת יש במחסן ולבדוק תוקף. בסוף האירוע: לעדכן כאן ובמסך המחסן מה נשאר, כדי שבשנה הבאה לא יקנו שוב.
        </p>
      </div>
    </Card>
  );
}
