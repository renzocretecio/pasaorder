# PasaOrder project summary

PasaOrder helps small businesses create a storefront, receive customer orders, and manage those orders from one workspace. Current positioning: “Orders made simple, from catalog to checkout.” It supports small businesses through product options, extras, and straightforward checkout. Customer chat ordering and Meta messaging integrations have been removed for now.

## Product features

### Owner account and store workspace

- Email and password registration/login, password reset, session management, and optional Google OAuth.
- One owner can manage multiple stores, select a default store, and switch between stores.
- Store profile, contact details, today’s schedule, order types, payment methods, GCash account details/QR, accent color, logo, and banner.
- Responsive owner workspace designed for mobile, tablet, and desktop.

### Catalog and menu publishing

- Store-specific categories, products, availability, images, prices, and priced variants (such as size, color, or piece count).
- Optional priced add-on groups with single or multiple selection, including required choices.
- Excel product import template and validation, including duplicate product checks and a five-product minimum for import.
- Cloudflare R2 image storage with environment-specific object paths. Images upload when the owner saves product or store changes.
- Published menu links use editable, auto-generated store slugs and can be shared as QR codes.
- Public menu displays store information, today’s schedule, categories, products, cart, and checkout using the store accent color.

### Customer checkout and order operations

- Customer ordering from a published catalog with pickup, delivery, and dine-in options, product add-ons, special instructions, and optional order notes.
- Optional phone number, optional dine-in table number, special instructions, cash or GCash instructions, and delivery address.
- Delivery fees are entered by the owner when confirming a delivery order.
- Order confirmation/tracking and an owner order dashboard with queue tabs, status changes, filtering, and paginated past orders.
- A simple standard order progression with accept, cancel, and status updates.
- Manual order entry is available for phone/in-person orders and supports offline queueing/sync.
- Dashboard includes date-filtered KPIs, latest orders, sales overview, and top products.
- Live order updates use authenticated Socket.IO store rooms.

### PWA and search

- Installable PWA opens to login. A service worker provides an offline fallback; menu cart editing and manual order entry support the documented offline flows.
- Public landing, privacy, and terms pages, plus canonical metadata, sitemap, robots rules, and store menu metadata.

## Chat-to-order status

Customer test chat, owner chat inbox, Messenger and Instagram connections/webhooks, ThinkLess classification, and Gemini order extraction have been removed from the app and API. No new chat conversations are accepted or processed. Existing chat-related database tables, migrations, and historical order-source labels are retained to preserve data and allow a future reimplementation. Historical conversation records may remain stored under the existing retention policy; the current UI and API do not expose them.

## Architecture

- `apps/web`: Next.js App Router, React, Tailwind CSS v4, shadcn/ui, Radix, and Lucide.
- `apps/api`: Express and TypeScript for authentication, store/catalog operations, checkout, manual orders, order management, image uploads, and Socket.IO.
- `packages/db`: PostgreSQL schema and Drizzle migrations.
- `packages/types` and `packages/validation`: shared TypeScript contracts and Zod schemas.
- PostgreSQL stores owner, store, catalog, and order data. Cloudflare R2 stores uploaded images.

## Local development

Use the repository’s configured Node version and `pnpm`. Configure environment files from the examples, start PostgreSQL, then run `pnpm dev`. Use `pnpm --filter api seed:demo-orders -- --store-slug=your-store-slug` to create sample orders in a development store. This script refuses to run in production; `--replace` replaces only today’s tagged demo orders.
