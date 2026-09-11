import { createClient } from "@/lib/supabase/server";

export const STATUS_HE: Record<string, string> = { pending: "ממתין לאישור", approved: "מאושר", reimbursed: "הוחזר", settled: "סגור", rejected: "נדחה" };
/** pill colour per status (expenses and scenarios) */
export const STATUS_TONE: Record<string, "good" | "bad" | "warn" | "plan" | "muted"> = { pending: "warn", approved: "good", reimbursed: "plan", settled: "muted", rejected: "bad", draft: "warn", archived: "muted" };
export const PAID_FROM_HE: Record<string, string> = { member_pocket: "מהכיס", camp_account: "מקופת הקמפ", advance: "מקדמה" };
export const METHOD_HE: Record<string, string> = { paybox: "PayBox", bit: "Bit", bank_transfer: "העברה בנקאית", cash: "מזומן", offset: "קיזוז" };
export const TIER_HE: Record<string, string> = { core: "גרעין", second_year: "שנה שנייה", semi_core: "חצי גרעין", friend: "חבר של", partner: "בן/בת זוג" };

export async function myDepartments(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_departments", { p_event: eventId });
  return (data ?? []) as { id: string; slug: string; name_he: string; kind: string }[];
}
