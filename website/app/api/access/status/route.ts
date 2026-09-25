import { NextResponse } from "next/server";
import { checkoutSessionFromCookie, verifyAccessToken } from "@/lib/access";
import { purchaseByCheckoutSession, purchaseByEmail, recordVerifiedPurchase } from "@/lib/db";
import { reconcileCheckout } from "@/lib/dodo";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    const access = verifyAccessToken(token);
    if (access) {
      const purchase = await purchaseByEmail(access.email);
      return NextResponse.json({ paid: Boolean(purchase), version: purchase?.product_version ?? null });
    }
    const sessionId = await checkoutSessionFromCookie();
    if (!sessionId) return NextResponse.json({ paid: false });

    let purchase = await purchaseByCheckoutSession(sessionId);
    if (!purchase) {
      const verified = await reconcileCheckout(sessionId);
      if (verified) {
        await recordVerifiedPurchase({ webhookId: `reconcile:${verified.paymentId}`, ...verified });
        purchase = await purchaseByCheckoutSession(sessionId);
      }
    }
    return NextResponse.json({ paid: Boolean(purchase), version: purchase?.product_version ?? null });
  } catch (error) {
    console.error("access_status_failed", error);
    return NextResponse.json({ paid: false });
  }
}
