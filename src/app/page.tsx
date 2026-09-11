import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, starts_on")
    .order("starts_on", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-bold">שלום ברנפלקס 🔥</h1>
      <p className="text-stone-600">
        זה הדף הראשון של המערכת. אם רואים למטה את רשימת האירועים — האפליקציה
        מחוברת לבסיס הנתונים בענן.
      </p>
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-2 font-semibold">אירועים בבסיס הנתונים</h2>
        {error ? (
          <p className="text-red-600 text-sm">שגיאה: {error.message}</p>
        ) : (
          <ul className="space-y-1">
            {events?.map((e) => (
              <li key={e.id} className="flex justify-between text-sm">
                <span>{e.name}</span>
                <span className="text-stone-500">{e.starts_on}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
