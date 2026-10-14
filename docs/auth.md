# Owner authentication

## Available flows

- `/register`: owner name, email, password and confirmation. The backend normalizes email, hashes the password using bcrypt, and returns a safe user profile and signed token.
- `/login`: email and password. Failed login uses a generic credential error and a dummy password comparison for unknown users.
- `/login` and `/register`: optional Google sign-in using OpenID Connect. Google identities are matched by their stable subject; account linking requires a verified Gmail or matching Google Workspace email. Other existing accounts keep their current sign-in method.
- `/dashboard`: validates the session through the API before rendering the owner profile. Anonymous/expired sessions redirect to login. Signed-in visitors to login/register redirect to the dashboard.
- Sign-out: calls the protected API logout endpoint, revokes all sessions for that owner, clears the browser cookie, and redirects to login. API outages show a retry message rather than claiming logout succeeded.

Next.js Server Actions call Express using server-only `API_URL` (default `http://localhost:4000/api`; the previous public URL variable is supported as a fallback). Tokens never enter browser JavaScript or local storage. The cookie is HTTP-only, SameSite=Lax, scoped to `/`, secure in production, and expires after seven days. Production requires HTTPS. Next.js Server Actions enforce their origin checks; authenticated API requests use bearer tokens rather than browser cookies.

API routes: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/google/status`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/google/exchange`, `GET /api/auth/me`, and `POST /api/auth/logout`. Google sign-in uses state, nonce, PKCE, a verified ID token, and a hashed one-use handoff code; Google tokens never reach browser JavaScript. Auth responses never include password hashes or internal token versions. Logout returns 204 and invalidates **all sessions for the account**, not only the current device.

To enable Google sign-in, create a Google OAuth client with application type **Web application**. Set its authorized JavaScript origin to `http://localhost:3000` for local work and its authorized redirect URI to `http://localhost:4000/api/auth/google/callback`. Put the client ID, secret, and exact redirect URI in `apps/api/.env` as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. For production, use the deployed web origin and HTTPS API callback. The Google button stays hidden until all three API settings are present. The web app starts Google sign-in at `/auth/google/start` and receives the handoff at `/auth/google/callback`; these web routes avoid collision with reverse proxies that forward `/api/*` to Express.

## Database migration

`0002_real_hellcat.sql` adds `users.token_version` with default zero; it preserves existing records. Auth middleware compares this value with the signed token claim on every protected request. Existing tokens without this claim are invalid. `0020_google_oauth.sql` adds Google subject linking, allows passwordless provider accounts, and creates short-lived OAuth state and handoff-code tables. Review and apply it with `pnpm db:migrate` after confirming the target database has the expected migration history.

The development database had bigint tables but recorded only migration 0000. During implementation, all seven tables’ columns, defaults, identity fields, primary/unique/foreign-key constraints, and enum values were compared with the 0001 snapshot. The already-present bigint baseline was recorded without executing the destructive 0001 reset SQL. Only the additive 0002 auth change was executed, in the same transaction. No users or stores were reset.

For another database, check its migration state before `pnpm db:migrate`: migration 0001 still contains a destructive development reset. Do not run it on an existing populated database. Fresh/disposable databases can use the complete migration history.

## Verification

`pnpm check` covers auth validation, registration/login, safe responses, current-user lookup, revocation and rate limiting with mocked database queries. `pnpm test:auth:e2e` builds both apps, starts production Next.js and the API on temporary ports, submits the rendered forms, checks protected redirects and cookie attributes, verifies logout revocation, and logs in again using real PostgreSQL. It creates a uniquely named temporary account and deletes that account in cleanup. Run it against a configured development database with the auth migration applied; it does not run migrations.

The current in-process limiter allows 20 auth attempts per email/peer pair per 15 minutes. It resets on API restart and is not shared between instances. A multi-instance deployment needs shared throttling and trusted proxy configuration. Email verification, password reset, MFA, and per-device session management are future features.
