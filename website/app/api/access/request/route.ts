import { NextResponse } from "next/server";
import { accessRecoveryRateKey, createAccessToken } from "@/lib/access";
import { claimAccessEmailRateLimit, purchaseByEmail } from "@/lib/db";
import { sendAccessEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const generic = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );

  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@") || email.length > 254) return generic;

    // Claim a server-side throttle slot before looking up entitlement. The key is
    // HMAC-derived, so the rate-limit table never stores the submitted email.
    const allowed = await claimAccessEmailRateLimit(accessRecoveryRateKey(email), 600);
    if (!allowed) return generic;

    if (!await purchaseByEmail(email)) return generic;

    await sendAccessEmail(email, createAccessToken(email));
    return generic;
  } catch (error) {
    console.error("magic_link_failed", error);
    return generic;
  }
}
