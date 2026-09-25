import { commerceConfig } from "./config";

export type Purchase = {
  id: string; email: string; payment_id: string; checkout_session_id: string | null;
  payment_status: string; amount: number; currency: string; product_version: string;
};

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${commerceConfig.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: commerceConfig.supabaseServiceKey,
      Authorization: `Bearer ${commerceConfig.supabaseServiceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Supabase REST ${response.status}: ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function recordVerifiedPurchase(input: {
  webhookId: string; email: string; paymentId: string; checkoutSessionId: string | null;
  amount: number; currency: string; productId: string;
}) {
  await rest("rpc/notchsignal_process_payment", {
    method: "POST",
    body: JSON.stringify({
      p_webhook_id: input.webhookId,
      p_email: input.email,
      p_payment_id: input.paymentId,
      p_checkout_session_id: input.checkoutSessionId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_product_id: input.productId,
      p_product_version: commerceConfig.version
    })
  });
}
export async function purchaseByCheckoutSession(sessionId: string) {
  const rows = await rest<Purchase[]>(
    `notchsignal_purchases?select=id,email,payment_id,checkout_session_id,payment_status,amount,currency,product_version&checkout_session_id=eq.${encodeURIComponent(sessionId)}&payment_status=eq.succeeded&limit=1`
  );
  return rows[0] ?? null;
}
export async function purchaseByEmail(email: string) {
  const rows = await rest<Purchase[]>(
    `notchsignal_purchases?select=id,email,payment_id,checkout_session_id,payment_status,amount,currency,product_version&email=eq.${encodeURIComponent(email.toLowerCase())}&payment_status=eq.succeeded&order=created_at.desc&limit=1`
  );
  return rows[0] ?? null;
}
export async function analyticsEvent(name: string, sessionId: string, purchaseId?: string | null, version?: string | null) {
  await rest("notchsignal_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      event_name: name, anonymous_session_id: sessionId,
      purchase_id: purchaseId ?? null, product_version: version ?? null
    })
  });
}
export type ReleaseManifest = {
  version: string;
  storage_object: string;
  sha256: string;
  release_notes: string;
  source_url: string;
  minimum_macos: string;
  architectures: string[];
};

export async function currentRelease(): Promise<ReleaseManifest | null> {
  const rows = await rest<ReleaseManifest[]>(
    "notchsignal_releases?select=version,storage_object,sha256,release_notes,source_url,minimum_macos,architectures&is_current=eq.true&limit=1"
  );
  return rows[0] ?? null;
}

export async function privateDownloadURL(storageObject?: string) {
  const object = storageObject ?? commerceConfig.objectPath;
  const path = object.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${commerceConfig.supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(commerceConfig.bucket)}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: commerceConfig.supabaseServiceKey,
        Authorization: `Bearer ${commerceConfig.supabaseServiceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ expiresIn: 90 })
    }
  );
  if (!response.ok) throw new Error(`Storage signing failed: ${response.status}`);
  const body = await response.json() as { signedURL?: string; signedUrl?: string };
  const signed = body.signedURL ?? body.signedUrl;
  if (!signed) throw new Error("Storage did not return a signed URL.");
  return signed.startsWith("http") ? signed : `${commerceConfig.supabaseUrl}/storage/v1${signed}`;
}
