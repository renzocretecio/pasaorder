# PasaOrder project summary

**PasaOrder is a mobile-first ordering and order-management platform for small businesses.** A store can publish a menu/catalog with a shareable link or QR code, accept customer orders, and manage them in one owner workspace. Customers can also contact a store through the public test chat or Facebook Messenger; the owner reviews those conversations and can turn a suitable conversation into a confirmed order.

The product is designed to make everyday ordering straightforward for owners and customers. AI assists with sorting and understanding conversations, while the store catalog and owner remain the source of truth for products, prices, availability, and order confirmation.

## Who it serves

- **Store owners:** Set up one or more stores, manage their catalogs, receive orders, and handle customer conversations.
- **Customers:** Browse a public menu on a phone, choose items and options, and place a guest order without creating an account.

The owner can set a default store for the dashboard and switch stores from the workspace. Stores are managed directly under the owner; there is no separate business layer or role-based staff access currently.

## Features implemented

### Owner account and workspace

- Owner registration, login, logout, optional Google sign-in, and protected dashboard pages. Sessions are server-managed in HTTP-only cookies, with token revocation on logout.
- Store-scoped data access: each store's catalog, orders, settings, and chats are isolated.
- Multiple stores per owner, a configurable default store, and a store switcher.
- A responsive workspace built for phone, tablet, and desktop use.

### Store setup and catalog

- Create a store and generate an editable, permanent menu slug.
- Configure store description, contact information, address, weekly operating hours, logo, banner, and accent color.
- Configure available fulfillment types: pickup, delivery, and dine-in.
- Create and reorder categories and products; toggle product availability.
- Set a single product price or add named size/piece options with their own prices.
- Import products from XLSX using a downloadable template and preview. Imports accept at least five products, match or create categories, detect duplicate product names in a category, and avoid partial imports when validation fails.
- Upload store and product images to Cloudflare R2. JPG, PNG, and WebP uploads are normalized to WebP; separate development, test, and production object prefixes are supported. Public HTTPS image links can also be used.
- Preview a catalog privately before publication. Publishing requires an available product; making the last product unavailable unpublishes the catalog. Saved edits to a published catalog go live immediately.
- Generate the public menu link and downloadable QR code.

### Customer menu and checkout

- Public, mobile-friendly catalog with store profile, today's schedule, categories, product details, images, descriptions, and store-accent styling.
- Product details open in a dialog with option selection, special instructions, quantity control, and add-to-cart action.
- Guest checkout supports the fulfillment types and payment methods configured by the store. Mobile number is optional for dine-in; dine-in can include an optional table number.
- Delivery customers provide an address. The owner sets a delivery fee when confirming the order because the fee may depend on distance.
- Cash and GCash are supported. The store can provide copyable GCash account details and an optional QR image for customers to download. Payment is verified manually by the owner, separately from fulfillment status.
- The backend validates store ownership/publication, product availability and options, and calculates totals from current database prices. It stores item name, option, price, and instructions snapshots, and uses an idempotency key plus a private tracking token for safer checkout retries and order tracking.
- A cart is saved on the customer's device per store for seven days. An already loaded menu can be used to edit the cart while offline; reconnection refreshes catalog data and removes unavailable items. Checkout remains online-only, contact/delivery checkout details are not persisted, and chat-to-order has no offline support.

### Orders and owner dashboard

- Store overview with four metrics: sales, total orders, active orders, and possible orders. The KPI date range defaults to today and can be changed.
- Recent orders show the latest five orders, item summaries, status, and a link to manage each order.
- Conversation counts show possible orders and chats needing attention, linking to the matching Chats filters.
- Seven-day sales overview chart and a date range control.
- Order workspace with queue and history views, customer/item/payment details, and status progression through New, Confirmed, Preparing, Ready, Completed, or Cancelled.
- Owners enter delivery fees during order confirmation and update payment status manually.
- Past orders load in cursor-paginated batches of ten.
- Live order updates use authenticated Socket.IO store rooms; chat lists also refresh every ten seconds and update from live events where available.

### Customer chats and assisted order review

