"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

/** Brown strip with the tabs; the current one is filled turquoise, like the wordmark in the logo. */
export function NavTabs({ tabs, depts }: { tabs: Tab[]; depts: Tab[] }) {
  const path = usePathname();
  const active = (href: string) => path === href || (href !== "/me" && path.startsWith(href + "/"));
  return (
    <nav aria-label="ניווט ראשי">
      <div className="navstrip">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} aria-current={active(t.href) ? "page" : undefined}
              className="navtab whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold transition-colors">
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      {depts.length > 0 && (
        <div className="border-b border-stone-200 bg-stone-50">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 text-xs md:flex-wrap">
            <span className="px-1 text-stone-400">מחלקות</span>
            {depts.map((d) => (
              <Link key={d.href} href={d.href} aria-current={active(d.href) ? "page" : undefined}
                className={`pill ${active(d.href) ? "plan" : "muted"} hover:text-stone-900`}>
                {d.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
