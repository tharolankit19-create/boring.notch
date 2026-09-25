import { NextResponse } from "next/server";
import { commerceConfig } from "@/lib/config";
export async function GET() {
  return NextResponse.json({
    version: commerceConfig.version,
    releaseNotes: process.env.NOTCHSIGNAL_RELEASE_NOTES ?? "Founding release",
    updateUrl: `${commerceConfig.appUrl}/download`,
    sourceUrl: process.env.NOTCHSIGNAL_SOURCE_URL ?? "https://github.com/tharolankit19-create/boring.notch",
    minimumMacOS: "14.0",
    architectures: ["arm64", "x86_64"]
  });
}
