import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentMember = {
  userEmail: string;
  memberId: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "dept_lead" | "member" | null;
  eventId: string | null;
  eventName: string | null;
};

/** Logged-in user + the camp member matched by email (for the current event). Redirects to /login if not logged in. */
export async function requireMember(): Promise<CurrentMember> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .ilike("email", user.email.replace(/[%_\\]/g, (m) => "\\" + m))
    .maybeSingle();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .neq("status", "closed")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  let role: CurrentMember["role"] = null;
  if (member && event) {
    const { data: em } = await supabase
      .from("event_members")
      .select("role")
      .eq("event_id", event.id)
      .eq("member_id", member.id)
      .maybeSingle();
    role = em?.role ?? null;
  }

  return {
    userEmail: user.email,
    memberId: member?.id ?? null,
    firstName: member?.first_name ?? null,
    lastName: member?.last_name ?? null,
    role,
    eventId: event?.id ?? null,
    eventName: event?.name ?? null,
  };
}
