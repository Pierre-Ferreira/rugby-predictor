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

Implementation guardrails:

- Meteor methods and publications own authoritative operations and controlled data access.
- Do not add unrestricted client database writes or broad publications.
- Keep admin routes free of privileged data and actions until authentication and server-side authorisation are implemented.
- Install Jotai, simpl-schema, and Kaplay only when a milestone actually needs them.
- Keep scoring and prediction validation independent of React and Kaplay.
- Introduce AI services later only behind server-side integrations.
