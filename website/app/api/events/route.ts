import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { analyticsEvent } from "@/lib/db";
const ALLOWED = new Set(["landing_view","demo_played","pricing_viewed","checkout_started"]);
const COOKIE = "notchsignal_anon";

export async function POST(request: Request) {
  try {
    const { event } = await request.json() as { event?: string };
    if (!event || !ALLOWED.has(event)) return NextResponse.json({ ok: false }, { status: 400 });
    const jar = await cookies();
    const anon = jar.get(COOKIE)?.value ?? crypto.randomUUID();
    await analyticsEvent(event, anon);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, anon, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365
    });
    return response;
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
}
