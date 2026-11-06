import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Signs out and clears every Supabase cookie, even when the session is already gone on the server.
async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const to = new URL("/login", request.url);
  const msg = request.nextUrl.searchParams.get("msg");
  if (msg) to.searchParams.set("msg", msg);
  const response = NextResponse.redirect(to, { status: 303 });
  request.cookies.getAll().filter((c) => c.name.startsWith("sb-")).forEach((c) => response.cookies.delete(c.name));
  return response;
}
export const GET = signOut;
export const POST = signOut;
