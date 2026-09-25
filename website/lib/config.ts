export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const commerceConfig = {
  get appUrl() { return required("APP_URL").replace(/\/$/, ""); },
  get productId() { return required("DODO_NOTCHSIGNAL_PRODUCT_ID"); },
  get amountMinor() { return Number(process.env.NOTCHSIGNAL_PRICE_MINOR ?? "500"); },
  get currency() { return (process.env.NOTCHSIGNAL_CURRENCY ?? "USD").toUpperCase(); },
  get supabaseUrl() { return required("SUPABASE_URL").replace(/\/$/, ""); },
  get supabaseServiceKey() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get bucket() { return process.env.NOTCHSIGNAL_DOWNLOAD_BUCKET ?? "notchsignal-releases"; },
  get objectPath() { return process.env.NOTCHSIGNAL_DOWNLOAD_OBJECT ?? "NotchSignal-0.1.0.dmg"; },
  get version() { return process.env.NOTCHSIGNAL_LATEST_VERSION ?? "0.1.0"; }
};
