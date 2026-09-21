# TEMP 012B Resume And Closeout Checkpoint

## Current State

CCPP-012B implementation is complete and feature expansion remains paused.
This continuation is documentation, static closeout, and EOMD packaging only.

Do not restart implementation, redesign the accepted player pages, rerun the
visual browser batch, or begin leagues, AI, animations, avatars, venues,
prizes, quiz gameplay, or another milestone.

## State Established After Remote Compaction

Read during closeout:

- `AGENTS.md`
- this checkpoint
- current git status/diff
- CCPP-012B docs and updated platform/core docs
- `docs/MAP_Rooster_Assets.md`
- current player visual source and focused tests
- retained browser evidence directory

The interrupted transcript reported:

- visual/personality implementation completed;
- focused identity and visual unit tests passed: 28 tests;
- typecheck passed before browser evidence;
- final focused browser visual batch passed;
- screenshot evidence was inspected and accepted;
- no further visual-polish loop was intended.

The working tree confirmed the implementation and docs existed. The only asset
map finding was that no `docs/MAP_Rooster_Assets.md` edit had landed before
compaction: `git diff -- docs/MAP_Rooster_Assets.md` was empty, and the file
still described the prepared frames primarily as Match Result animation assets.
This closeout updated the asset map instead of replaying implementation.

## Preserved Implementation

The accepted source preserves:

- semantic `--rr-*` token foundation and Tailwind `rr.*` aliases;
- player-facing colour hierarchy;
- shared player UI primitives under `imports/ui/components/player/`;
- `RugbyRoosterPersonality` mood mapping;
- `StatusBadge`;
- `PlayerPage`, `PlayerPageHeader`, `PlayerSurface`, loading, empty, and error
  primitives;
- `PublicLayout` token/icon integration;
- Home, Games, Game Detail, Prediction shell, Leaderboard, My Score, and
  Account visual refreshes;
- hidden ordinary-player result revision display on Leaderboard;
- Account split between public display name and private email/account details.

This checkpoint intentionally does not change:

- prediction mechanics;
- leaderboard ranking;
- score math;
- refresh behavior;
- auth;
- Match Result animation;
- numeric micro-interactions.

## 012A Validation Hardening Closure

`validatePlayerDisplayName(...)` rejects Unicode control characters and Unicode
format-control characters with `[\p{Cc}\p{Cf}]`.

Focused identity tests cover:

- U+200B ZERO WIDTH SPACE;
- U+202E RIGHT-TO-LEFT OVERRIDE;
- U+2060 WORD JOINER.

Legitimate Unicode names, diacritics, trim/whitespace normalization, existing
length limits, and reserved-name behavior remain preserved. No profanity,
moderation, fuzzy impersonation, handle, avatar, or profile tooling was added.

## Actual Rooster Asset Classification

Active static UI assets:

- `public/assets/rooster/match-result/frames/rooster-run-1.png`
- `public/assets/rooster/match-result/frames/rooster-run-2.png`
- `public/assets/rooster/match-result/frames/rooster-run-3.png`
- `public/assets/rooster/match-result/frames/rooster-run-4.png`
- `public/assets/rooster/match-result/frames/rooster-push-1.png`
- `public/assets/rooster/match-result/frames/rooster-push-2.png`
- `public/assets/rooster/match-result/frames/rooster-push-4.png`
- `public/icons/rr-icon-192.png`

Animation-specific retained assets:

- `public/assets/rooster/match-result/frames/rooster-run-1.png` through
  `rooster-run-4.png`
- `public/assets/rooster/match-result/frames/rooster-push-1.png` through
  `rooster-push-4.png`
- `public/assets/rooster/match-result/rooster-shove-atlas.png`
- `public/assets/rooster/match-result/rooster-shove-manifest.json`
- `imports/ui/predictions/kaplay/roosterShoveManifest.generated.json`

Reference / historical assets:

- `assets/source/rooster/cartoon_rooster_running_sprite_sheet.png`
- `assets/source/rooster/rooster_animation_loops_reference_sheet.png`
- `public/favicon.svg`
- `public/icons/apple-touch-icon.png`
- `public/icons/rr-icon-512.png`
- `public/icons/rr-icon-source.svg`
- `public/icons/rr-maskable-512.png`
- `public/icons/rr-maskable-source.svg`

There are no standalone expression PNGs for cooked, crying, tantrum, shocked,
or similar historical concept moods. The current static catalog is small and
derived from prepared run/push stills plus the app icon fallback.

## Retained Browser Evidence

Do not rerun Playwright for this closeout. The accepted evidence root is:

- `test-results/ccpp012b-visual-foundation-personality-final/`

Retained screenshots include:

- `desktop-home.png`
- `desktop-games.png`
- `desktop-game-detail.png`
- `desktop-prediction.png`
- `desktop-leaderboard-provisional.png`
- `desktop-leaderboard-final.png`
- `desktop-my-score.png`
- `desktop-account.png`
- `desktop-empty-fixture-not-found.png`
- `desktop-error-retry.png`
- `mobile-390-games.png`
- `mobile-390-game-detail.png`
- `mobile-360-leaderboard.png`
- `mobile-360-my-score.png`
- `mobile-390-account.png`

Manual inspection before compaction accepted the screenshots for coherent colour
hierarchy, stronger green primary actions, controlled Rooster use, more
competitive Leaderboard treatment, clean mobile layouts, My Score explanation
stacking, and personality-aware empty/error states.

Browser execution history to preserve:

- first browser attempt exited before tests due sandbox/local launch boundary;
- escalated run reached the app but exposed a visual-spec assumption issue on
  Games because older unowned local fixtures were still present;
- the visual spec was corrected to use a fixture-not-found empty-state path and
  not assume isolated reset removed unrelated old fixtures;
- one correction browser run passed;
- final screenshots were manually inspected;
- no further visual-polish run was performed.

These launcher/test-flow corrections are not application failures.

## Closeout Checks

Static closeout checks were run against current final source only. Browser
tests, animation suites, broad scoring suites, broad auth browser suites, and
unrelated admin/result suites were not run.

Closeout results:

- focused identity and visual primitive tests passed: 2 files / 28 tests;
- typecheck passed;
- lint passed after two narrow React-rule cleanup edits;
- project invariants passed;
- changed-file Prettier check passed after Markdown formatting;
- `git diff --check` passed.

The retained browser screenshots predate the two lint-only presentation source
cleanups. No visual-polish loop was restarted.

## EOMD Package

Final archive path:

- `rugby-rooster-ccpp012b-visual-foundation-personality-eomd-20260921.zip`

The final package must include only closeout-relevant source, docs, focused
tests, actual personality assets, and retained final screenshots. It must
exclude credentials, private settings, `node_modules`, `.meteor/local`,
build/cache directories, unused giant reference artwork, unrelated historical
animation evidence, and old archives.

Package verification is recorded in
`docs/AUDIT_012B_Visual_Foundation_Personality.md`.

Package verification completed:

- ZIP integrity passed with `unzip -t`;
- archive listing confirmed source, focused tests, docs, retained final
  evidence, and actual used personality assets are included;
- extracted screenshots opened as PNG image data through `file`;
- extracted personality assets opened as PNG image data through `file`;
- referenced personality asset paths exist in the original repository;
- negative checks found no `assets/source/rooster/` source sheets,
  `node_modules`, or `.meteor/local` entries;
- original repository files remained in place.
