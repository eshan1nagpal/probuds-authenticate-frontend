# probuds-authenticate-frontend

Angular 21 authentication UI for `java/probuds-authenticate-backend`. This application
implements the completed login, account/session, password-change, password-recovery, logout, permitted-module and launch APIs.
Password recovery is implemented together with the backend endpoints documented below.

## Run locally

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4201`. Node 24.13.1 and npm 11.8.0 were used for verification.
The committed lockfile pins dependencies using the reference e-compliance application's
resolved versions. The portal includes legacy module logos and launches, plus a protected blank administrator page. Charts, PDF generators and role switching are outside this application scope.

Before using real accounts, configure the development proxy in `proxy.conf.json`:

- The example target is `http://localhost:8080`.
- `/api/**` is forwarded to that target with `/api` removed.
- If the backend has a servlet context path, replace the empty `pathRewrite` value
  with that path. Set the target to the actual backend origin/port.
- Restart `npm start` after changing proxy settings.

These are local development defaults, not values read from a deployed environment.
The backend must allow the development proxy's Host value through its configured
host allowlist. Do not start the backend against a shared database just to preview this UI.

## Production

```sh
npm run build
```

Deploy `dist/probuds-authenticate-frontend/browser`. The production environment uses the same-origin `/api` API base; development currently points directly to its configured backend URL in `src/environments/environment.ts`. Configure the hosting reverse proxy to route this
prefix to the backend, including the proper servlet context path. Alternatively, set
`apiBaseUrl` in `src/environments/environment.prod.ts` to an explicitly approved API
base before building and configure backend CORS accordingly. Use HTTPS in deployment.

Hash-based routing matches the reference UI and supports static hosting without a
route fallback. For a subdirectory deployment, build with the appropriate `--base-href`.
The background is bundled using a relative asset URL, and logos resolve against the base.
No backend credentials or module handoff passwords belong in frontend configuration.

## Screens and API mapping

| UI | Backend request | Authentication |
| --- | --- | --- |
| `/#/login` | `POST /authenticate` | HTTP Basic with the entered username/password |
| Session restoration / `/#/account` | `GET /session` | Bearer token |
| `/#/password/change` | `POST /password/change` | HTTP Basic with username/current password |
| Sign out | `POST /deout` | Bearer token |
| `/#/forgot-password` | `POST /password/reset/request` | Public; username only |
| Email link → `/#/password/reset` | `POST /password/reset/confirm` | Public; token, new password and confirmation |

Authenticated API requests include `Application: web` and the stable random
`X-Session-Fingerprint`. Public reset requests send only `Application: web`; bearer/Basic
credentials and fingerprints are stripped and browser session storage is not required. Password-change bodies contain only `newPassword` and
`confirmPassword`. Current passwords are never added to the body, URLs, logs or storage.
Username/password encoding uses UTF-8 Basic authentication and preserves password
whitespace and Unicode. Password hashing remains entirely on the backend.

The UI distinguishes all backend `outcome` values:

- `AUTHENTICATED`: validate `/session` before opening the account page.
- `PASSWORD_CHANGE_REQUIRED`: open the password form without retaining an access token.
- `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_DISABLED`, `ACCOUNT_EXPIRED`,
  `CREDENTIALS_EXPIRED`, `PASSWORD_EXPIRY_CONFIGURATION_INVALID`: show the corresponding
  guidance. Recovery is available for forgotten passwords; locked/disabled/explicitly
  expired accounts still require an administrator.
- `INVALID_PASSWORD`, `PASSWORD_REUSED`: show an inline password-form error.
- `PASSWORD_CHANGED`: clear this app's session and return to login with a success message.

The new-password form mirrors backend complexity/confirmation validation and its
1,024-character limit. The backend remains authoritative about history and account policy.
No current password is retained from login; users re-enter it for password changes.
Nullable roles/name fields are supported without assuming the reference app's role model.

## Session behavior

