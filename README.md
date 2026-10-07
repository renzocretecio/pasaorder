# PasaOrder

QR menu ordering and assisted social inbox orders for small businesses. Owner authentication, store setup, catalog editing, public menus, guest checkout, an owner order queue, and incoming Facebook Messenger integration are implemented. Stores can accept Cash and/or GCash with manual owner verification. Instagram messaging, outgoing Messenger replies, and payment gateway processing remain planned.

## Local setup

Use Node.js 24, pnpm 12.8.1 (the version in `package.json`), and Docker Compose or your own PostgreSQL instance.

```sh
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:up
```

`setup` creates missing environment files and a random API JWT secret. It preserves existing environment values and adds a random API `JWT_SECRET` if that key is missing. If an existing secret is shorter than 32 characters, replace it with a longer random value. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.

The API reads `apps/api/.env`; migration tools read `packages/db/.env`. Both must point to the same database. Docker credentials are for local development only. `apps/web/.env` supports a server-only `API_URL` and `NEXT_PUBLIC_SOCKET_URL`, which must point to the public API origin (without `/api`) that serves Socket.IO. Set the API's `WEB_ORIGIN` to the web app origin. Existing `NEXT_PUBLIC_API_URL` values are accepted as an API fallback. Never put secrets in `NEXT_PUBLIC_*` variables.

**Migration warning:** existing migration `0001_tranquil_puppet_master.sql` drops and recreates the application tables. Apply the current migration history only to a new/disposable database. Back up and replace the destructive transition with a reviewed data-preserving migration before using it against existing records.

On a new database:

```sh
pnpm db:migrate
pnpm dev
```

The workspace uses TypeScript 6 for compatibility with the installed ESLint parser. Next.js uses its compiler API for build typechecking.

Production builds use Next.js’s supported Webpack option because Turbopack CSS workers cannot bind their local ports in this execution environment. `pnpm --filter web build:turbo` is available on unrestricted hosts. The web app bundles Geist locally, so builds do not depend on Google Fonts downloads.

Web: http://localhost:3000. API: http://localhost:4000/api. The dev command builds shared packages first, then watches them alongside both apps. For one app, use `pnpm dev:api` or `pnpm dev:web`.

## Create your first catalog

After signing in, open **Create store**. Enter your store name; the permanent menu slug is generated from it and can be edited before you create the store. Choose an accent color, add a category and an available item, preview the catalog, then publish it. The workspace provides your public `/menu/[slug]` link and a downloadable PNG QR code for the current site origin.

Drafts stay private. Publishing needs at least one available item; making the last item unavailable automatically unpublishes the catalog. Saved edits to published catalogs go live immediately. Items can have one price or named size/piece options with individual prices. Store logos and product images can be uploaded or linked from public HTTPS URLs. Customers choose configured payment methods at checkout; GCash details appear on the confirmation and order tracking page. Owners manually update payment status. Payment gateways and automatic payment confirmation are not implemented.

Image uploads use the OCI S3-compatible Object Storage API from the Express server. Set `OCI_NAMESPACE`, `OCI_REGION`, `OCI_BUCKET_NAME`, `OCI_ACCESS_KEY_ID`, and `OCI_SECRET_ACCESS_KEY` in `apps/api/.env`; keep the bucket private and grant the customer key object read/write access. Uploaded JPG, PNG, and WebP files are limited to 5 MB and normalized to WebP. New objects use separate `images/development/`, `images/production/`, and `images/test/` paths based on API `NODE_ENV`, with matching web URLs under `/api/images/[environment]/[name]`. Set `OCI_IMAGE_PREFIX` to a short custom path such as `staging` for another deployment. Existing uploads at `images/[name]` remain readable through `/api/images/[name]`, and existing HTTPS image URLs continue to work. These prefixes organize objects within one bucket; they do not provide separate bucket permissions. Unused uploaded images are retained for now; object cleanup is future work.

The Orders page subscribes to its selected store through Socket.IO. New orders and status changes trigger an authenticated API refresh; socket events contain only the store ID. In production, make the API's Socket.IO endpoint publicly reachable and set `NEXT_PUBLIC_SOCKET_URL` in `apps/web/.env` to its origin, without `/api`.

## Assisted chat decision router

Add `CLOUDFLARE_AI_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN` to `apps/api/.env` to enable Clef-flash. Use the **API token value** copied when creating a Workers AI token, not the token's ID shown in the Cloudflare dashboard. The token needs Workers AI access to the account. Keep it in the API environment only; restart the API after adding it. Verify the connection with `pnpm --filter api ai:check:clef`. This check sends five synthetic conversations and prints no credentials.

Add `GEMINI_API_KEY` to `apps/api/.env` to enable order extraction. Verify it with `pnpm --filter api ai:check:gemini`; the check sends only a synthetic order and confirms that a tentative item is not added to the draft.

Clef classifies the unresolved request in the conversation into nine internal intents: new order, modify order, cancel order, order status, product question, store question, payment question, greeting, and other. It also estimates whether clarification, an LLM, or human judgment is needed. The API uses confidence thresholds and a deterministic router to group chats into **Possible order**, **Needs attention**, and a quiet state shown only in All. Only a clear order with enough detail enters Possible order. Opening a chat starts its review automatically; Gemini can also extract items from a Needs attention chat when new-order intent has a distinct lead. Only items Gemini marks as clearly ordered and the API uniquely matches to available catalog products enter the editable form; tentative, unavailable, and ambiguous items stay in a review list. The owner still checks and confirms the order. The **Review again** action retries when needed. Product, store, and payment questions show read-only catalog/settings facts. Modification, cancellation, and status requests never change or disclose an order based on chat identity alone. Clef failure leaves manual review available. No customer message is answered or turned into a confirmed order automatically.

