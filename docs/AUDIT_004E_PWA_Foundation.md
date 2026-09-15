# AUDIT 004E - PWA Foundation

## Scope

CCPP-004E adds a minimal Progressive Web App foundation for Rugby Rooster:
manifest metadata, temporary app icons, standalone mobile metadata, safe-area
layout support, and focused browser coverage.

This task does not add a service worker, offline support, caching, push
notifications, in-app install prompts, auth changes, HMR changes, database
changes, email changes, fixture work, deployment, or Rugby Tracker / Rucks and
Mauls behaviour.

## Recovery Note

This audit was completed after a prior Codex session was interrupted during
remote context compaction with:

```text
HTTP 404 at /backend-api/codex/responses/compact
```

The resumed work recovered from repository state instead of recreating reported
work. Existing generated icon assets were preserved.

## Implemented Behaviour

- Rugby Rooster exposes `/site.webmanifest` from `public/site.webmanifest`.
- The manifest starts installed sessions at `/games`, stays scoped to `/`, uses
  standalone display, and provides standard plus maskable PNG icons.
- `client/main.html` links the manifest, SVG favicon, Apple touch icon, and
  mobile standalone metadata.
- The app has exactly one viewport declaration and it includes
  `viewport-fit=cover`.
- Public and admin layouts use safe-area-aware shell classes.
- The public shell preserves bottom safe-area padding on the footer.
- The admin shell uses the same top and side safe-area handling.
- The app intentionally has no service worker source, registration, cache
  strategy, offline fallback, push handling, or update/reload handling.

## Server Header Hook

`imports/server/pwa/server.ts` registers a narrow raw connect handler for the
manifest content type:

- It compares only the path before query parameters.
- It matches only `/site.webmanifest`.
- It sets `Content-Type` to `application/manifest+json; charset=utf-8`.
- It always calls `next()`.

The hook does not send, end, redirect, or replace the response. Meteor's normal
static-file handler remains responsible for returning the manifest body.

## Files Changed

- `client/main.css`
- `client/main.html`
- `imports/server/pwa/server.ts`
- `imports/ui/layouts/AdminLayout.tsx`
- `imports/ui/layouts/PublicLayout.tsx`
- `public/icons/apple-touch-icon.png`
- `public/icons/rr-icon-192.png`
- `public/icons/rr-icon-512.png`
- `public/icons/rr-icon-source.svg`
- `public/icons/rr-maskable-512.png`
- `public/icons/rr-maskable-source.svg`
- `public/site.webmanifest`
- `server/main.ts`
- `tests/e2e/foundation.spec.ts`
- `docs/AUDIT_004E_PWA_Foundation.md`
- `docs/CORE_Build_Plan.md`
- `docs/MAP_System.md`
- `docs/PLATFORM_Architecture.md`
- `docs/PLATFORM_PWA.md`
- `docs/PLATFORM_Testing.md`
- `docs/TEMP_004D_Known_Navigation_Issue.md`
- `docs/TEMP_004D_Resume.md`
- `docs/TEMP_004E_Resume.md`

## Verification

Current-session checks run on September 15, 2026:

| Command                                                                                                                                                             | Result                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short`                                                                                                                                                | Confirmed interrupted-session edits and generated PWA files were present before resumed edits.                                                                              |
| `file public/icons/*.png public/icons/*.svg public/site.webmanifest public/favicon.svg`                                                                             | Confirmed PNG dimensions: Apple 180 x 180, standard 192 x 192 and 512 x 512, maskable 512 x 512; confirmed SVG sources and JSON manifest file type.                         |
| `rg -n "serviceWorker\|service worker\|navigator\\.serviceWorker\|workbox\|sw\\.js\|manifest\|apple-mobile-web-app\|viewport-fit\|safe-area\|site.webmanifest" ...` | Found only the expected metadata, safe-area CSS, PWA server hook, and negative browser assertions.                                                                          |
| `find public -maxdepth 3 -type f -name '*sw*' -o -name 'service-worker*' -o -name 'sw.js'`                                                                          | Found no service worker files.                                                                                                                                              |
| `meteor npm exec prettier -- --write <changed CCPP-004E source/test/docs>`                                                                                          | Passed. Prettier formatted `client/main.html`, `tests/e2e/foundation.spec.ts`, and this audit during resumed work.                                                          |
| `meteor npm run typecheck`                                                                                                                                          | Initially failed on two new `tests/e2e/foundation.spec.ts` TypeScript issues: optional `start_url` passed to `URL`, and string icon paths indexing a literal-path record.   |
| `meteor npm run typecheck` after the targeted test typing correction                                                                                                | Passed.                                                                                                                                                                     |
| `meteor npm run lint`                                                                                                                                               | Passed.                                                                                                                                                                     |
| `meteor npm run lint:project`                                                                                                                                       | Passed. Project invariant check passed.                                                                                                                                     |
| `meteor npm exec prettier -- --check <changed CCPP-004E source/test/docs>`                                                                                          | Passed. All matched files use Prettier style.                                                                                                                               |
| `git diff --check`                                                                                                                                                  | Passed with no whitespace errors.                                                                                                                                           |
| `meteor npm run test:e2e -- foundation.spec.ts`                                                                                                                     | First run failed 1 of 10 tests: the CCPP-004E PWA metadata test passed, but an older `/admin` foundation assertion still expected pre-004D copy.                            |
| `meteor npm run test:e2e -- foundation.spec.ts` after updating the stale admin-copy assertion                                                                       | Passed: 10 Chromium tests. This verified manifest metadata/header/body, icon responses and dimensions, `/games`, desktop/mobile layout, and no service worker registration. |

The prior interrupted session reportedly inspected the standard and maskable PNG
icons visually. This resumed session reused that evidence because the generated
icon files were preserved and were not regenerated.

No real-device installation was tested. No auth browser suite was rerun for this
PWA task.

## CCPP-004D Deferral

The intermittent CCPP-004D auth browser navigation/full-suite issue remains
unresolved and explicitly deferred. It is preserved in
`docs/TEMP_004D_Known_Navigation_Issue.md` and `docs/TEMP_004D_Resume.md`.

CCPP-004E did not change auth implementation, auth tests, HMR/Rspack settings,
database isolation, email transport, or admin grants.

## Manual Installation Limits

Manual installation instructions are documented in `docs/PLATFORM_PWA.md`.
Browser install prompts and criteria vary by browser and platform. Because this
milestone intentionally has no service worker, installed app launches still
require a reachable Rugby Rooster server and network connection.

## EOMD Archive

EOMD archive:

```text
rugby-rooster-ccpp004e-pwa-foundation-eomd-20260915.zip
```

The archive contains only the changed CCPP-004E source/config surface,
manifest, icons, browser test, and documentation files listed in this audit. It
excludes local settings, secrets, login links, Playwright traces, test-results,
build output, older review ZIPs, and sensitive runtime artifacts.
