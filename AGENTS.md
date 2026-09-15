# Rugby Rooster Agent Instructions

Rugby Rooster is a standalone rugby prediction game. It is a separate product from Rugby Tracker / Rucks and Mauls. Do not import that product's requirements, branding, code, collections, permissions, subscription tiers, or architecture unless a task explicitly instructs it.

Before implementing future CCPP work:

- Read this file and the relevant project documents under `docs/`.
- Preserve Rugby Rooster's separate product identity.
- Update existing system documents when behaviour, routes, architecture, setup, or product rules change.
- Create a numbered `AUDIT_` report for each CCPP.
- Keep task-created prefixed Markdown files under this repository's `docs/` directory. Root Markdown is limited to `README.md` and `AGENTS.md` unless a future task explicitly changes this convention.
- Use the prefixes `CORE_`, `PLATFORM_`, `MAP_`, `AUDIT_`, and `TEMP_` consistently.
- Report checks actually run and never claim unperformed verification.
- Keep secrets out of source control and documentation.
- Document unresolved product decisions instead of silently inventing them.
- Add tests for significant new behaviour and important failure paths.
- Add regression tests for bug fixes where practical.
- Run appropriate checks and report actual results.
- Avoid arbitrary coverage targets and low-value tests written only to increase coverage.

Implementation guardrails:

- Meteor methods and publications own authoritative operations and controlled data access.
- Do not add unrestricted client database writes or broad publications.
- Keep admin routes and privileged data/actions behind server-side authentication and authorisation.
- Install Jotai, simpl-schema, and Kaplay only when a milestone actually needs them.
- Keep scoring and prediction validation independent of React and Kaplay.
- Introduce AI services later only behind server-side integrations.
- Keep unit tests focused on framework-independent behaviour where possible, and use Meteor/database integration tests only when the feature needs server or persistence coverage.
- Keep Playwright and other automated browser checks pointed at local loopback targets unless a future task explicitly defines a safe non-production target and matching safeguards.
