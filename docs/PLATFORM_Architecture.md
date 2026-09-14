# Rugby Rooster Platform Architecture

## Current Foundation

Rugby Rooster is a Meteor `3.5.1` application using React, TypeScript, MongoDB through Meteor, and TailwindCSS.

Current boundaries:

- `client/` owns browser startup and global styles.
- `server/` owns Meteor server startup.
- `imports/shared/` holds framework-light shared metadata used by client and future server code.
- `imports/ui/` owns React layouts, route pages, links, and status states.
- `docs/` owns prefixed project documentation.
- `scripts/` owns local verification helpers.

## Data And Authority

Planned platform responsibilities:

- Meteor methods and publications own authoritative operations and controlled data access.
- MongoDB stores persistent application data.
- React owns accessible application UI and navigation.
- Jotai will hold temporary UI state where useful.
- simpl-schema will validate relevant domain inputs and data.
- Kaplay will provide isolated animations and game experiences.
- Scoring and prediction validation must remain independent of React and Kaplay.
- AI services will be introduced later behind server-side integrations.

CCPP-001 does not define domain collections, publications, methods, accounts, scoring, predictions, or leaderboards. `insecure` and `autopublish` must remain absent.

## Dependency Discipline

Install Jotai, simpl-schema, and Kaplay when a milestone actually needs them. Do not create empty abstractions for future features.

Use Meteor's bundled runtime through `meteor npm` for installation and verification. Do not change the developer's global Node installation.

## Styling

TailwindCSS is wired through `postcss.config.js`, `tailwind.config.cjs`, and `client/main.css`.

The initial design tokens use a small playful rugby palette:

- Rooster red.
- Sun yellow.
- Grass green.
- Ink.
- Paper.
- Muted text.
- Line.

Final mascot assets and approved branding are not established in CCPP-001.

## Security Notes

- The admin page is a placeholder only.
- Authentication and server-side authorisation are future work.
- Do not expose privileged data or actions through client-only checks.
- Keep secrets out of source control and documentation.
