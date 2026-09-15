# Rugby Rooster PWA Platform

## Status

CCPP-004E adds the minimal installable-app foundation for Rugby Rooster. It is
not a full offline PWA implementation.

Implemented:

- A web app manifest at `public/site.webmanifest`.
- Document metadata in `client/main.html` for manifest discovery, theme color,
  favicon, Apple touch icon, and standalone mobile presentation.
- Temporary RR monogram icon assets in `public/icons/`.
- Safe-area-aware public and admin app shells.
- A narrow server hook that serves `/site.webmanifest` with
  `application/manifest+json`.
- Browser regression coverage for manifest metadata, icon responses and
  dimensions, `/games` launch behavior, responsive layout, and absence of
  service worker registration.

Not implemented:

- Service worker registration.
- Offline fallback, caching, or update/reload handling.
- Push notifications.
- In-app install prompts.
- Final mascot or brand-approved iconography.

## Manifest

`public/site.webmanifest` describes the install shell:

- `id`: `/rugby-rooster`
- `name` and `short_name`: `Rugby Rooster`
- `start_url`: `/games`
- `scope`: `/`
- `display`: `standalone`
- `theme_color`: `#161f26`
- `background_color`: `#f6f4ed`
- `categories`: `games`, `sports`

The `start_url` intentionally contains no account, email, token, tracking, or
fixture identifiers. Future launch routing may change after fixture browsing and
prediction workflows exist, but it must keep sensitive or user-identifying data
out of the manifest.

## Icons

Current icon assets:

- `public/favicon.svg` - existing browser favicon.
- `public/icons/apple-touch-icon.png` - 180 x 180 PNG for Apple touch metadata.
- `public/icons/rr-icon-192.png` - 192 x 192 PNG manifest icon.
- `public/icons/rr-icon-512.png` - 512 x 512 PNG manifest icon.
- `public/icons/rr-maskable-512.png` - 512 x 512 PNG maskable manifest icon.
- `public/icons/rr-icon-source.svg` - temporary standard RR source.
- `public/icons/rr-maskable-source.svg` - temporary maskable RR source.

The RR monogram icons are temporary Rugby Rooster assets. Replace them in a
future branding task when final mascot/art direction exists, then rerun the
dimension and browser metadata checks.

## Browser Shell

`client/main.html` links the manifest and Apple touch icon, sets one viewport
declaration with `viewport-fit=cover`, and declares mobile standalone metadata.

`client/main.css` defines:

- `.app-shell` with `100vh` fallback, `100dvh`, and left/right safe-area
  padding.
- `.app-shell-header` with top safe-area padding.
- `.app-shell-footer` with bottom safe-area padding.

`imports/ui/layouts/PublicLayout.tsx` and `imports/ui/layouts/AdminLayout.tsx`
apply those shell classes. The public shell also applies bottom safe-area
padding to its footer.

## Server Hook

`imports/server/pwa/server.ts` registers a `WebApp.rawConnectHandlers` hook. It
only checks the request path before query parameters and only changes the
response header for `/site.webmanifest`.

The hook always calls `next()`. It does not read, write, replace, redirect, or
end the response, so Meteor's static-file handling remains responsible for
serving the manifest body.

## Installation

Manual installation has not been tested on real devices in CCPP-004E. Use these
steps for local/manual checks:

1. Start Rugby Rooster locally with `meteor npm run start` or the email-enabled
   development command when auth mail is also being checked.
2. Open `http://127.0.0.1:3000/games` or the matching local port in the browser.
3. In Chrome or another Chromium browser, use the browser-provided install
   affordance when available, such as the address-bar install icon or install
   menu item. Localhost and `127.0.0.1` are acceptable for local installability
   checks; production installability requires HTTPS.
4. In Microsoft Edge, use the address-bar app/install prompt when available, or
   Settings and more > More tools > Apps > Install this site as an app.
5. In Safari on iPhone, open the site, open the page/share menu, choose Share,
   choose Add to Home Screen, enable Open as Web App when offered, then add.
6. In Safari on macOS, open the site and choose File > Add to Dock, or use the
   Share button > Add to Dock.

Because CCPP-004E intentionally ships no service worker, installed copies still
depend on the network and the live Meteor server. Browser install prompts and
criteria differ by browser, platform, engagement heuristics, and current browser
version.

## Verification

Primary command:

```sh
meteor npm run test:e2e -- foundation.spec.ts
```

This focused browser suite verifies:

- `/games` is reachable as the manifest launch route.
- The document exposes one viewport meta tag with `viewport-fit=cover`.
- The manifest URL responds with JSON, not the app HTML shell.
- The manifest response uses `application/manifest+json`.
- Standard and maskable PNG icons respond successfully.
- PNG icon natural dimensions match their declared sizes.
- Public and admin layouts avoid horizontal overflow on desktop and mobile
  viewport sizes.
- No active service worker controller or registration exists.

Static support checks for this scope:

```sh
meteor npm run typecheck
meteor npm run lint
meteor npm run lint:project
meteor npm exec prettier -- --check <changed CCPP-004E files>
```

## References

- MDN PWA installability guidance:
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN web app manifest deployment guidance:
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
- MDN app icon guidance:
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons
- MDN `start_url` guidance:
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url
- Chrome install criteria guidance:
  https://web.dev/articles/install-criteria
- Chrome criteria update note:
  https://developer.chrome.com/blog/update-install-criteria
- Apple iPhone web app guidance:
  https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
- Apple Safari Mac web app guidance:
  https://support.apple.com/en-au/guide/safari/ibrw9e991864/mac
- Microsoft Edge app installation guidance:
  https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge
