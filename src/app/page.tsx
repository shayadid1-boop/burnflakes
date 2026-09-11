import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/me");

  return (
    <main className="mx-auto w-full max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-bold">ברנפלקס 🔥</h1>
      <p className="text-stone-600">
        תקציב הקמפ, הוצאות, חשבון חברים ולוח משמרות — במקום אחד. הכניסה לחברי הקמפ בלבד.
      </p>
      <Link href="/login" className="block rounded-lg bg-orange-600 p-3 text-center font-semibold text-white">
        כניסה לחברי הקמפ
      </Link>
    </main>
  );
}
