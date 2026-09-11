import { Fragment } from "react";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments, TIER_HE } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Btn, inputCls } from "@/components/ui";
import { num } from "@/lib/format";
import { createMember, updateMember, setAttending, updateEventMember, setNationalId } from "./actions";

const ROLE_HE: Record<string, string> = { admin: "מנהל", dept_lead: "ראש מחלקה", member: "חבר" };
const TICKET_HE: Record<string, string> = { unknown: "לא ידוע", allocation: "הקצאה של הקמפ", self_bought: "קנה לבד", needs_volunteer: "צריך התנדבות", no_ticket: "אין כרטיס" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; open?: string; show?: string }> }) {
  const { q = "", open = "", show = "attending" } = await searchParams;
  const me = await requireMember();
  if (me.role !== "admin" || !me.eventId) redirect("/me");
  const supabase = await createClient();
  const [depts, { data: members }, { data: ems }, { data: leads }, { data: privates }, { data: allDepts }] = await Promise.all([
    myDepartments(me.eventId),
    supabase.from("members").select("id, first_name, last_name, email, phone, notes, is_active").order("first_name").order("last_name"),
    supabase.from("event_members").select("id, member_id, tier, role, participation_share, attending, ticket_status, volunteer_dept").eq("event_id", me.eventId),
    supabase.from("department_leads").select("event_member_id, department_id").eq("event_id", me.eventId),
    supabase.from("member_private").select("member_id, national_id"),
    supabase.from("departments").select("id, name_he").eq("is_active", true).order("sort_order"),
  ]);
  const emOf = new Map((ems ?? []).map((e) => [e.member_id, e]));
  const leadsOf = new Map<string, string[]>();
  for (const l of leads ?? []) leadsOf.set(l.event_member_id, [...(leadsOf.get(l.event_member_id) ?? []), l.department_id]);
  const nidOf = new Map((privates ?? []).map((p) => [p.member_id, p.national_id]));
  const deptName = new Map((allDepts ?? []).map((d) => [d.id, d.name_he]));
  const needle = q.trim().toLowerCase();
  const list = (members ?? []).filter((m) => {
    const em = emOf.get(m.id);
    if (show === "attending" && !em?.attending) return false;
    if (show === "not" && em?.attending) return false;
    if (!needle) return true;
    return `${m.first_name} ${m.last_name ?? ""} ${m.email ?? ""} ${m.phone ?? ""}`.toLowerCase().includes(needle);
  });
  const attendingCount = (ems ?? []).filter((e) => e.attending).length;

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold">חברים</h1>
          <span className="text-sm text-stone-500">{num(attendingCount)} מגיעים ל‑{me.eventName} מתוך {num(members?.length ?? 0)} במאגר</span>
        </div>

        <form className="flex flex-wrap items-center gap-2 text-sm" method="get">
          <input name="q" defaultValue={q} placeholder="חיפוש שם / מייל / טלפון" className={`${inputCls} w-64`} />
          <select name="show" defaultValue={show} className={inputCls}>
            <option value="attending">מגיעים השנה</option><option value="not">לא מגיעים / לא סומנו</option><option value="all">כל המאגר</option>
          </select>
          <Btn variant="ghost" type="submit">סנן</Btn>
        </form>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-stone-500"><tr className="text-right"><th className="p-2 font-normal">שם</th><th className="p-2 font-normal">מייל</th><th className="p-2 font-normal">טלפון</th><th className="p-2 font-normal">מגיע</th><th className="p-2 font-normal">מעמד</th><th className="p-2 font-normal">תפקיד</th><th className="p-2 font-normal">מוביל</th><th className="p-2 font-normal">כרטיס</th><th className="p-2 font-normal"></th></tr></thead>
              <tbody>
                {list.map((m) => {
                  const em = emOf.get(m.id);
                  const isOpen = open === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr className={`border-t border-stone-100 ${!m.is_active ? "text-stone-400" : ""}`}>
                        <td className="p-2 whitespace-nowrap font-medium">{m.first_name} {m.last_name}</td>
                        <td className="p-2 text-xs" dir="ltr">{m.email}</td>
                        <td className="p-2 text-xs" dir="ltr">{m.phone}</td>
                        <td className="p-2">
                          <form action={setAttending}>
                            <input type="hidden" name="member_id" value={m.id} />
                            <input type="hidden" name="attending" value={em?.attending ? "false" : "true"} />
                            <button className={`rounded-full px-2 py-0.5 text-xs ${em?.attending ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-500"}`}>{em?.attending ? "מגיע ✓" : "לא"}</button>
                          </form>
                        </td>
                        <td className="p-2 text-xs">{em ? TIER_HE[em.tier] : ""}</td>
                        <td className="p-2 text-xs">{em ? ROLE_HE[em.role] : ""}</td>
                        <td className="p-2 text-xs">{em ? (leadsOf.get(em.id) ?? []).map((d) => deptName.get(d)).join(", ") : ""}</td>
                        <td className="p-2 text-xs">{em ? TICKET_HE[em.ticket_status] : ""}</td>
                        <td className="p-2"><a href={`/members?q=${encodeURIComponent(q)}&show=${show}&open=${isOpen ? "" : m.id}`} className="text-xs text-orange-700 hover:underline">{isOpen ? "סגור" : "עריכה"}</a></td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-stone-50">
                          <td colSpan={9} className="p-3">
                            <div className="grid gap-4 md:grid-cols-2">
                              <form action={updateMember} className="grid grid-cols-2 gap-2 text-sm">
                                <input type="hidden" name="id" value={m.id} />
                                <input name="first_name" defaultValue={m.first_name} placeholder="שם" className={inputCls} required />
                                <input name="last_name" defaultValue={m.last_name ?? ""} placeholder="שם משפחה" className={inputCls} />
                                <input name="email" type="email" dir="ltr" defaultValue={m.email ?? ""} placeholder="מייל (לכניסה)" className={inputCls} />
                                <input name="phone" dir="ltr" defaultValue={m.phone ?? ""} placeholder="טלפון" className={inputCls} />
                                <input name="notes" defaultValue={m.notes ?? ""} placeholder="הערות" className={`${inputCls} col-span-2`} />
                                <label className="col-span-2 flex items-center gap-2 text-xs"><input type="checkbox" name="is_active" value="on" defaultChecked={m.is_active} /> פעיל במאגר (בטל = עזב את הקמפ)</label>
                                <Btn type="submit" className="col-span-2">שמור פרטים</Btn>
                              </form>
                              <div className="space-y-3">
                                {em && (
                                  <form action={updateEventMember} className="grid grid-cols-2 gap-2 text-sm">
                                    <input type="hidden" name="event_member_id" value={em.id} />
                                    <label className="text-xs text-stone-600">מעמד<select name="tier" defaultValue={em.tier} className={`${inputCls} w-full`}>{Object.entries(TIER_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                                    <label className="text-xs text-stone-600">תפקיד במערכת<select name="role" defaultValue={em.role} className={`${inputCls} w-full`}>{Object.entries(ROLE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                                    <label className="text-xs text-stone-600">כרטיס<select name="ticket_status" defaultValue={em.ticket_status} className={`${inputCls} w-full`}>{Object.entries(TICKET_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                                    <label className="text-xs text-stone-600">התנדבות במידברן<input name="volunteer_dept" defaultValue={em.volunteer_dept ?? ""} className={`${inputCls} w-full`} /></label>
                                    <label className="text-xs text-stone-600">חלק השתתפות (1 = מלא)<input name="participation_share" type="number" step="0.0001" defaultValue={String(em.participation_share)} className={`${inputCls} w-full`} /></label>
                                    <div className="text-xs text-stone-600">מוביל מחלקות
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        {(allDepts ?? []).map((d) => <label key={d.id} className="flex items-center gap-1"><input type="checkbox" name="lead_dept" value={d.id} defaultChecked={(leadsOf.get(em.id) ?? []).includes(d.id)} />{d.name_he}</label>)}
                                      </div>
                                    </div>
                                    <Btn type="submit" className="col-span-2">שמור פרטי השנה</Btn>
                                  </form>
                                )}
                                <form action={setNationalId} className="flex items-center gap-2 text-sm">
                                  <input type="hidden" name="member_id" value={m.id} />
                                  <span className="text-xs text-stone-600">ת״ז (רק מנהל רואה, לא חובה)</span>
                                  <input name="national_id" dir="ltr" defaultValue={nidOf.get(m.id) ?? ""} className={`${inputCls} w-36`} />
                                  <Btn variant="ghost" type="submit">שמור</Btn>
                                </form>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="חבר חדש">
          <form action={createMember} className="grid grid-cols-2 gap-2 text-sm md:grid-cols-6">
            <input name="first_name" placeholder="שם" className={inputCls} required />
            <input name="last_name" placeholder="שם משפחה" className={inputCls} />
            <input name="email" type="email" dir="ltr" placeholder="מייל" className={inputCls} />
            <input name="phone" dir="ltr" placeholder="טלפון" className={inputCls} />
            <select name="tier" className={inputCls} defaultValue="friend">{Object.entries(TIER_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="attending" defaultChecked /> מגיע השנה</label>
            <input name="notes" placeholder="הערות" className={`${inputCls} col-span-2 md:col-span-5`} />
            <Btn type="submit">+ הוסף</Btn>
          </form>
        </Card>
      </main>
    </>
  );
}
