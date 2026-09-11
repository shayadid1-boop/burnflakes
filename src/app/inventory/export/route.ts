import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const COND: Record<string, string> = { ok: "תקין", repair: "דורש תיקון", discard: "לזרוק" };

/** The whole inventory as Excel, in the template's columns (so it can be edited and re-imported). */
export async function GET() {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from("inventory_items").select("name_he, category, quantity, unit, location, condition, notes, updated_at").order("category").order("name_he");
  const rows = (data ?? []).map((r) => ({ "פריט": r.name_he, "קטגוריה": r.category ?? "", "כמות": Number(r.quantity), "יחידה": r.unit, "מיקום": r.location ?? "", "מצב": COND[r.condition] ?? r.condition, "הערות": r.notes ?? "", "עודכן": r.updated_at?.slice(0, 10) }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "פריט": "" }]);
  ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 30 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "מלאי");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="burnflakes-inventory-${date}.xlsx"` } });
}
