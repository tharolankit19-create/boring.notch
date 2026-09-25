import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotchSignal — Your AI agents, right in the notch",
  description: "See what is running, know when an AI coding agent needs you, and jump back without checking five terminals."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
