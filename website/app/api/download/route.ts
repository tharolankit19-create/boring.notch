import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { checkoutSessionFromCookie, verifyAccessToken } from "@/lib/access";
import { analyticsEvent, currentRelease, privateDownloadURL, purchaseByCheckoutSession, purchaseByEmail } from "@/lib/db";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const access = verifyAccessToken(new URL(request.url).searchParams.get("token"));
    const sessionId = access ? null : await checkoutSessionFromCookie();
    const purchase = access
      ? await purchaseByEmail(access.email)
      : sessionId ? await purchaseByCheckoutSession(sessionId) : null;
    if (!purchase) return NextResponse.json({ error: "Purchase access required." }, { status: 403 });

    const release = await currentRelease();
    if (!release) return NextResponse.json({ error: "No signed release is published yet." }, { status: 503 });

    await analyticsEvent("download_started", crypto.randomUUID(), purchase.id, release.version);
    return NextResponse.redirect(await privateDownloadURL(release.storage_object), { status: 302 });
  } catch (error) {
    console.error("download_failed", error);
    return NextResponse.json({ error: "Download is temporarily unavailable." }, { status: 503 });
  }
}
