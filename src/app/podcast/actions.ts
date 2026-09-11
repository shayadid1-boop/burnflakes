"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
async function admin() {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("admin only");
  return { me, supabase: await createClient() };
}
/** Accepts a Drive share link or a bare file id. */
function driveId(input: string) {
  const m = input.match(/\/d\/([A-Za-z0-9_-]{20,})/) ?? input.match(/[?&]id=([A-Za-z0-9_-]{20,})/) ?? input.match(/^([A-Za-z0-9_-]{20,})$/);
  if (!m) throw new Error("לא זיהיתי קישור של Google Drive (צריך קישור לקובץ, לא לתיקייה)");
  return m[1];
}

export async function addEpisode(formData: FormData) {
  const { supabase } = await admin();
  const { error } = await supabase.from("podcast_episodes").insert({
    drive_file_id: driveId(String(formData.get("link") ?? "")), title_he: s(formData, "title_he") ?? "פרק חדש",
    description_he: s(formData, "description_he"), recorded_on: s(formData, "recorded_on"), sort_order: Number(formData.get("sort_order") || 999),
  });
  fail(error);
  revalidatePath("/podcast");
}

export async function updateEpisode(formData: FormData) {
  const { supabase } = await admin();
  const { error } = await supabase.from("podcast_episodes").update({
    title_he: s(formData, "title_he") ?? "פרק", description_he: s(formData, "description_he"), recorded_on: s(formData, "recorded_on"),
    sort_order: Number(formData.get("sort_order") || 0), is_published: formData.get("is_published") === "on",
  }).eq("id", String(formData.get("id")));
  fail(error);
  revalidatePath("/podcast");
}

export async function deleteEpisode(formData: FormData) {
  const { supabase } = await admin();
  fail((await supabase.from("podcast_episodes").delete().eq("id", String(formData.get("id")))).error);
  revalidatePath("/podcast");
}
