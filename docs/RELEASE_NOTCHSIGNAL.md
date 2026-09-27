# NotchSignal release operations

## Current state

- Universal unsigned DMG smoke build: automated and verified on CI.
- Production signing/notarization: automated by `.github/workflows/notchsignal_release.yml`, but it cannot complete until the required Apple and storage secrets exist.
- Corresponding GPL source: every production release creates a `notchsignal-vX.Y.Z` source tag and GitHub source release.
- Buyer download: the signed DMG is uploaded to the private `notchsignal-releases` Supabase Storage bucket, then the current release manifest is atomically updated.

## Required GitHub Actions secrets

Never commit these values.

- `BUILD_CERTIFICATE_BASE64`: base64-encoded Developer ID Application .p12
- `P12_PASSWORD`
- `KEYCHAIN_PASSWORD`: ephemeral CI keychain password
- `APPLE_DEVELOPER_ID_APPLICATION`: exact identity, e.g. `Developer ID Application: Company (TEAMID)`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `NOTCHSIGNAL_SUPABASE_URL`
- `NOTCHSIGNAL_SUPABASE_SERVICE_ROLE_KEY`

## Apple credential preparation

On a trusted Mac with the Developer ID certificate installed:

```bash
security find-identity -v -p codesigning
security export -k ~/Library/Keychains/login.keychain-db \
  -t identities \
  -f pkcs12 \
  -P 'TEMP_EXPORT_PASSWORD' \
  -o DeveloperIDApplication.p12
base64 < DeveloperIDApplication.p12 | tr -d '\n'
```

Create an app-specific password for the Apple ID used by the notarization service. Store it only as an Actions secret.

## Manual local equivalent

After a signed build:

```bash
ditto -c -k --keepParent NotchSignal.app NotchSignal.zip
xcrun notarytool submit NotchSignal.zip \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --wait
xcrun stapler staple NotchSignal.app
xcrun stapler validate NotchSignal.app
spctl -a -vvv -t exec NotchSignal.app
```

Then create/sign/notarize the DMG and verify it:

```bash
codesign --force --timestamp --sign "$APPLE_DEVELOPER_ID_APPLICATION" NotchSignal-0.1.0.dmg
xcrun notarytool submit NotchSignal-0.1.0.dmg \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --wait
xcrun stapler staple NotchSignal-0.1.0.dmg
xcrun stapler validate NotchSignal-0.1.0.dmg
hdiutil verify NotchSignal-0.1.0.dmg
shasum -a 256 NotchSignal-0.1.0.dmg
```

## Website deployment

Deploy `website/` as a Next.js app. Configure every variable in `website/.env.example`. Dodo must send `payment.succeeded` to `/api/dodo/webhook`.

A checkout redirect alone never grants access. Download authorization requires a verified server-side purchase row.

## Update model

The founding release uses the server endpoint `/api/releases/latest` plus a purchase-gated update/download page. The inherited Sparkle public key was intentionally removed; do not re-enable Sparkle until a dedicated NotchSignal keypair and an authenticated update-distribution design are in place.
