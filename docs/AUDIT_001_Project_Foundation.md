# AUDIT 001 - Project Foundation

## Status

Pass. CCPP-001 is implemented without committing, pushing, or deploying.

## Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Meteor React TypeScript app exists at repository root. | Pass | `.meteor/release:1`, `package.json:39-46`, `client/main.tsx:1-10`, `server/main.ts:1-7`. |
| 2 | Meteor remains pinned to 3.5.1. | Pass | `.meteor/release:1`; `meteor --version` returned `Meteor 3.5.1`. |
| 3 | Tailwind styling works. | Pass | `client/main.css:1-47`, `tailwind.config.cjs:1-31`, `postcss.config.js:1-6`; Playwright saw home hero background `rgb(34, 111, 84)` from `bg-rooster-grass`. |
| 4 | Specified routes and layouts render. | Pass | `imports/shared/routes.ts:12-49`, `imports/ui/App.tsx:77-102`; Playwright rendered `/`, `/games`, `/admin`, and `/not-a-route`. |
| 5 | Mobile layout is usable without horizontal overflow. | Pass | Playwright at `390x844`: `/`, `/games`, and `/admin` each reported `scrollWidth: 390`, `bodyScrollWidth: 390`, `hasHorizontalOverflow: false`. |
| 6 | Admin placeholder exposes no privileged functionality. | Pass | `imports/ui/pages/AdminPage.tsx:7-11`; Playwright at desktop and mobile reported `buttons: 0`, `forms: 0`, `fields: 0`. |
| 7 | `insecure` and `autopublish` are absent. | Pass | `.meteor/packages:7-25`; `meteor npm run lint` enforces absence and passed. |
| 8 | Documented lint, formatting-check, and TypeScript-check commands pass. | Pass | `package.json:4-10`, `README.md:24-41`; all commands passed. |
| 9 | Documentation and ongoing documentation instructions exist. | Pass | `AGENTS.md:5-24`, `README.md:43-56`, `docs/MAP_System.md:3-38`. |
| 10 | No later-milestone features are represented as implemented. | Pass | `docs/CORE_Product.md:22-27`, `docs/CORE_Build_Plan.md:25-31`, `server/main.ts:3-7`; lint rejects starter publications and premature collections. |

## Files Changed

- `.gitignore` - ignores local Playwright MCP artifacts.
- `AGENTS.md` - future-task rules for product identity, documentation, verification, secrets, and unresolved decisions.
- `README.md` - project overview, stack, routes, and documented commands.
- `client/main.html` - Rugby Rooster title, viewport metadata, and favicon link.
- `client/main.tsx` - React startup and global CSS import.
- `client/main.css` - Tailwind directives, design tokens, base styles, and focus utility.
- `server/main.ts` - removes tutorial seeding/publication and keeps server startup neutral.
- `imports/api/links.ts` - removed starter tutorial collection.
- `imports/ui/Hello.tsx` - removed starter counter component.
- `imports/ui/Info.tsx` - removed starter publication subscriber UI.
- `imports/shared/routes.ts` - route metadata and path resolution.
- `imports/shared/types/assets.d.ts` - CSS side-effect import declaration for TypeScript.
- `imports/ui/App.tsx` - browser-history routing, error boundary, loading fallback, and layout selection.
- `imports/ui/components/AppLink.tsx` - internal navigation link.
- `imports/ui/components/Status.tsx` - loading and error states.
- `imports/ui/layouts/PublicLayout.tsx` - responsive public shell.
- `imports/ui/layouts/AdminLayout.tsx` - separate admin shell.
- `imports/ui/pages/HomePage.tsx` - Rugby Rooster introduction.
- `imports/ui/pages/GamesPage.tsx` - honest empty state for upcoming fixtures.
- `imports/ui/pages/AdminPage.tsx` - non-functional admin placeholder.
- `imports/ui/pages/NotFoundPage.tsx` - unmatched route page.
- `package.json` - project identity, check scripts, and Tailwind dev dependencies.
- `package-lock.json` - lockfile refreshed for declared Tailwind/PostCSS/Autoprefixer dependencies.
- `postcss.config.js` - PostCSS pipeline for Tailwind and Autoprefixer.
- `public/favicon.svg` - simple text-brand favicon, not a mascot asset.
- `scripts/check-format.mjs` - repository formatting hygiene check.
- `scripts/lint-foundation.mjs` - foundation invariant lint.
- `tailwind.config.cjs` - Tailwind content paths and theme tokens.
- `tests/main.ts` - package identity assertion updated to `rugby-rooster`.
- `docs/CORE_Product.md` - product identity, agreed product direction, and unresolved rules.
- `docs/CORE_Build_Plan.md` - milestone roadmap and CCPP-001 scope.
- `docs/PLATFORM_Architecture.md` - architecture responsibilities, security posture, and dependency discipline.
- `docs/MAP_System.md` - documentation, route, entry point, and directory map.
- `docs/AUDIT_001_Project_Foundation.md` - this report.

