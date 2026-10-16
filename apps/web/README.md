# PasaOrder web

Next.js App Router frontend for the public storefront catalog and merchant dashboard. Owner sign-up, login, sign-out, and a protected dashboard are available.

Run `pnpm dev:web` from the repository root. Shared types and validation are workspace dependencies; secrets and database access belong in the API.

See the [root setup guide](../../README.md) for environment, database, checks, and build commands.

The UI uses Tailwind CSS v4 and shadcn/ui (Radix primitives, Lucide icons). Components live in `components/ui`; theme tokens live in `app/globals.css`. Use `cn` from `@/lib/utils` to merge conditional utilities.

Add components from the web directory:

```sh
cd apps/web
pnpm dlx shadcn@latest add dialog
```

The app currently uses a light theme.

## PWA

The production app has a web manifest, install icons, and a service worker. On HTTPS (or localhost), browsers can offer **Install app** or **Add to Home Screen**. The service worker only saves the offline fallback page; storefront catalogs, checkout, orders, and account data require a connection and are never cached for offline use. Registration is disabled during `next dev` to avoid stale development assets.

Public catalogs save cart product/option IDs, quantities, and item instructions on the customer's device for seven days, separately per store. An already loaded catalog can still be used to edit the cart while offline. Reopening the catalog requires a connection; restored carts use current catalog prices and remove unavailable products/options. Customer contact and delivery details are not persisted. If browser storage is unavailable, the cart stays in memory for the current tab only.

Checkout requires a connection and never submits in the background. Reconnecting refreshes the catalog. A saved checkout attempt key lets retries recover an order after a lost response without creating it again. Chat-to-order has no offline support.

Run cart recovery checks with `node --test apps/web/tests/menu-recovery.test.mjs` from the repository root.
