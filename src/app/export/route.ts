import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

// one sheet per table — admin only; used as the weekly backup
const TABLES = [
  "events", "departments", "members", "event_members", "department_leads", "vendors",
  "scenario_parameters", "scenario_parameter_options", "cost_items", "cost_item_option_overrides",
  "scenarios", "scenario_parameter_values", "scenario_line_items", "scenario_income_lines",
  "budget_lines", "budget_income_lines", "expenses", "funds", "fee_rules", "member_charge_overrides",
  "payments", "payouts", "incomes", "shift_roles", "shifts", "shift_assignments",
];
const VIEWS = ["v_scenario_summary", "v_department_budget_vs_actual", "v_event_balance", "v_shift_board"];

export async function GET() {
  const me = await requireMember();
  if (me.role !== "admin") return new NextResponse("admin only", { status: 403 });
  const supabase = await createClient();
  const wb = XLSX.utils.book_new();

  const ledger = await supabase.rpc("ledger", { p_event: me.eventId });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ledger.data ?? []), "ledger");

  // all tables in parallel (sequential took ~8s)
  const results = await Promise.all([...VIEWS, ...TABLES].map(async (name) => ({ name, ...(await supabase.from(name).select("*").limit(10000)) })));
  for (const { name, data, error } of results) {
    if (error) continue;
    const rows = (data ?? []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ empty: true }]), name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="burnflakes-${date}.xlsx"`,
    },
  });
}
