# NotchSignal — Open Source, License & Credits

NotchSignal is a substantially modified derivative of **Boring Notch**.

## License

The application is distributed under the GNU General Public License v3.0 (GPL-3.0). The original repository's `LICENSE`, copyright notices, and `THIRD_PARTY_LICENSES` are intentionally retained.

Selling access to a compiled NotchSignal binary does not make the derivative closed-source. Recipients keep the GPL rights that apply to the program, including access to the corresponding source code under GPL-3.0.

Corresponding source for each distributed build must be published from this repository and tied to the exact release tag/commit used for the binary.

## Upstream

- Boring Notch: https://github.com/TheBoredTeam/boring.notch
- Original license: GPL-3.0

NotchSignal retains the inherited notch/window behavior, media utilities, HUD features, shelf/AirDrop workflow, calendar/reminders, battery UI, mirror support, gestures, display sizing, animations, updater foundation, and other upstream components where useful.

## Substantial NotchSignal modifications

Beginning 25 September 2026, the fork adds or changes:

- agent-first product positioning and default navigation
- local Claude Code lifecycle / attention hooks
- local Codex process detection
- generic terminal-agent process adapters
- AI-agent status model and provider protocol
- attention routing and restrained auto-expansion
- jump-back behavior
- agent-scoped keep-awake
- local session history
- privacy boundaries for agent telemetry
- distinct NotchSignal bundle identity / release channel
- separate paid-download website and server-verified purchase flow
- release, notarization and gated-distribution automation

## Third-party dependencies

The existing repository's `THIRD_PARTY_LICENSES` remains authoritative for inherited dependencies. Any newly added dependency must be reviewed before release and added there or documented here with its license.

The macOS app currently adds no new third-party Swift package for the agent center.

## Privacy boundary

Agent monitoring is local-first. NotchSignal's app code must not upload or persist prompt text, source code, terminal contents, tool inputs, assistant outputs, or project files for analytics.

The Claude Code hook written by NotchSignal stores only lifecycle metadata required for status display: timestamp, Claude session id, current working directory, hook event name, tool name, notification type, and an error category if exposed.

## Release compliance checklist

Before publishing a paid binary:

1. Keep `LICENSE` and existing copyright notices.
2. Keep `THIRD_PARTY_LICENSES`.
3. Tag the exact commit used to build the binary.
4. Publish corresponding source for that tag.
5. Include or link this Credits / Open Source notice from the app and landing FAQ.
6. Do not describe the derivative application as proprietary or closed-source.
7. Re-audit licenses when dependencies change.
