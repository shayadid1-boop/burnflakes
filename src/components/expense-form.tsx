import { logExpense } from "@/app/money-actions";
import { inputCls, Btn } from "@/components/ui";

type Dept = { id: string; name_he: string };
type Line = { id: string; name_he: string; department_id: string };
type Person = { id: string; name: string };

/** Mobile-first expense entry. Members: own pocket, pending. Leads/admin: may choose payer, source and approve directly. */
export function ExpenseForm({ departments, lines = [], people = [], lead = false, fixedDepartment, back = "/me" }:
  { departments: Dept[]; lines?: Line[]; people?: Person[]; lead?: boolean; fixedDepartment?: Dept; back?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={logExpense} className="space-y-3 text-sm">
      <input type="hidden" name="back" value={back} />
      {fixedDepartment ? (
        <input type="hidden" name="department_id" value={fixedDepartment.id} />
      ) : (
        <label className="block space-y-1"><span className="text-stone-600">מחלקה</span>
          <select name="department_id" className={`${inputCls} w-full`} required>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name_he}</option>)}
          </select>
        </label>
      )}
      <label className="block space-y-1"><span className="text-stone-600">מה קנית</span>
        <input name="description" className={`${inputCls} w-full`} placeholder="למשל: 6 שקי קרח" required autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1"><span className="text-stone-600">כמה (₪)</span>
          <input name="amount" type="number" step="0.01" min="0" inputMode="decimal" className={`${inputCls} w-full`} required />
        </label>
        <label className="block space-y-1"><span className="text-stone-600">תאריך</span>
          <input name="expense_date" type="date" defaultValue={today} className={`${inputCls} w-full`} />
        </label>
      </div>
      {lines.length > 0 && (
        <label className="block space-y-1"><span className="text-stone-600">סעיף בתקציב</span>
          <select name="budget_line_id" className={`${inputCls} w-full`} defaultValue="">
            <option value="">לא מתוכנן / לא יודע</option>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name_he}</option>)}
          </select>
        </label>
      )}
      {lead && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1"><span className="text-stone-600">מי שילם</span>
            <select name="paid_by_event_member_id" className={`${inputCls} w-full`} defaultValue="">
              <option value="">אני</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1"><span className="text-stone-600">מאיפה</span>
            <select name="paid_from" className={`${inputCls} w-full`} defaultValue="member_pocket">
              <option value="member_pocket">מהכיס (להחזר)</option>
              <option value="camp_account">מקופת הקמפ</option>
              <option value="advance">מקדמה שקיבל</option>
            </select>
          </label>
          <label className="block space-y-1"><span className="text-stone-600">מצב</span>
            <select name="status" className={`${inputCls} w-full`} defaultValue="approved">
              <option value="approved">מאושר</option>
              <option value="pending">ממתין לאישור</option>
            </select>
          </label>
        </div>
      )}
      <label className="flex items-center gap-2"><input type="checkbox" name="has_receipt" /> יש קבלה (שולחים צילום לגזבר בוואטסאפ)</label>
      <input name="notes" className={`${inputCls} w-full`} placeholder="הערה (לא חובה)" />
      <Btn type="submit" className="w-full py-2.5">רשום הוצאה</Btn>
    </form>
  );
}
