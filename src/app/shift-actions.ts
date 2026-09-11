"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

async function myEventMemberId() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from("event_members").select("id, attending").eq("event_id", me.eventId!).eq("member_id", me.memberId!).maybeSingle();
  if (!data?.attending) throw new Error("only attending members");
  return { supabase, emId: data.id };
}

export async function registerShift(formData: FormData) {
  const { supabase, emId } = await myEventMemberId();
  const shiftId = String(formData.get("shift_id"));
  const { data: s } = await supabase.from("shifts").select("slots").eq("id", shiftId).single();
  const { count } = await supabase.from("shift_assignments").select("*", { count: "exact", head: true }).eq("shift_id", shiftId);
  if (s && (count ?? 0) >= s.slots) throw new Error("המשמרת מלאה");
  const { error } = await supabase.from("shift_assignments").insert({ shift_id: shiftId, event_member_id: emId });
  fail(error);
  revalidatePath(String(formData.get("back") || "/camp")); revalidatePath("/me");
}

export async function unregisterShift(formData: FormData) {
  const { supabase, emId } = await myEventMemberId();
  const { error } = await supabase.from("shift_assignments").delete().eq("shift_id", String(formData.get("shift_id"))).eq("event_member_id", emId);
  fail(error);
  revalidatePath(String(formData.get("back") || "/camp")); revalidatePath("/me");
}

// ---------- department lead: roles & shifts ----------
async function lead() {
  const me = await requireMember();
  if (!me.eventId) throw new Error("no event");
  return { me, supabase: await createClient() };
}

export async function createShiftRole(formData: FormData) {
  const { me, supabase } = await lead();
  const t = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const { error } = await supabase.from("shift_roles").insert({
    event_id: me.eventId, department_id: String(formData.get("department_id")), name_he: t("name_he"), description_he: t("description_he"),
    slots_per_shift: Number(formData.get("slots_per_shift") || 1), starts_at: t("starts_at"), ends_at: t("ends_at"),
    budget_amount: formData.get("budget_amount") ? Number(formData.get("budget_amount")) : null,
  });
  fail(error);
  revalidatePath(String(formData.get("back")));
}

export async function deleteShiftRole(formData: FormData) {
  const { supabase } = await lead();
  fail((await supabase.from("shift_roles").delete().eq("id", String(formData.get("id")))).error);
  revalidatePath(String(formData.get("back")));
}

/** Open shifts: one role on one or more days (comma/space separated dates), or a one-off with its own title. */
export async function openShifts(formData: FormData) {
  const { me, supabase } = await lead();
  const t = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const roleId = t("shift_role_id");
  const days = formData.getAll("days").flatMap((v) => String(v).split(/[\s,]+/)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (days.length === 0) throw new Error("צריך לפחות תאריך אחד (YYYY-MM-DD)");
  let role: { slots_per_shift: number; starts_at: string | null; ends_at: string | null } | null = null;
  if (roleId) role = (await supabase.from("shift_roles").select("slots_per_shift, starts_at, ends_at").eq("id", roleId).single()).data;
  // time slots: "08:00-10:00, 12:00-14:00" (one shift per slot per day); empty = one shift per day at the role's / form's time
  const slotsText = t("time_slots") ?? "";
  const timeSlots = slotsText.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
    if (!m) throw new Error(`שעות לא תקינות: ${x} (צורה: 08:00-10:00)`);
    return { starts_at: m[1].padStart(5, "0"), ends_at: m[2].padStart(5, "0") };
  });
  const times = timeSlots.length ? timeSlots : [{ starts_at: t("starts_at") ?? role?.starts_at ?? null, ends_at: t("ends_at") ?? role?.ends_at ?? null }];
  const rows = days.flatMap((day) => times.map((tm) => ({
    event_id: me.eventId, department_id: String(formData.get("department_id")), shift_role_id: roleId, day,
    title_he: t("title_he"), slots: Number(formData.get("slots") || role?.slots_per_shift || 1),
    starts_at: tm.starts_at, ends_at: tm.ends_at, notes: t("notes"),
  })));
  fail((await supabase.from("shifts").insert(rows)).error);
  revalidatePath(String(formData.get("back")));
}

export async function deleteShift(formData: FormData) {
  const { supabase } = await lead();
  fail((await supabase.from("shifts").delete().eq("id", String(formData.get("id")))).error);
  revalidatePath(String(formData.get("back")));
}

/** Lead assigns / removes a member on a shift. */
export async function assignShift(formData: FormData) {
  const { supabase } = await lead();
  const shiftId = String(formData.get("shift_id")); const emId = String(formData.get("event_member_id"));
  if (formData.get("remove") === "1") fail((await supabase.from("shift_assignments").delete().eq("shift_id", shiftId).eq("event_member_id", emId)).error);
  else fail((await supabase.from("shift_assignments").upsert({ shift_id: shiftId, event_member_id: emId })).error);
  revalidatePath(String(formData.get("back")));
}

/** Admin: fair-share settings for the event (volunteer credit, whether credits are added to the pool). */
export async function setShiftSettings(formData: FormData) {
  const { me, supabase } = await lead();
  if (me.role !== "admin") throw new Error("admin only");
  const { error } = await supabase.from("events").update({
    volunteer_shift_credit: Number(formData.get("volunteer_shift_credit") || 0),
    volunteers_count_in_total: formData.get("volunteers_count_in_total") === "on",
  }).eq("id", me.eventId);
  fail(error);
  revalidatePath("/shifts");
}

/** Lead/admin: delete every shift of a department on one day (undo a planning mistake in one click). */
export async function deleteDayShifts(formData: FormData) {
  const { me, supabase } = await lead();
  fail((await supabase.from("shifts").delete().eq("event_id", me.eventId).eq("department_id", String(formData.get("department_id"))).eq("day", String(formData.get("day")))).error);
  revalidatePath(String(formData.get("back")));
}
