import { NextResponse } from "next/server";
import { currentRelease } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const release = await currentRelease();
    if (!release) {
      return NextResponse.json(
        { ready: false, reason: "no_signed_release" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        ready: true,
        version: release.version,
        minimumMacOS: release.minimum_macos,
        architectures: release.architectures
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ready: false, reason: "release_store_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
