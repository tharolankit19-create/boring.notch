# NotchSignal website

Production landing, Dodo checkout, server-verified purchase access, magic-link recovery, private DMG download, version endpoint and privacy-safe landing analytics.

## Deployment

1. Apply `supabase/migrations/001_notchsignal_commerce.sql`.
2. Create a **private** Supabase Storage bucket named `notchsignal-releases`.
3. Create a Dodo one-time product priced at exactly USD $5 and set `DODO_NOTCHSIGNAL_PRODUCT_ID`.
4. Configure Dodo webhook `POST /api/dodo/webhook` for `payment.succeeded`.
5. Configure all values from `.env.example` in the hosting platform.
6. Configure Resend (or replace `lib/email.ts`) for purchase-access email.
7. Deploy and set `APP_URL` to the final HTTPS origin.
8. Upload only a signed, notarized, stapled DMG to the configured private Storage object.

## Security properties

- Redirects never unlock downloads.
- Webhooks are signature-verified with Dodo's SDK.
- Delayed webhooks can be reconciled against Dodo server-side.
- Product id, amount and currency are checked before purchase recording.
- Webhook/purchase recording is atomic and replay-safe through Postgres.
- DMGs stay private; authorized downloads use a short-lived signed Storage URL.
- Magic-link recovery does not reveal whether an email exists.
- Access links are HMAC-signed and expire in one hour.
- Commerce analytics never receives source code, prompts or agent telemetry.
