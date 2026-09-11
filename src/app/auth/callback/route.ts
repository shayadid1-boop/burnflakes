import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing: exchanges the code for a session cookie, then goes to `next` (default /me).
 *  A member without a password yet is sent to /set-password regardless. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/me";
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const hasPassword = data.user?.user_metadata?.has_password === true;
      const safeNext = next.startsWith("/") ? next : "/me";
      return NextResponse.redirect(`${origin}${hasPassword ? safeNext.replace("/set-password", "/me") : "/set-password"}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
