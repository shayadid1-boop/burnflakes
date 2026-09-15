import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/me");

  return (
    <main className="gate">
      <div className="gate-card space-y-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
      <img src="/logo.png" alt="ברנפלקס" className="gate-logo" />
      <h1 className="gate-title">ברוכים הבאים ללול התרנגולות</h1>
      <p className="gate-sub">מערכת לניהול הקמפ</p>
      <p className="text-stone-600">
        תקציב, הוצאות, חשבון חברים, משמרות ומחסן — במקום אחד. הכניסה לחברי הקמפ בלבד.
      </p>
      <Link href="/login" className="btn-brand block rounded-lg p-3 text-center">
        כניסה לחברי הקמפ
      </Link>
      </div>
    </main>
  );
}
