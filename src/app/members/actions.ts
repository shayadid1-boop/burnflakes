"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
async function admin() {
  const me = await requireMember();
  if (me.role !== "admin" || !me.eventId) throw new Error("admin only");
  return { me, supabase: await createClient() };
}
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;

export async function createMember(formData: FormData) {
  const { me, supabase } = await admin();
  const { data, error } = await supabase.from("members").insert({
    first_name: s(formData, "first_name"), last_name: s(formData, "last_name"),
    email: s(formData, "email")?.toLowerCase(), phone: s(formData, "phone"), notes: s(formData, "notes"),
  }).select("id").single();
  fail(error);
  if (formData.get("attending") === "on") {
    const { error: e2 } = await supabase.from("event_members").insert({ event_id: me.eventId, member_id: data!.id, tier: "friend", role: "member", attending: true });
    fail(e2);
  }
  revalidatePath("/members");
}

export async function updateMember(formData: FormData) {
  const { supabase } = await admin();
  const { error } = await supabase.from("members").update({
    first_name: s(formData, "first_name"), last_name: s(formData, "last_name"),
    email: s(formData, "email")?.toLowerCase(), phone: s(formData, "phone"), notes: s(formData, "notes"),
    is_active: formData.get("is_active") === "on",
  }).eq("id", String(formData.get("id")));
  fail(error);
  revalidatePath("/members");
}

/** Toggle "coming this year": creates the event_members row on first add; removing keeps the row (history) with attending=false. */
export async function setAttending(formData: FormData) {
  const { me, supabase } = await admin();
  const memberId = String(formData.get("member_id"));
  const attending = formData.get("attending") === "true";
  const { data: existing } = await supabase.from("event_members").select("id").eq("event_id", me.eventId).eq("member_id", memberId).maybeSingle();
  if (existing) {
    fail((await supabase.from("event_members").update({ attending }).eq("id", existing.id)).error);
  } else if (attending) {
    fail((await supabase.from("event_members").insert({ event_id: me.eventId, member_id: memberId, attending: true })).error);
  }
  revalidatePath("/members");
}

export async function updateEventMember(formData: FormData) {
  const { me, supabase } = await admin();
  const emId = String(formData.get("event_member_id"));
  const { error } = await supabase.from("event_members").update({
    role: String(formData.get("role")),
    ticket_status: String(formData.get("ticket_status")), volunteer_dept: s(formData, "volunteer_dept"),
    production_volunteer: formData.get("production_volunteer") === "on",
    participation_share: Number(formData.get("participation_share") || 1),
  }).eq("id", emId);
  fail(error);
  // department leadership: replace the set
  const deptIds = formData.getAll("lead_dept").map(String).filter(Boolean);
  fail((await supabase.from("department_leads").delete().eq("event_id", me.eventId).eq("event_member_id", emId)).error);
  if (deptIds.length) fail((await supabase.from("department_leads").insert(deptIds.map((d) => ({ event_id: me.eventId, department_id: d, event_member_id: emId })))).error);
  revalidatePath("/members");
}

export async function setNationalId(formData: FormData) {
  const { supabase } = await admin();
  const memberId = String(formData.get("member_id"));
  const nid = s(formData, "national_id");
  const { error } = nid
    ? await supabase.from("member_private").upsert({ member_id: memberId, national_id: nid, updated_at: new Date().toISOString() })
    : await supabase.from("member_private").delete().eq("member_id", memberId);
  fail(error);
  revalidatePath("/members");
}
