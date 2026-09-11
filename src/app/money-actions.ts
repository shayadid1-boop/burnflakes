"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Any attending member logs an expense he paid from his own pocket (status pending). Dept leads/admin may log for the department directly. */
export async function logExpense(formData: FormData) {
  const me = await requireMember();
  const supabase = await createClient();
  if (!me.eventId) throw new Error("no current event");
  const { data: em } = await supabase.from("event_members").select("id").eq("event_id", me.eventId).eq("member_id", me.memberId!).maybeSingle();
  if (!em) throw new Error("not registered to this event");
  const departmentId = String(formData.get("department_id"));
  const paidBy = String(formData.get("paid_by_event_member_id") || em.id);
  const status = String(formData.get("status") || "pending");
  const { error } = await supabase.from("expenses").insert({
    event_id: me.eventId,
    department_id: departmentId,
    description: String(formData.get("description")),
    amount: Number(formData.get("amount")),
    expense_date: String(formData.get("expense_date") || new Date().toISOString().slice(0, 10)),
    paid_by_event_member_id: paidBy,
    paid_from: String(formData.get("paid_from") || "member_pocket"),
    status,
    has_receipt: formData.get("has_receipt") === "on",
    budget_line_id: String(formData.get("budget_line_id") || "") || null,
    shift_id: String(formData.get("shift_id") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    created_by: em.id,
  });
  fail(error);
  const back = String(formData.get("back") || "/me");
  revalidatePath(back);
  revalidatePath("/me");
  redirect(back);
}

export async function setExpenseStatus(formData: FormData) {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").update({ status: String(formData.get("status")) }).eq("id", String(formData.get("id")));
  fail(error);
  const back = String(formData.get("back") || "/treasury");
  revalidatePath(back);
}

export async function deleteExpense(formData: FormData) {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", String(formData.get("id")));
  fail(error);
  const back = String(formData.get("back") || "/me");
  revalidatePath(back);
}

export async function recordPayment(formData: FormData) {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("admin only");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    event_id: me.eventId,
    fund_id: String(formData.get("fund_id")),
    event_member_id: String(formData.get("event_member_id")),
    amount: Number(formData.get("amount")),
    method: String(formData.get("method") || "paybox"),
    status: "confirmed",
    paid_at: String(formData.get("paid_at") || new Date().toISOString().slice(0, 10)),
    notes: String(formData.get("notes") || "") || null,
  });
  fail(error);
  revalidatePath("/treasury");
}

export async function recordPayout(formData: FormData) {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("admin only");
  const supabase = await createClient();
  const { error } = await supabase.from("payouts").insert({
    event_id: me.eventId,
    event_member_id: String(formData.get("event_member_id")),
    amount: Number(formData.get("amount")),
    method: String(formData.get("method") || "bit"),
    status: "confirmed",
    paid_at: new Date().toISOString().slice(0, 10),
    notes: String(formData.get("notes") || "החזר") || null,
  });
  fail(error);
  revalidatePath("/treasury");
}

export async function recordIncome(formData: FormData) {
  const me = await requireMember();
  const supabase = await createClient();
  if (!me.eventId) throw new Error("no current event");
  const fundKind = String(formData.get("fund_kind") || "fundraiser");
  const { data: fundId, error: fundErr } = await supabase.rpc("ensure_fund", { p_event: me.eventId, p_kind: fundKind });
  fail(fundErr);
  const { error } = await supabase.from("incomes").insert({
    event_id: me.eventId,
    fund_id: fundId,
    department_id: String(formData.get("department_id") || "") || null,
    source_name: String(formData.get("source_name")),
    amount: Number(formData.get("amount")),
    received_at: String(formData.get("received_at") || new Date().toISOString().slice(0, 10)),
    status: "confirmed",
  });
  fail(error);
  const back = String(formData.get("back") || "/treasury");
  revalidatePath(back);
}
