# NotchSignal website

Production landing, animated MacBook product demo, Dodo checkout, server-verified purchase access, magic-link recovery, private DMG download, version endpoint and privacy-safe landing analytics.

## Deployment

1. Apply `supabase/migrations/001_notchsignal_commerce.sql`, `002_notchsignal_entitlement_revocation.sql`, `003_notchsignal_rpc_lockdown.sql`, `004_notchsignal_release_object_gate.sql`, `005_notchsignal_table_grants.sql`, and `006_notchsignal_entitlement_state_machine.sql`.
2. Create a **private** Supabase Storage bucket named `notchsignal-releases`.
3. Create a Dodo **one-time, tax-inclusive** product whose buyer total is exactly USD $5 and set `DODO_NOTCHSIGNAL_PRODUCT_ID`. Checkout preflight rejects any other price/type.
4. Configure Dodo webhook `POST /api/dodo/webhook` for `payment.succeeded`, `refund.succeeded`, and dispute lifecycle events.
5. Configure all values from `.env.example` in the hosting platform.
6. Configure Resend (or replace `lib/email.ts`) for purchase-access email.
7. Deploy and set `APP_URL` to the final HTTPS origin.
8. Run the signed release workflow so the notarized DMG is uploaded and a current release manifest is published.
9. Verify `GET /api/ready` returns `200` with `ready: true`.
10. Only then open checkout traffic.

## Payment / download safety

- Checkout is closed unless a current signed release manifest **and its private Storage DMG object** both exist, so a buyer cannot pay and then hit a missing-download error.
- Before a checkout session is created, Dodo preview must confirm one one-time product, quantity 1, tax-inclusive USD $5.00; discounts and currency switching are disabled.
- Dodo's browser return `session_id` is never trusted on its own; it is reconciled server-side.
- Redirects never unlock downloads.
- Webhooks are signature-verified with Dodo's SDK.
- Commerce/release SECURITY DEFINER RPCs are executable only by the server-side `service_role`; browser roles cannot call them.
- Browser roles also have their direct table/sequence privileges revoked for the NotchSignal commerce schema; RLS remains enabled as a second deny layer.
- Delayed webhooks can be reconciled against Dodo server-side.
- Product id, amount (500 minor units), currency (USD) and quantity are checked before purchase recording.
- Webhook/purchase recording is atomic and replay-safe through Postgres.
- Refund/dispute lifecycle events revoke purchase entitlement; a won/cancelled dispute can restore it unless the purchase was already refunded.
- Later `payment.succeeded` deliveries or checkout reconciliation cannot resurrect a refunded/disputed entitlement. Server reconciliation also rejects Dodo payments that already report refunds or unresolved/lost disputes.
- DMGs stay private; authorized downloads use a short-lived signed Storage URL.
- Magic-link recovery does not reveal whether an email exists.
- Access links are HMAC-signed and expire in one hour.
- Commerce analytics never receives source code, prompts or agent telemetry.

## Go-live test

Before public launch, complete one full Dodo **test-mode** purchase and verify this sequence:

`checkout → Dodo return → /download confirms server-side payment → private signed URL → DMG downloads`

Then send a signed test webhook for a refund and confirm the same purchase no longer unlocks `/api/download`. Switch to live-mode keys only after the test-mode flow passes.


## Production web deployment workflow

`.github/workflows/notchsignal_web_deploy.yml` is intentionally manual and fail-closed.

Required GitHub Environment/Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The workflow pulls the production environment, builds with Vercel, deploys an isolated preview, smoke-tests the landing/download pages, and only promotes that exact deployment to production when `/api/ready` confirms a real private signed NotchSignal release is downloadable. This prevents a public $5 checkout from being promoted while the binary release gate is incomplete.
