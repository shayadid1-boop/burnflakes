import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Kpi, Btn, Pill, inputCls } from "@/components/ui";
import { num } from "@/lib/format";
import { addItem, updateItem, deleteItem, importItems } from "./actions";

const COND_HE: Record<string, string> = { ok: "תקין", repair: "דורש תיקון", discard: "לזרוק" };
const COND_TONE: Record<string, "good" | "warn" | "bad"> = { ok: "good", repair: "warn", discard: "bad" };

/** Warehouse: everything the camp owns in storage. Everyone searches; admin + department leads edit. */
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; edit?: string }> }) {
  const { q = "", cat = "", edit = "" } = await searchParams;
  const me = await requireMember();
  const supabase = await createClient();
  const [depts, { data: items }, { data: canEditRow }] = await Promise.all([
    me.eventId ? myDepartments(me.eventId) : Promise.resolve([]),
    supabase.from("inventory_items").select("*, members(first_name)").order("category", { nullsFirst: false }).order("name_he"),
    supabase.rpc("is_any_lead"),
  ]);
  const canEdit = canEditRow === true;
  const needle = q.trim().toLowerCase();
  const all = items ?? [];
  const cats = Array.from(new Set(all.map((i) => i.category).filter(Boolean) as string[])).sort();
  const list = all.filter((i) => (!cat || i.category === cat) && (!needle || `${i.name_he} ${i.category ?? ""} ${i.location ?? ""} ${i.notes ?? ""}`.toLowerCase().includes(needle)));
  const qs = (over: Record<string, string>) => { const p = new URLSearchParams({ q, cat, ...over }); for (const [k, v] of Array.from(p.entries())) if (!v) p.delete(k); const str = p.toString(); return `/inventory${str ? `?${str}` : ""}`; };

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1>מחסן</h1>
          <div className="flex gap-3 text-sm">
            <a href="/inventory/export" className="font-bold text-orange-700 hover:underline">⬇ ייצוא לאקסל</a>
            <a href="/inventory/template" className="text-stone-500 hover:underline">⬇ טמפלט לייבוא</a>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Kpi label="פריטים במחסן" value={num(all.length)} sub={`${num(cats.length)} קטגוריות`} />
          <Kpi label="דורשים תיקון" value={num(all.filter((i) => i.condition === "repair").length)} tone={all.some((i) => i.condition === "repair") ? "bad" : ""} />
          <Kpi label="לזרוק" value={num(all.filter((i) => i.condition === "discard").length)} />
          <Kpi label="תוצאות חיפוש" value={num(list.length)} tone="accent" sub={needle ? `"${q}"` : "כל המחסן"} />
        </div>

        <Card>
          <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
            <input name="q" defaultValue={q} placeholder="יש לנו…? חפש פריט, קטגוריה, מיקום" className={`${inputCls} w-72`} autoFocus />
            <select name="cat" defaultValue={cat} className={inputCls}>
              <option value="">כל הקטגוריות</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Btn variant="ghost" type="submit">חפש</Btn>
            {(q || cat) && <a href="/inventory" className="text-stone-500 underline">נקה</a>}
          </form>
          {needle && list.length === 0 && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">אין פריט כזה במחסן. {canEdit && "אפשר להוסיף אותו למטה."}</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-right">
                <th className="p-2 font-normal">פריט</th><th className="p-2 font-normal">קטגוריה</th><th className="p-2 font-normal">כמות</th><th className="p-2 font-normal">מיקום</th><th className="p-2 font-normal">מצב</th><th className="p-2 font-normal">הערות</th><th className="p-2 font-normal">עודכן</th>{canEdit && <th className="p-2" />}
              </tr></thead>
              <tbody>
                {list.map((i) => {
                  const by = (i.members as unknown as { first_name: string } | null)?.first_name;
                  if (canEdit && edit === i.id) return (
                    <tr key={i.id} className="bg-stone-50">
                      <td colSpan={8} className="p-2">
                        <form action={updateItem} className="grid grid-cols-2 gap-2 md:grid-cols-8">
                          <input type="hidden" name="id" value={i.id} />
                          <input name="name_he" defaultValue={i.name_he} className={`${inputCls} col-span-2`} required />
                          <input name="category" defaultValue={i.category ?? ""} placeholder="קטגוריה" list="cats" className={inputCls} />
                          <input name="quantity" type="number" step="any" defaultValue={String(i.quantity)} className={inputCls} />
                          <input name="unit" defaultValue={i.unit} className={inputCls} />
                          <input name="location" defaultValue={i.location ?? ""} placeholder="מיקום" className={inputCls} />
                          <select name="condition" defaultValue={i.condition} className={inputCls}>{Object.entries(COND_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                          <input name="notes" defaultValue={i.notes ?? ""} placeholder="הערות" className={`${inputCls} col-span-2 md:col-span-6`} />
                          <div className="col-span-2 flex gap-2"><Btn type="submit">שמור</Btn><a href={qs({})} className="self-center text-sm text-stone-500 underline">ביטול</a></div>
                        </form>
                      </td>
                    </tr>
                  );
                  return (
                    <tr key={i.id} className={i.condition === "discard" ? "text-stone-400" : ""}>
                      <td className="p-2 font-medium">{i.name_he}</td>
                      <td className="p-2 text-stone-500">{i.category}</td>
                      <td className="p-2 tabular-nums">{num(i.quantity)} <span className="text-xs text-stone-400">{i.unit}</span></td>
                      <td className="p-2 text-stone-500">{i.location}</td>
                      <td className="p-2"><Pill tone={COND_TONE[i.condition] ?? "muted"}>{COND_HE[i.condition] ?? i.condition}</Pill></td>
                      <td className="p-2 text-xs text-stone-500">{i.notes}</td>
                      <td className="p-2 text-xs text-stone-400 whitespace-nowrap">{i.updated_at?.slice(0, 10)}{by && ` · ${by}`}</td>
                      {canEdit && (
                        <td className="p-2 whitespace-nowrap">
                          <a href={qs({ edit: i.id })} className="text-xs text-orange-700 hover:underline">עריכה</a>
                          <form action={deleteItem} className="inline mr-2"><input type="hidden" name="id" value={i.id} /><button className="text-xs text-stone-400 hover:text-red-600">מחק</button></form>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {list.length === 0 && !needle && <tr><td colSpan={8} className="p-3 text-stone-400">המחסן ריק — הוסף פריטים למטה או ייבא מאקסל.</td></tr>}
              </tbody>
            </table>
          </div>
          <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </Card>

        {canEdit && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="פריט חדש" className="md:col-span-2">
              <form action={addItem} className="grid grid-cols-2 gap-2 text-sm md:grid-cols-6">
                <input name="name_he" placeholder="פריט (חובה)" className={`${inputCls} col-span-2`} required />
                <input name="category" placeholder="קטגוריה" list="cats" className={inputCls} />
                <input name="quantity" type="number" step="any" defaultValue="1" className={inputCls} />
                <input name="unit" defaultValue="יח׳" className={inputCls} />
                <select name="condition" defaultValue="ok" className={inputCls}>{Object.entries(COND_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input name="location" placeholder="מיקום (ארגז / מדף / מכולה)" className={`${inputCls} col-span-2`} />
                <input name="notes" placeholder="הערות" className={`${inputCls} col-span-2 md:col-span-3`} />
                <Btn type="submit">+ הוסף</Btn>
              </form>
              <p className="mt-2 text-xs text-stone-500">שם פריט שכבר קיים — מעדכן את הפריט הקיים במקום ליצור כפול.</p>
            </Card>
            <Card title="ייבוא מאקסל">
              <form action={importItems} className="space-y-2 text-sm">
                <input name="file" type="file" accept=".xlsx,.xls,.csv" required className="block w-full text-sm" />
                <Btn type="submit">ייבא</Btn>
                <p className="text-xs text-stone-500">לפי <a href="/inventory/template" className="underline">הטמפלט</a>: עמודות פריט · קטגוריה · כמות · יחידה · מיקום · מצב · הערות. שם קיים מתעדכן, שם חדש נוסף.</p>
              </form>
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
