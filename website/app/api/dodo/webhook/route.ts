import { NextResponse } from "next/server";
import { dodo, validateFoundingPayment } from "@/lib/dodo";
import { recordVerifiedPurchase, setPaymentStatus } from "@/lib/db";

export const runtime = "nodejs";

function paymentIdFromLifecycleEvent(event: any) {
  const value = event?.data?.payment_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const webhookId = request.headers.get("webhook-id") ?? "";

  let event: any;
  try {
    event = dodo().webhooks.unwrap(raw, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? ""
      }
    });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    if (event.type === "payment.succeeded") {
      const verified = validateFoundingPayment(event.data);
      await recordVerifiedPurchase({
        webhookId: webhookId || `payment:${verified.paymentId}`,
        ...verified
      });
      return NextResponse.json({ received: true });
    }

    const paymentId = paymentIdFromLifecycleEvent(event);

    if (event.type === "refund.succeeded" && paymentId) {
      await setPaymentStatus(paymentId, "refunded");
    } else if (
      ["dispute.opened", "dispute.accepted", "dispute.lost"].includes(event.type) &&
      paymentId
    ) {
      await setPaymentStatus(paymentId, "disputed");
    } else if (
      ["dispute.won", "dispute.cancelled"].includes(event.type) &&
      paymentId
    ) {
      await setPaymentStatus(paymentId, "succeeded");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("verified_webhook_rejected", error);
    return NextResponse.json(
      { error: "Verified Dodo event could not be applied." },
      { status: 422 }
    );
  }
}