## Verification Commands And Results

```sh
meteor --version
# Meteor 3.5.1
```

```sh
node -p "process.version"
# v20.20.2
```

```sh
meteor node -p "process.version"
# v24.15.0
```

```sh
meteor npm install --package-lock-only --ignore-scripts
# up to date, audited 573 packages in 9s
# 5 moderate severity vulnerabilities
```

```sh
meteor npm ls tailwindcss postcss autoprefixer --depth=0
# rugby-rooster@
# autoprefixer@10.6.0
# postcss@8.5.28
# tailwindcss@3.4.19
```

Meteor npm commands also emitted the existing warning `Unknown env config "nodedir"`; it did not fail any command.

```sh
meteor npm run lint
# Foundation lint passed.
```

```sh
meteor npm run format:check
# Formatting check passed.
```

```sh
meteor npm run typecheck
# tsc --noEmit --incremental false
# passed with no TypeScript errors
```

```sh
meteor npm test
# Initial sandbox run failed: Error: listen EPERM: operation not permitted 0.0.0.0:3000
# Rerun with approved local port binding:
# => Linted your app. No linting errors.
# 2 passing (8ms)
```

```sh
meteor run --port 3100
# => Compiled Rspack server app no errors found
# Rugby Rooster server started. No application publications or methods are exposed in CCPP-001.
# => App running at http://localhost:3100/
```

## Browser Smoke Checks

Playwright desktop viewport `1440x900`:

- `/` rendered `h1: Rugby Rooster`, title `Rugby Rooster`, Tailwind hero background `rgb(34, 111, 84)`, and `hasHorizontalOverflow: false`.
- `/games` rendered `h1: No games are available yet`, empty state detected, and `hasHorizontalOverflow: false`.
- `/admin` rendered `h1: Admin area placeholder`, authentication note detected, `buttons: []`, `formCount: 0`, `inputCount: 0`, and `hasHorizontalOverflow: false`.
- `/not-a-route` rendered `h1: Page not found`, not-found copy detected, and `hasHorizontalOverflow: false`.

Playwright mobile viewport `390x844`:

- `/` rendered `h1: Rugby Rooster`, `scrollWidth: 390`, `bodyScrollWidth: 390`, and `hasHorizontalOverflow: false`.
- `/games` rendered `h1: No games are available yet`, empty state detected, `scrollWidth: 390`, `bodyScrollWidth: 390`, and `hasHorizontalOverflow: false`.
- `/admin` rendered `h1: Admin area placeholder`, authentication note detected, `buttons: 0`, `forms: 0`, `fields: 0`, `scrollWidth: 390`, `bodyScrollWidth: 390`, and `hasHorizontalOverflow: false`.

After adding `public/favicon.svg`, latest browser console logs contained only Meteor HMR and React DevTools development notices.

## Checks Not Run

- `meteor npm run test-app` was not run. It is a watch/full-app test command from the scaffold and no browser driver was configured through `TEST_BROWSER_DRIVER`.
- No static markup tests were added because this milestone intentionally uses static checks, Meteor smoke verification, and Playwright route checks instead.
- `npm audit fix` was not run because npm reported moderate vulnerabilities during lockfile refresh and automatic remediation could upgrade dependencies beyond this foundation task.

## Deviations

- The package name was changed from the scaffold's `rugby-predictor` to `rugby-rooster` to match the product identity.
- Routing was implemented without adding a router dependency because the required route set is small and static.
- Jotai, simpl-schema, and Kaplay were documented as future responsibilities but not installed, matching the instruction to install them only when a milestone needs them.

## Known Limitations And Outstanding Work

- Authentication and server-side authorisation are not implemented.
- There are no fixtures, predictions, scoring rules, match events, leaderboards, leagues, prizes, sponsorships, animations, quizzes, or AI reports.
- Extra-time treatment, submission/reopening policies, leaderboard tie-breaking, and optional question constraints remain unresolved product decisions.
- npm reported 5 moderate vulnerabilities during lockfile refresh; remediation should be handled in a dependency-maintenance task.

## Documentation Paths

- `AGENTS.md`
- `README.md`
- `docs/CORE_Product.md`
- `docs/CORE_Build_Plan.md`
- `docs/PLATFORM_Architecture.md`
- `docs/MAP_System.md`
- `docs/AUDIT_001_Project_Foundation.md`

## EOMD Handover

Primary review report: `docs/AUDIT_001_Project_Foundation.md`.

Review the app foundation, the documentation boundaries, and the custom check scripts. Next implementation milestone should be detailed game rules and a tested scoring engine; do not start accounts, fixtures, predictions, or leaderboards until their own CCPP supplies requirements.
