import crypto from "node:crypto";
import { cookies } from "next/headers";
import { required } from "./config";

const COOKIE = "notchsignal_checkout";
function signature(value: string) {
  return crypto.createHmac("sha256", required("ACCESS_TOKEN_SECRET")).update(value).digest("base64url");
}
export function signCheckoutSession(sessionId: string) {
  return `${sessionId}.${signature(sessionId)}`;
}
export function verifyCheckoutSession(value?: string | null): string | null {
  if (!value) return null;
  const split = value.lastIndexOf(".");
  if (split < 1) return null;
  const sessionId = value.slice(0, split);
  const supplied = Buffer.from(value.slice(split + 1));
  const expected = Buffer.from(signature(sessionId));
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  return sessionId.startsWith("cks_") ? sessionId : null;
}
export async function checkoutSessionFromCookie() {
  const jar = await cookies();
  return verifyCheckoutSession(jar.get(COOKIE)?.value);
}
export async function setCheckoutCookie(sessionId: string) {
  const jar = await cookies();
  jar.set(COOKIE, signCheckoutSession(sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

type AccessPayload = { email: string; exp: number; nonce: string };
export function createAccessToken(email: string, ttlSeconds = 3600) {
  const payload: AccessPayload = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomUUID()
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}
export function verifyAccessToken(token?: string | null): AccessPayload | null {
  if (!token) return null;
  const split = token.lastIndexOf(".");
  if (split < 1) return null;
  const encoded = token.slice(0, split);
  const supplied = Buffer.from(token.slice(split + 1));
  const expected = Buffer.from(signature(encoded));
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AccessPayload;
    if (!payload.email || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
