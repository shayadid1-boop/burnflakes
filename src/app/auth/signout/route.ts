import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }); // only this device — logging out on the phone must not log out the laptop
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
