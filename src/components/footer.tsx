/** The Clear Vision stamp — on every page of every system we build. */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-200 py-5 text-center text-xs text-stone-400">
      <a href="https://clearvision.co.il" target="_blank" rel="noopener" className="inline-flex items-center gap-2 hover:text-stone-900">
        <span>נבנה באהבה על ידי</span>
        <span className="font-serif text-sm font-bold tracking-wide text-stone-500">Clear Vision</span>
        <span className="text-stone-300">·</span>
        <span>קליר ויזן — מערכות ו-AI לעסקים</span>
      </a>
    </footer>
  );
}
