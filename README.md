# PasaOrder

PasaOrder helps small businesses create a mobile-friendly storefront, receive customer orders, and manage fulfillment from one workspace. Product options, priced extras, and order notes support food, retail, gifts, and services. Customer chat ordering and Meta messaging are out of the current MVP.

See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for current features and architecture.

## Local setup

Use Node.js 24, pnpm 12.8.1 (the version in `package.json`), and Docker Compose or your own PostgreSQL instance.

```sh
pnpm install --frozen-lockfile
pnpm env:setup
pnpm db:up
pnpm db:migrate
pnpm dev
```

The API reads `apps/api/.env`; migration tools read `packages/db/.env`. Both must point to the same database. In `apps/web/.env`, `API_URL` is the server-to-server Express URL including `/api`; `API_PUBLIC_URL` is the browser-reachable API URL including `/api`, used for OAuth redirects when `API_URL` is private; `WEB_ORIGIN` is the public web origin used for OAuth callback redirects; and `NEXT_PUBLIC_SOCKET_URL` is the browser-reachable API origin without `/api` for Socket.IO. Set the API's `WEB_ORIGIN` to the same web app origin. Never put secrets in `NEXT_PUBLIC_*` variables.

`pnpm env:setup` creates missing environment files and a random API JWT secret. It preserves existing values. The API and web examples document the required settings.

**Migration warning:** migration `0001_tranquil_puppet_master.sql` drops and recreates application tables. Apply the current migration history only to a new or disposable database. Back up and replace that destructive transition with a reviewed data-preserving migration before using it against existing records.

Web: http://localhost:3000. API: http://localhost:4000/api. The workspace builds shared packages first and watches both apps; use `pnpm dev:api` or `pnpm dev:web` to run one app.

## Create a catalog

After signing in, create a store, add a category and available product or service, preview the catalog, then publish it. The workspace provides a public link and downloadable QR code. Products can have priced options and extras. Spreadsheet import is available from the catalog; it requires at least five products and rejects duplicate product names within a category.

Image uploads use Cloudflare R2 through its S3-compatible API. Configure `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in `apps/api/.env`. New object paths are separated by API `NODE_ENV`; `IMAGE_PREFIX` can set a custom path. Uploaded images are normalized to WebP.

Customers can order from the published catalog for pickup, delivery, or dine-in, choose product options, leave order notes, and use cash or the store's GCash instructions. Owners manage incoming orders and delivery fees in the order workspace. Manual order entry supports phone/in-person orders and offline queueing.

To add sample orders to a local development store, run:

```sh
pnpm --filter api seed:demo-orders -- --store-slug=your-store-slug
```

The script creates eight tagged orders for today (Manila time), refuses to run in production, and rejects duplicate demo sets. Append `--replace` to replace only today's tagged demo orders for that store.

## Validation

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

SEO uses `WEB_ORIGIN` in `apps/web/.env` for canonical and sitemap URLs. The sitemap includes the landing and legal pages plus active, published store menus. Public menu links include store-specific metadata. In production, make the API's Socket.IO endpoint publicly reachable and set `NEXT_PUBLIC_SOCKET_URL` to its origin without `/api`.