- Public `/chat/[store-slug]` route asks for a customer name and starts a customer conversation. Messages appear in the store's Chats workspace as a Web chat draft. The customer can resume in the same browser tab while the draft is open.
- Facebook Messenger Page connection per store using Meta OAuth and a verified webhook. Incoming text messages are deduplicated, grouped by customer, and saved as drafts. PasaOrder looks up the customer's profile name when available, and the owner can send a text reply from the connected Page within Meta's messaging window.
- Chats are grouped as **Possible order**, **Needs attention**, or **Normal**. Possible orders appear in their own filter; conversations needing a response or review appear under Needs attention; ordinary acknowledgements remain in All. The Chats badge counts actionable open conversations, not unread messages.
- New messages are classified in the background by a private FastAPI service using ThinkLess. A lightweight rules provider is the default; optional Laya inference is available for evaluation. Classification failure leaves the owner able to review manually.
- Opening a Possible order starts Gemini structured extraction. The API matches extracted candidates against available products/options in that store and uses database prices; ambiguous or unmatched items remain for owner review. The owner edits and confirms the draft before it enters the normal order workflow.
- The owner can explicitly retry extraction for a Needs attention chat. AI does not send customer replies, change existing orders, or automatically confirm an order.
- Conversation data is retained while a draft is open and cleared when the chat order is confirmed. Completing an order linked to a confirmed chat draft removes that draft while retaining the order record.

### Landing page and PWA

- Public marketing landing page with the positioning “Orders made simple, from chat to checkout.”
- Installable PWA manifest and icons. Installed app launches at login. A service worker caches only the offline fallback page; it does not cache dashboards, orders, chats, or the menu itself.
- Reduced offline support is limited to editing a cart in an already loaded public menu, as described above.

### Local demo data

The API includes a development seed command for dashboard and Chats testing. It creates eight orders for a chosen store (two completed and six active) using available catalog products, plus six synthetic Web chat conversations (two possible orders, two needing attention, and two ordinary conversations). Demo records are tagged and the command is disabled in production. It refuses duplicate data for the same store and day; `--replace` replaces only that store's tagged demo records from today.

```sh
pnpm --filter api seed:demo-orders -- --store-slug=coffee-shop
pnpm --filter api seed:demo-orders -- --store-slug=coffee-shop --replace
```

## Technology and data flow

- **Web:** Next.js App Router, React, TypeScript, Tailwind CSS v4, shadcn/ui, Radix UI, Lucide, and Geist.
- **Main API:** Express and TypeScript. It handles authentication, authorization, catalog operations, orders, Meta webhooks, Gemini extraction, and Socket.IO.
- **Decision service:** Private FastAPI service running ThinkLess for chat classification. It does not own orders or database state.
- **Database:** PostgreSQL via a shared DB package and Drizzle schema/migrations. The database is the source of truth for catalog, prices, availability, conversations, and orders.
- **Images:** Cloudflare R2 using its S3-compatible API; images are served through the application.
- **Shared contracts:** Workspace packages provide database access, TypeScript types, and Zod validation schemas.

```text
Menu link / QR ──> Next.js menu ──> Express API ──> PostgreSQL
Messenger ──> Meta webhook ──> Express ──> PostgreSQL
                                      ├──> ThinkLess / FastAPI (bucket)
                                      └──> Gemini (owner-requested extraction)
Owner dashboard <── Socket.IO / API refresh ──┘
```

## Not implemented or still planned

- Instagram messaging integration.
- Automatic AI replies, public test-chat replies, and automatic follow-ups.
- Automatic payment verification or payment gateway integration.
- Staff accounts, role-based access, and shared team permissions.
- Product modifiers/customizations beyond the current size/piece options and special-instructions text.
- Full offline browsing, offline checkout, offline order management, and offline chat.
- Billing, premium entitlements, and usage metering for AI features.
- Production deployment configuration, backups, monitoring, and abuse/rate-limit controls need to be completed and reviewed for the chosen hosting environment.

## Related project docs

- [Product scope](apps/web/PRODUCT.md)
- [Architecture](docs/architecture.md)
- [Implementation roadmap](docs/roadmap.md)
- [Local setup and operational commands](README.md)