Only the bearer token, its original expiry hint, expiry-warning metadata, and generated
session fingerprint are kept in app-specific `sessionStorage` keys. User identity is
loaded from `/session`; no local user/role data can grant access. Storage errors produce
a clear message. Clearing a session does not clear unrelated applications' storage.

The interceptor adds credentials only to the configured API origin and path. It preserves
explicit Basic headers on login/password requests and lets their forms handle errors.
Bearer rejection clears local authentication and routes to login or mandatory password
change as appropriate. A failed server logout clears local state and explicitly tells
the user that server revocation could not be confirmed.

The account route verifies the session on entry and the app rechecks on window focus.
The backend controls validity; the original client expiry hint is not used to reject a
token early because optional backend renewal does not return a replacement expiry time.
There is no keepalive polling that would prolong an idle session. Network failures do
not masquerade as successful authentication or a confirmed server logout.

Expiry warnings display the returned `LocalDateTime` as **server time**, without changing
its wall-clock fields to the browser timezone or reusing a stale days-remaining countdown.
The API does not return expiry metadata in `/session`, so warnings are retained from the
login response; subsequent policy changes are enforced by the server on each request.

## Design

The UI reuses the e-compliance application's supplied logo/background, Segoe UI typography,
blue `#1C76BC`, orange hover accent, Bootstrap controls and icons, white cards, and account
navigation styling. `bootstrap.scss` includes only the Bootstrap components/utilities used
here. Expected Bootstrap 5 Sass deprecations are silenced in the build configuration.
The screens support narrow devices, keyboard navigation, labelled controls, accessible
password-visibility toggles, validation descriptions, status/error announcements, and
reduced motion preferences.

## Verification

```sh
npm test
npm run build:dev
npm run build
```

Verified on 8 November 2026:

- 58 tests passed: API headers and UTF-8 encoding, backend outcomes, guard decisions,
  token/fingerprint restoration, request boundaries, storage/network failures, late
  session responses, logout, password validation/reuse, and credential clearing.
- Strict application and test TypeScript checks passed.
- Development and optimized production builds passed. The optimized initial bundle is
  about 400 kB (about 90 kB estimated transfer), within the 500 kB warning budget.
- Browser checks covered login, empty-field validation, password-change layout and
  a 390 × 844 mobile viewport with no horizontal overflow.

Angular's compiler aborted with exit 134 inside the execution sandbox; the builds and
tests passed when run outside that sandbox. No production build workaround was added.
HTTP contracts were tested with Angular's mocked HTTP backend. A live Java/database
integration and actual password change were not performed. Verify the proxy, backend
Host allowlist, deployment origins, and real account outcomes in a disposable environment.


## Password recovery

The login screen links to a matching username-entry screen. The acknowledgement is
identical for known and unknown users and does not claim confirmed delivery. A 60-second
client resend cooldown prevents accidental duplicates; server-side cooldowns and rate
limits remain authoritative. HTTP 429 and 503 are shown without redirecting or clearing
an unrelated session.

The email link uses `#/password/reset?token=...`. The token is confined to the URL
fragment, read into component memory, and removed from the visible history entry with
Angular Location.replaceState. It is never saved in session/local storage, logged,
rendered in the page, or sent as a referrer (`no-referrer` is set globally). Opening or
scanning the link does not consume it. Reloading after removal requires reopening the
email link. Query-parameter changes are observed so a newly opened link works even if
Angular reuses an existing reset screen.

The new-password screen uses the existing shell, controls, typography and password
validators. A reused/invalid password can be retried with the same valid link; an
invalid/expired/used link shows a request-another-link action. Successful confirmation
clears this app's local session and returns to login; it does not automatically sign in.
Window-focus session checks are skipped on recovery screens to keep unrelated stale
bearer sessions from interrupting public recovery.

