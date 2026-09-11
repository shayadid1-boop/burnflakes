import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myDepartments } from "@/lib/data";
import { Nav } from "@/components/nav";
import { Card, Btn, inputCls } from "@/components/ui";
import { num } from "@/lib/format";
import { addEpisode, updateEpisode, deleteEpisode } from "./actions";

const FOLDER = "https://drive.google.com/drive/folders/1doePs3Q_CxxPMGuz8JmjR13psSkHIJoh";
const mb = (b: number | null) => (b ? `${Math.round(Number(b) / 1048576)} MB` : "");

/** Podcast library: episodes live in the camp's shared Google Drive folder; we list them and play with Drive's player. */
export default async function PodcastPage({ searchParams }: { searchParams: Promise<{ q?: string; play?: string; edit?: string }> }) {
  const { q = "", play = "", edit = "" } = await searchParams;
  const me = await requireMember();
  const supabase = await createClient();
  const [depts, { data: episodes }] = await Promise.all([
    me.eventId ? myDepartments(me.eventId) : Promise.resolve([]),
    supabase.from("podcast_episodes").select("*").order("sort_order").order("recorded_on"),
  ]);
  const isAdmin = me.role === "admin";
  const needle = q.trim().toLowerCase();
  const all = (episodes ?? []).filter((e) => e.is_published || isAdmin);
  const list = all.filter((e) => !needle || `${e.title_he} ${e.description_he ?? ""} ${e.file_name ?? ""}`.toLowerCase().includes(needle));
  const playing = all.find((e) => e.id === play) ?? null;

  return (
    <>
      <Nav me={me} depts={depts} />
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1>הפודקאסט של ברנפלקס</h1>
          <span className="text-sm text-stone-500">{num(all.length)} פרקים · <a href={FOLDER} target="_blank" rel="noopener" className="underline">התיקייה בדרייב</a></span>
        </div>

        {playing && (
          <Card lift title={playing.title_he}>
            {playing.description_he && <p className="mb-3 text-sm text-stone-600">{playing.description_he}</p>}
            <iframe src={`https://drive.google.com/file/d/${playing.drive_file_id}/preview`} allow="autoplay" className={`${Number(playing.file_size) > 100 * 1048576 ? "h-72" : "h-24"} w-full rounded-lg border border-stone-200 bg-white`} title={playing.title_he} />
            <p className="mt-2 text-xs text-stone-400">{Number(playing.file_size) > 100 * 1048576 && "קובץ גדול — גוגל מציג אזהרה, לוחצים Play anyway והפרק מתנגן. "}לא מתנגן? <a href={`https://drive.google.com/file/d/${playing.drive_file_id}/view`} target="_blank" rel="noopener" className="underline">פתח בדרייב</a></p>
          </Card>
        )}

        <Card>
          <form method="get" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <input name="q" defaultValue={q} placeholder="חפש פרק" className={`${inputCls} w-64`} />
            <Btn variant="ghost" type="submit">חפש</Btn>
            {q && <a href="/podcast" className="text-stone-500 underline">נקה</a>}
          </form>
          <ul className="divide-y divide-stone-200">
            {list.map((e) => (
              <li key={e.id} className="py-2">
                {isAdmin && edit === e.id ? (
                  <form action={updateEpisode} className="grid grid-cols-2 gap-2 text-sm md:grid-cols-6">
                    <input type="hidden" name="id" value={e.id} />
                    <input name="title_he" defaultValue={e.title_he} className={`${inputCls} col-span-2`} required />
                    <input name="recorded_on" type="date" defaultValue={e.recorded_on ?? ""} className={inputCls} />
                    <input name="sort_order" type="number" defaultValue={e.sort_order} className={inputCls} title="סדר" />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_published" defaultChecked={e.is_published} /> מפורסם</label>
                    <input name="description_he" defaultValue={e.description_he ?? ""} placeholder="תיאור הפרק" className={`${inputCls} col-span-2 md:col-span-5`} />
                    <div className="flex gap-2"><Btn type="submit">שמור</Btn><a href="/podcast" className="self-center text-xs text-stone-500 underline">ביטול</a></div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a href={`/podcast?play=${e.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`font-medium hover:underline ${playing?.id === e.id ? "text-orange-700" : ""}`}>▶ {e.title_he}</a>
                      {!e.is_published && <span className="pill muted mr-2">טיוטה</span>}
                      {e.description_he && <div className="text-sm text-stone-500">{e.description_he}</div>}
                      <div className="text-xs text-stone-400">{e.recorded_on ?? ""} {e.file_size ? `· ${mb(e.file_size)}` : ""} {e.file_name && e.file_name !== e.title_he ? `· ${e.file_name}` : ""}</div>
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0 gap-2 text-xs">
                        <a href={`/podcast?edit=${e.id}`} className="text-orange-700 hover:underline">עריכה</a>
                        <form action={deleteEpisode}><input type="hidden" name="id" value={e.id} /><button className="text-stone-400 hover:text-red-600">הסר</button></form>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {list.length === 0 && <li className="py-3 text-sm text-stone-400">לא נמצאו פרקים.</li>}
          </ul>
        </Card>

        {isAdmin && (
          <Card title="הוספת פרק מהדרייב">
            <form action={addEpisode} className="grid grid-cols-2 gap-2 text-sm md:grid-cols-6">
              <input name="link" placeholder="קישור לקובץ בדרייב (שיתוף → העתק קישור)" dir="ltr" className={`${inputCls} col-span-2 md:col-span-3`} required />
              <input name="title_he" placeholder="שם הפרק" className={`${inputCls} col-span-2`} required />
              <input name="recorded_on" type="date" className={inputCls} />
              <input name="description_he" placeholder="תיאור" className={`${inputCls} col-span-2 md:col-span-5`} />
              <Btn type="submit">+ הוסף</Btn>
            </form>
            <p className="mt-2 text-xs text-stone-500">הקובץ צריך להיות משותף כ״כל מי שיש לו את הקישור״. הפרקים שכבר בתיקייה נטענו אוטומטית.</p>
          </Card>
        )}
      </main>
    </>
  );
}
