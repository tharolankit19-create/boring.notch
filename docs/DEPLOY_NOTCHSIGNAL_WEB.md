# NotchSignal web production deployment

The production website is deployed from `website/` through the manual workflow:

`.github/workflows/notchsignal_web_deploy.yml`

## Required GitHub production secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The Vercel project must have the production variables from `website/.env.example`, including live Dodo, Supabase, Resend, access-token and final `APP_URL` values.

## Promotion gate

The workflow intentionally does not deploy straight to the production alias.

1. Pull Vercel production environment.
2. Build the exact production bundle.
3. Deploy an isolated URL.
4. Smoke-test the landing page and download page.
5. When production promotion is requested, require `GET /api/ready` to return `200` with `ready: true`.
6. Promote that exact verified deployment.

`/api/ready` only becomes ready when the current release manifest points to a real private DMG object, so production commerce cannot be promoted before a downloadable signed release exists.

## Launch order

1. Configure Vercel secrets/environment.
2. Configure the live Dodo one-time, tax-inclusive USD $5 product and webhook.
3. Configure Apple Developer ID/notarization secrets in GitHub Actions.
4. Run the NotchSignal signed release workflow.
5. Confirm the signed DMG/release manifest gate is ready.
6. Run **Deploy NotchSignal Web** with production promotion enabled.
7. Complete one real or provider-approved live-mode end-to-end checkout verification before sending public traffic.
