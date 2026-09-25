import { NextResponse } from "next/server";
import { commerceConfig } from "@/lib/config";
import { currentRelease } from "@/lib/db";

export async function GET() {
  const release = await currentRelease();
  if (!release) {
    return NextResponse.json({
      version: null,
      releaseNotes: "No signed release has been published yet.",
      updateUrl: `${commerceConfig.appUrl}/download`,
      sourceUrl: process.env.NOTCHSIGNAL_SOURCE_URL ?? "https://github.com/tharolankit19-create/boring.notch",
      minimumMacOS: "14.0",
      architectures: []
    }, { status: 503 });
  }

  return NextResponse.json({
    version: release.version,
    releaseNotes: release.release_notes,
    updateUrl: `${commerceConfig.appUrl}/download`,
    sourceUrl: release.source_url,
    sha256: release.sha256,
    minimumMacOS: release.minimum_macos,
    architectures: release.architectures
  });
}