For the public test chat, each newly saved message triggers Clef analysis of the conversation in the API background. The latest decision sets the inbox category, which can change as the conversation develops. Brief greetings and thanks can remain in All without entering either actionable filter. The API console logs `chat_intent_routed` with the draft ID, intent, its confidence threshold, and selected route. It does not log message text, customer name, or credentials. Duplicate message retries do not trigger another analysis; a stale result is discarded. Each new message can incur a Workers AI request while Clef is configured.

## Facebook Messenger connection

Messenger connections are per store. Add `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_TOKEN_ENCRYPTION_KEY`, and `META_REDIRECT_URI` to `apps/api/.env`. Generate the encryption key with `openssl rand -hex 32`; keep this key stable and backed up because connected Page tokens depend on it. Set `META_REDIRECT_URI` to the exact HTTPS callback URL `https://<api-host>/api/meta/oauth/callback`. Meta also needs the HTTPS webhook callback `https://<api-host>/api/meta/webhook` and the same verify token. Set `META_GRAPH_API_VERSION` to the version enabled for your Meta app (the default is `v26.0`).

In the Meta developer dashboard, add Facebook Login and Messenger, allow the callback URL under Valid OAuth Redirect URIs, set up the `Page` webhook object, and subscribe to `messages` and `messaging_postbacks`. Grant the app `pages_show_list`, `pages_manage_metadata`, and `pages_messaging`. A Page admin then opens that store’s settings, connects Facebook, and selects a Page. PasaOrder subscribes that Page to Messenger webhooks and stores the Page access token encrypted. Incoming text messages are saved to chat drafts, the customer profile name is looked up when Meta makes it available, and store owners can send text replies from the chat review screen. Replies use Meta’s standard response messaging window. The app needs the appropriate Meta App Review access before customers outside the app’s developer/test roles can use the integration. The API must be reachable over public HTTPS for OAuth and webhooks.

Migration `0004_yielding_roughhouse.sql` copies ownership from existing businesses to stores before removing the business table. Existing stores and catalogs remain in place. Apply migrations before starting the updated apps.

Migration `0005_charming_stellaris.sql` adds optional product variants without changing existing single-price items.

Migration `0013_worried_william_stryker.sql` adds per-store Cash/GCash settings and per-order payment state plus a snapshot of GCash instructions. Run `pnpm db:migrate` after confirming the existing migration history is already applied to the target database.

## Structure

```text
apps/
  api/
    src/
      config/       Validated environment
      middleware/   Authentication and error responses
      modules/      Auth, catalog, and order domains
      realtime/     Authenticated Socket.IO order notifications
      app.ts        Express composition
      db.ts         Configured shared database instance
      server.ts     Listener and graceful shutdown
    tests/          HTTP boundary and tenant isolation regression tests
  web/
    app/            Next.js App Router
packages/
  db/               PostgreSQL client, Drizzle schema, migration history
  types/            Public TypeScript contracts
  validation/       Shared Zod input schemas
scripts/            Local setup helpers
docs/               Architecture and implementation roadmap
.github/workflows/  CI
```

## Commands

| Command            | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `pnpm check`       | Formatting, frontend lint, workspace typecheck, API regression tests |
| `pnpm build`       | Build shared packages and both apps in dependency order              |
| `pnpm build:api`   | Build API and dependencies                                           |
| `pnpm build:web`   | Build web and dependencies                                           |
| `pnpm db:generate` | Generate a migration after schema edits; review SQL before applying  |
| `pnpm db:migrate`  | Apply reviewed migrations                                            |
| `pnpm db:studio`   | Inspect the configured database                                      |
| `pnpm db:down`     | Stop local PostgreSQL, preserving its named volume                   |

`pnpm test` uses mocked database queries, not your configured database. They verify authentication, owner scoping, error boundaries, and validation. They do not replace PostgreSQL integration tests for checkout transactions. `lint` currently covers the frontend; TypeScript checks cover all workspaces.

## API conventions

- `/api/health` is liveness; `/api/ready` checks PostgreSQL connectivity.
- Register/login return `{ user, token }`. Protected endpoints require `Authorization: Bearer <token>`.
- `/api/auth/me` and `/api/catalog` require authentication. Store creation derives ownership from the token.
- `/api/catalog` provides owner-scoped store setup, categories, items, settings, and publishing. `/api/public/stores/:slug` exposes only active, published catalogs.
- IDs are decimal strings to preserve PostgreSQL bigint precision. Money fields are decimal strings; future calculations must use integer centavos or decimal arithmetic. Dates are ISO strings.
- Expected failures return JSON with an appropriate status. Internal exception details are not returned to clients.
- The browser stores its token in an HTTP-only cookie; Next.js forwards it to the API server-side. Sign-out increments the owner’s token version, invalidating all sessions for that account. Existing tokens from before this auth change are invalid; log in again.

`pnpm test:catalog:e2e` builds both apps and exercises catalog forms, publishing, and tenant isolation against the configured database. It creates temporary accounts and removes those accounts and their stores afterward. `pnpm test:auth:e2e` verifies the existing authentication flow.

See [authentication](docs/auth.md) for auth flows, migration details, and the optional real-database smoke test.

See [architecture](docs/architecture.md) and [roadmap](docs/roadmap.md). The [original planning notes](docs/original-project-guide.md) are retained for reference; the actual repository and this README describe the current setup.
