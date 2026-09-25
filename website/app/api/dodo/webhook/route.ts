import { NextResponse } from "next/server";
import { dodo, validateFoundingPayment } from "@/lib/dodo";
import { recordVerifiedPurchase } from "@/lib/db";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  const webhookId = request.headers.get("webhook-id") ?? "";
  let event: any;
  try {
    event = dodo().webhooks.unwrap(raw, { headers: {
      "webhook-id": webhookId,
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? ""
    }});
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  if (event.type !== "payment.succeeded") return NextResponse.json({ received: true });
  try {
    const verified = validateFoundingPayment(event.data);
    await recordVerifiedPurchase({ webhookId: webhookId || `payment:${verified.paymentId}`, ...verified });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("verified_webhook_rejected", error);
    return NextResponse.json({ error: "Payment payload did not match NotchSignal." }, { status: 422 });
  }
}
