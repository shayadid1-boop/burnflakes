import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";

/** The Excel template for importing inventory — Hebrew headers, two example rows. */
export async function GET() {
  await requireMember();
  const wb = XLSX.utils.book_new();
  const rows = [
    { "פריט": "רשת צל 6×8", "קטגוריה": "הצללה", "כמות": 2, "יחידה": "יח׳", "מיקום": "מכולה — מדף עליון", "מצב": "תקין", "הערות": "" },
    { "פריט": "סיר 50 ליטר", "קטגוריה": "מטבח", "כמות": 1, "יחידה": "יח׳", "מיקום": "ארגז מטבח 2", "מצב": "דורש תיקון", "הערות": "ידית רופפת" },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "מלאי");
  const help = XLSX.utils.aoa_to_sheet([["עמודות: פריט (חובה, ייחודי) · קטגוריה · כמות · יחידה · מיקום · מצב (תקין / דורש תיקון / לזרוק) · הערות"], ["שורה עם שם פריט קיים מעדכנת אותו; שם חדש מוסיף פריט."]]);
  XLSX.utils.book_append_sheet(wb, help, "הסבר");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="burnflakes-inventory-template.xlsx"` } });
}
