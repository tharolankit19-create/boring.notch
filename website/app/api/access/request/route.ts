import { NextResponse } from "next/server";
import { createAccessToken } from "@/lib/access";
import { purchaseByEmail } from "@/lib/db";
import { sendAccessEmail } from "@/lib/email";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const generic = NextResponse.json({ ok: true });
  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@") || email.length > 254) return generic;
    if (!await purchaseByEmail(email)) return generic;
    await sendAccessEmail(email, createAccessToken(email));
    return generic;
  } catch (error) {
    console.error("magic_link_failed", error);
    return generic;
  }
}
