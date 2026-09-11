import Link from "next/link";
import type { CurrentMember } from "@/lib/auth";

export function Nav({ me, depts = [] }: { me: CurrentMember; depts?: { slug: string; name_he: string }[] }) {
  const links: { href: string; label: string }[] = [
    { href: "/me", label: "החשבון שלי" },
    { href: "/camp", label: "תקציב הקמפ" },
  ];
  for (const d of depts) links.push({ href: `/dept/${d.slug}`, label: d.name_he });
  if (me.role === "admin") {
    links.push({ href: "/scenarios", label: "תרחישים" }, { href: "/treasury", label: "כספים" }, { href: "/dashboard", label: "לוח ניהול" }, { href: "/members", label: "חברים" });
  }
  return (
    <nav className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto p-2 text-sm">
        <Link href="/me" className="ml-2 whitespace-nowrap font-bold text-orange-700">🔥 ברנפלקס</Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-stone-100">
            {l.label}
          </Link>
        ))}
        <span className="mr-auto whitespace-nowrap text-stone-500">{me.firstName ?? me.userEmail}</span>
      </div>
    </nav>
  );
}
