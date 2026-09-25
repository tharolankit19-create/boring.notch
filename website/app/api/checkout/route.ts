import { NextResponse } from "next/server";
import { createFoundingCheckout } from "@/lib/dodo";
import { setCheckoutCookie } from "@/lib/access";
export const runtime = "nodejs";
export async function POST() {
  try {
    const session = await createFoundingCheckout();
    await setCheckoutCookie(session.session_id);
    return NextResponse.json({ checkoutUrl: session.checkout_url, sessionId: session.session_id });
  } catch (error) {
    console.error("checkout_failed", error);
    return NextResponse.json({ error: "Checkout is unavailable right now." }, { status: 502 });
  }
}
