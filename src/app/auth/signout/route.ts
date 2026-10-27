import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Clears a session the server no longer accepts (e.g. after a password change),
// so the proxy and the app agree that the user is signed out.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const res = NextResponse.redirect(new URL("/login", req.url));
  req.cookies.getAll().filter((c) => c.name.startsWith("sb-")).forEach((c) => res.cookies.delete(c.name));
  return res;
}
