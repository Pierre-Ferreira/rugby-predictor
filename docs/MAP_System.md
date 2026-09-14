# Rugby Rooster System Map

## Documentation Index

- `README.md` - project overview, routes, and commands.
- `AGENTS.md` - future-agent operating instructions.
- `docs/CORE_Product.md` - product identity, agreed direction, and unresolved decisions.
- `docs/CORE_Build_Plan.md` - milestone roadmap and CCPP-001 scope.
- `docs/PLATFORM_Architecture.md` - architecture, boundaries, dependencies, and security posture.
- `docs/MAP_System.md` - this map.
- `docs/AUDIT_001_Project_Foundation.md` - CCPP-001 completion evidence.

## Application Entry Points

- `client/main.html` - HTML shell and document title.
- `client/main.tsx` - React startup and CSS import.
- `client/main.css` - Tailwind directives and design tokens.
- `server/main.ts` - Meteor server startup with no CCPP-001 domain publications or methods.

## Routes

- `/` - `imports/ui/pages/HomePage.tsx` in the public layout.
- `/games` - `imports/ui/pages/GamesPage.tsx` in the public layout.
- `/admin` - `imports/ui/pages/AdminPage.tsx` in the admin layout.
- Unmatched paths - `imports/ui/pages/NotFoundPage.tsx` in the public layout.

Route metadata and matching live in `imports/shared/routes.ts`. Client-side navigation is handled by `imports/ui/components/AppLink.tsx`.

## Important Directories

- `client/` - client startup and global CSS.
- `server/` - server startup.
- `imports/shared/` - shared route metadata.
- `imports/ui/components/` - reusable UI primitives.
- `imports/ui/layouts/` - public and admin layout shells.
- `imports/ui/pages/` - route page components.
- `scripts/` - local lint and formatting checks.
- `docs/` - prefixed project documentation.