Configure AUTH_RESET_FRONTEND_URL in the backend to this deployed frontend's full
reset route (including its hosting subdirectory). The backend's token-table migration
must be applied before deploying the updated password workflows. No mail outbox is used;
queued delivery is best effort and a restart can lose pending mail. Users can request
a replacement link after the cooldown.

Additional verification on 8 November 2026 covers public headers with stale tokens or
blocked storage, acknowledgement timing, resend cooldown, URL removal, missing/used links,
password reuse and matching, and route-component reuse. These tests use mocked HTTP;
no real reset email or account-password operation was performed in the browser.


## Module portal

`/#/account` loads `GET /portal` and displays only its permitted modules, using the
legacy FCM/DMS/LCM/Legal Diary images in `public/assets/images/modules/`. EVENT and
PHASE intentionally retain the LCM image, matching the legacy application. Cards use
the existing Segoe UI, e-Compliance branding, blue actions and orange hover styling.
The grid supports desktop/tablet/mobile; it includes loading, retry, no-module,
opening and popup-blocked states. Module details and credentials live only in the
backend `modules.properties` and deployment environment, not Angular environments.

Selecting a card opens a blank tab synchronously, removes its opener, requests
`POST /portal/modules/{id}/launch`, then submits only its one-use ticket as a form
POST to `/portal/launch`. Spring destinations retain their hidden credential POST;
Angular destinations retain their legacy hash-route credential redirect. Both happen
in the new tab. The portal bearer token never enters the navigation URL/form. Backend
launch authorization is authoritative, independent of card visibility.

An administrator sees Admin Task, which opens `/#/admin`. This route restores the
session and checks `ROLE_ADMIN`; its main area is intentionally blank, with only the
shared header, home link and sign-out action. No administration operations exist yet.

When deploying with a frontend CSP, allow form navigation to the configured backend
origin for the one-use launch POST. Reverse proxies must forward `/portal/launch`
without trying to convert it to Angular navigation. Enable module definitions in the
backend before expecting cards to appear. Multi-instance backend deployments need
launch-ticket affinity or a shared ticket store; see backend README.

Current verification: 66 frontend tests pass and production build passes (403.03 kB
initial bundle). The sandboxed Node process aborts in its native allocator during
build; the same build passes outside the sandbox. Browser preview used synthetic
account/module responses only and verified desktop/mobile cards without horizontal
overflow, opening a separate tab by POST and the blank administrator route.


## Portal layout and navigation update

The authenticated portal now uses the full available viewport width rather than a
1120px centered container. Its navbar follows the reference e-compliance application's
logo, spacing, underlined active tabs and right-aligned settings gear. My applications
and the permitted Admin Task are navigation tabs; optional Change password and Logout
are inside the account settings dropdown on desktop and mobile. Dropdown interaction
supports outside-click dismissal and Escape with focus returned to its trigger.
The administration main area remains intentionally blank; its navbar loads the same
backend portal settings when entered directly.

The expiry banner appears only when the backend-provided `passwordExpiresInDays` is
between 0 and 5 inclusive and a valid expiry timestamp exists. Missing/invalid counts
and larger values do not produce a warning; no browser-timezone date subtraction is
used. Password enforcement itself is unchanged.

Verification: 72 UI tests pass; production build passes (412.31 kB initial bundle).
Synthetic browser checks verified full-width desktop content, settings actions,
Admin Task navigation and mobile navigation without horizontal overflow. Backend APIs,
launch patterns, module configuration and reference application files were unchanged.


Application-selection refinement: added a restrained welcome panel and live module
count, a separate application section, module ID labels, preserved legacy logos and
clear launch actions. Six modules fit a wide desktop row; smaller sets use wider
centered cards, and narrower screens wrap to three/two/one columns. Page-specific
styling lives in `feature/home/account.css` rather than the global stylesheet.
The navbar, authorization and downstream launch protocols are unchanged. Production
build passes (410.46 kB initial); 72 existing frontend tests pass. Synthetic browser
checks covered six/two modules, centered rows and mobile layout without overflow.
