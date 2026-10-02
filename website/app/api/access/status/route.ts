import { NextResponse } from "next/server";
import { checkoutSessionFromCookie, verifyAccessToken } from "@/lib/access";
import { purchaseByCheckoutSession, purchaseByEmail, recordVerifiedPurchase } from "@/lib/db";
import { reconcileCheckout } from "@/lib/dodo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const access = verifyAccessToken(url.searchParams.get("token"));

    if (access) {
      const purchase = await purchaseByEmail(access.email);
      return NextResponse.json(
        { paid: Boolean(purchase), version: purchase?.product_version ?? null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Checkout access is bound to the HMAC-signed HttpOnly cookie we issued
    // before redirecting to Dodo. A raw checkout session id from the URL is
    // intentionally not accepted as an entitlement credential.
    const sessionId = await checkoutSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json(
        { paid: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    let purchase = await purchaseByCheckoutSession(sessionId);
    if (!purchase) {
      const verified = await reconcileCheckout(sessionId);
      if (verified) {
        await recordVerifiedPurchase({
          webhookId: `reconcile:${verified.paymentId}`,
          ...verified
        });
        purchase = await purchaseByCheckoutSession(sessionId);
      }
    }

    return NextResponse.json(
      { paid: Boolean(purchase), version: purchase?.product_version ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("access_status_failed", error);
    return NextResponse.json(
      { paid: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
