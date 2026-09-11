import Link from "next/link";
import type { CurrentMember } from "@/lib/auth";

export function Nav({ me, depts = [] }: { me: CurrentMember; depts?: { slug: string; name_he: string }[] }) {
  const links: { href: string; label: string }[] = [
    { href: "/me", label: "החשבון שלי" },
    { href: "/camp", label: "תקציב הקמפ" },
  ];
  if (me.role === "admin") {
    links.push({ href: "/scenarios", label: "תרחישים" }, { href: "/treasury", label: "כספים" }, { href: "/dashboard", label: "לוח ניהול" }, { href: "/members", label: "חברים" });
  }
  return (
    <nav className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-5xl p-2 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          <Link href="/me" className="ml-2 whitespace-nowrap font-bold text-orange-700">🔥 ברנפלקס</Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-md px-3 py-1.5 font-medium hover:bg-stone-100">
              {l.label}
            </Link>
          ))}
          <span className="mr-auto whitespace-nowrap text-stone-500">{me.firstName ?? me.userEmail}</span>
        </div>
        {depts.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-stone-100 pt-1 text-xs text-stone-600">
            <span className="px-2 text-stone-400">מחלקות:</span>
            {depts.map((d) => (
              <Link key={d.slug} href={`/dept/${d.slug}`} className="whitespace-nowrap rounded-md px-2 py-1 hover:bg-stone-100">
                {d.name_he}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
