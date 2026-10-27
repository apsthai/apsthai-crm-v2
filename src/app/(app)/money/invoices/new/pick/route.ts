import { NextResponse, type NextRequest } from "next/server";

// GET form helper: "payer|currency" -> ?payer=&currency=
export function GET(req: NextRequest) {
  const pick = req.nextUrl.searchParams.get("pick") ?? "";
  const i = pick.lastIndexOf("|");
  const url = req.nextUrl.clone();
  url.pathname = "/money/invoices/new";
  url.search = i > 0 ? `?${new URLSearchParams({ payer: pick.slice(0, i), currency: pick.slice(i + 1) })}` : "";
  return NextResponse.redirect(url);
}
