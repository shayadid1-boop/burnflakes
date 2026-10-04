import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-link landing that works on ANY device. The older /auth/callback route needs the link to be
 * opened in the same browser that asked for it (it checks a secret kept in that browser), so a link
 * requested on a laptop and opened in the Gmail app on a phone failed silently. This route checks the
 * one-time token in the link itself instead. The Supabase email template must point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  if (tokenHash) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const hasPassword = data.user?.user_metadata?.has_password === true;
      return NextResponse.redirect(`${origin}${hasPassword ? "/me" : "/set-password"}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
