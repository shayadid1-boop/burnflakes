"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

/** Demo-style tab bar: underline on the current route; departments as a second, smaller row. */
export function NavTabs({ tabs, depts }: { tabs: Tab[]; depts: Tab[] }) {
  const path = usePathname();
  const active = (href: string) => path === href || (href !== "/me" && path.startsWith(href + "/"));
  const cls = (on: boolean) =>
    `whitespace-nowrap border-b-[3px] px-3.5 py-2.5 text-sm font-semibold transition-colors ${on ? "border-orange-600 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-900"}`;
  return (
    <nav aria-label="ניווט ראשי">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => <Link key={t.href} href={t.href} aria-current={active(t.href) ? "page" : undefined} className={cls(active(t.href))}>{t.label}</Link>)}
      </div>
      {depts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-stone-200 py-1.5 text-xs">
          <span className="px-2 text-stone-400">מחלקות</span>
          {depts.map((d) => (
            <Link key={d.href} href={d.href} aria-current={active(d.href) ? "page" : undefined}
              className={`pill ${active(d.href) ? "plan" : "muted"} hover:text-stone-900`}>
              {d.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
