import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card } from "@/components/ui";
import { NotifyForm, type Recipient } from "@/components/notify-form";

export const dynamic = "force-dynamic";

/** Admin: pick members and send them a message or a calendar invite from your own mail app. */
export default async function NotifyPage() {
  const me = await requireMember();
  if (me.role !== "admin" || !me.eventId) redirect("/me");
  const supabase = await createClient();

  const [depts, { data: members }, { data: ems }, { data: leads }] = await Promise.all([
    myDepartments(me.eventId),
    supabase.from("members").select("id, first_name, last_name, email, is_active").order("first_name"),
    supabase.from("event_members").select("id, member_id, attending").eq("event_id", me.eventId),
    supabase.from("department_leads").select("event_member_id").eq("event_id", me.eventId),
  ]);

  const emOf = new Map((ems ?? []).map((e) => [e.member_id, e]));
  const leadIds = new Set((leads ?? []).map((l) => l.event_member_id));
  const recipients: Recipient[] = (members ?? [])
    .filter((m) => m.is_active && m.email)
    .map((m) => {
      const em = emOf.get(m.id);
      return {
        id: m.id,
        name: `${m.first_name} ${m.last_name ?? ""}`.trim(),
        email: m.email as string,
        attending: !!em?.attending,
        lead: !!em && leadIds.has(em.id),
      };
    });
  const missing = (members ?? []).filter((m) => m.is_active && !m.email).length;

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1>שליחה לחברים</h1>
          <Link href="/members" className="text-sm font-bold text-orange-700 hover:underline">← חזרה לחברים</Link>
        </div>

        <Card>
          <NotifyForm recipients={recipients} />
        </Card>

        {missing > 0 && (
          <p className="text-sm text-stone-500">{missing} חברים פעילים בלי כתובת מייל — הם לא מופיעים ברשימה. אפשר להשלים אותן במסך חברים.</p>
        )}
        <p className="text-sm text-stone-500">
          ההודעה יוצאת מהכתובת שלך ולא מהמערכת, אז אין סיכון שהיא תיפול לספאם בגלל שרת זר. כשיהיה דומיין לברנפלקס נוכל לשלוח ישירות מהמערכת, כולל תזכורות אוטומטיות.
        </p>
      </main>
    </>
  );
}
