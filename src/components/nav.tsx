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
  tabs.push({ href: "/podcast", label: "פודקאסט" }); // last on purpose — nice to have, not daily work
  return (
    <header>
      <div className="brandbar">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <a href="/me" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark, no optimisation needed */}
            <img src="/mark.png" alt="" className="mark" />
            <span className="name">ברנפלקס</span>
            <small className="text-sm text-stone-500">{me.eventName ?? "ניהול תקציב הקמפ"}</small>
          </a>
          <span className="text-sm text-stone-500">{me.firstName ?? me.userEmail}</span>
        </div>
      </div>
      <NavTabs tabs={tabs} depts={depts.map((d) => ({ href: `/dept/${d.slug}`, label: d.name_he }))} />
    </header>
  );
}
