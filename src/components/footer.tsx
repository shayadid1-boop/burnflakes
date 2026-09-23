/** The Clear Vision stamp — on every page of every system we build. */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 py-5 text-center text-xs text-stone-400">
      <a href="https://clearvision.co.il" target="_blank" rel="noopener" className="inline-flex items-center gap-2 hover:text-stone-900">
        <span>נבנה באהבה על ידי</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static logo, no optimisation needed */}
        <img src="/clearvision.png" alt="Clear Vision" width={100} height={29} className="cv-logo" />
        <span className="text-stone-300">·</span>
        <span>קליר ויזן — מערכות ו-AI לעסקים</span>
      </a>
    </footer>
  );
}
