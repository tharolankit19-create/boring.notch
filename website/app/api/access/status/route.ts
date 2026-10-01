import { NextResponse } from "next/server";
import { checkoutSessionFromCookie, setCheckoutCookie, verifyAccessToken } from "@/lib/access";
import { purchaseByCheckoutSession, purchaseByEmail, recordVerifiedPurchase } from "@/lib/db";
import { reconcileCheckout } from "@/lib/dodo";

export const runtime = "nodejs";

function safeCheckoutSession(value: string | null) {
  if (!value) return null;
  return /^cks_[A-Za-z0-9_-]{6,200}$/.test(value) ? value : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const access = verifyAccessToken(token);

    if (access) {
      const purchase = await purchaseByEmail(access.email);
      return NextResponse.json(
        { paid: Boolean(purchase), version: purchase?.product_version ?? null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const returnedSession = safeCheckoutSession(url.searchParams.get("session_id"));
    const sessionId = returnedSession ?? await checkoutSessionFromCookie();
    if (!sessionId) {
      return NextResponse.json({ paid: false }, { headers: { "Cache-Control": "no-store" } });
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

    if (purchase && returnedSession) {
      await setCheckoutCookie(returnedSession);
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
