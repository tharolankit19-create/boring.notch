import { NextResponse } from "next/server";
import { createFoundingCheckout } from "@/lib/dodo";
import { setCheckoutCookie } from "@/lib/access";
import { currentRelease } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    const release = await currentRelease();
    if (!release) {
      return NextResponse.json(
        { error: "The signed Mac release is finishing verification. Checkout is temporarily closed so nobody can pay before a download is ready." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const session = await createFoundingCheckout();
    await setCheckoutCookie(session.session_id);
    return NextResponse.json(
      { checkoutUrl: session.checkout_url, sessionId: session.session_id, version: release.version },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("checkout_failed", error);
    return NextResponse.json(
      { error: "Secure checkout is unavailable right now. No payment was started." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
