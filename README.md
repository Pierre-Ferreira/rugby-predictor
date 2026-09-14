# Rugby Rooster

Rugby Rooster is a standalone rugby prediction game for televised rugby fixtures. CCPP-001 establishes the Meteor React TypeScript foundation, public/admin layouts, Tailwind styling, and documentation convention.

This repository is not Rugby Tracker / Rucks and Mauls. Club management, player rosters, BokSmart documents, subscription tiers, and player-performance analytics are outside this project unless a future task explicitly changes scope.

## Stack

- Meteor `3.5.1`
- React `18`
- TypeScript
- MongoDB through Meteor
- TailwindCSS `3.4`

## Routes

- `/` - Rugby Rooster introduction and link to browse games.
- `/games` - Empty state for upcoming fixtures.
- `/admin` - Non-functional administration placeholder.
- Any unmatched route - not-found page.

The admin placeholder exposes no privileged data or actions. Authentication and server-side authorisation are future work.

## Commands

Use Meteor's bundled runtime:

```sh
meteor npm install
meteor npm run start
meteor npm run lint
meteor npm run format:check
meteor npm run typecheck
meteor npm test
```

`meteor npm run lint` checks foundation invariants such as Meteor pinning, absent `insecure` / `autopublish`, no starter tutorial publication, and the Markdown documentation convention.

`meteor npm run format:check` checks repository text files for final newlines, trailing whitespace, and CRLF endings.

`meteor npm run typecheck` runs TypeScript with no emit.

## Documentation

Root documentation:

- `AGENTS.md` - future-agent instructions.
- `README.md` - setup and project overview.

Project documentation lives under `docs/`:

- `docs/CORE_Product.md`
- `docs/CORE_Build_Plan.md`
- `docs/PLATFORM_Architecture.md`
- `docs/MAP_System.md`
- `docs/AUDIT_001_Project_Foundation.md`
