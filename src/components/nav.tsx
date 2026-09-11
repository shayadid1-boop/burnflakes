import type { CurrentMember } from "@/lib/auth";
import { NavTabs } from "./nav-tabs";

export function Nav({ me, depts = [] }: { me: CurrentMember; depts?: { slug: string; name_he: string }[] }) {
  const tabs: { href: string; label: string }[] = [
    { href: "/me", label: "החשבון שלי" },
    { href: "/camp", label: "תקציב הקמפ" },
    { href: "/shifts", label: "משמרות" },
    { href: "/inventory", label: "מחסן" },
  ];
  if (me.role === "admin") {
    tabs.push({ href: "/scenarios", label: "תרחישים" }, { href: "/treasury", label: "כספים" }, { href: "/dashboard", label: "לוח ניהול" }, { href: "/members", label: "חברים" });
  }
  return (
    <header className="border-b border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 pt-5 pb-2">
          <div className="flex items-baseline gap-3">
            <a href="/me" className="font-serif text-2xl font-bold text-stone-900">ברנפלקס</a>
            <small className="text-sm text-stone-500">{me.eventName ?? "ניהול תקציב הקמפ"}</small>
          </div>
          <span className="text-sm text-stone-500">{me.firstName ?? me.userEmail}</span>
        </div>
        <NavTabs tabs={tabs} depts={depts.map((d) => ({ href: `/dept/${d.slug}`, label: d.name_he }))} />
      </div>
    </header>
  );
}
