# PasaOrder product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Store owners who maintain a digital catalog, receive orders, and track their progress. The initial audience is any small business, rather than one food-service niche.
- Customers who open a store's product catalog from a QR code or shared link and place an order in a mobile browser.

## Product Purpose

PasaOrder helps small businesses publish a product catalog, receive customer orders, and manage fulfillment in one place. A successful core journey is: an owner sets up a storefront, adds products or services, and shares its link or QR code; a customer chooses options, leaves an optional order note, and checks out; the owner reviews and manages the order. The flow should work for food, retail, gifts, and services without separate industry-specific apps.

## Positioning

The product connects a store's public QR/link ordering flow with its order workspace. Customers order from the published catalog; owners review incoming orders, enter in-person orders, and manage fulfillment in one queue. Product variants and priced extras capture selectable product choices. Customers may request a scheduled pickup or delivery time, which the store confirms, and opt in to a one-time ready notification. Store owners may opt in to new-order notifications. Optional instructions belong in order notes. Chat ordering, social messaging, AI features, custom checkout questions, and configurable workflow builders are out of the current MVP scope.

## Operating Context

- Store owners create and update catalog items, share a stable storefront link or QR code, review incoming orders, and update order status.
- Store owners can enter walk-in, phone, or in-store orders from the Orders workspace. When the orders page and catalog are already open, an order can be saved on the same device while offline and synced after reconnection. The API rechecks item availability and captured prices before creating it; stale orders stay queued for owner review without holding up other orders. Owners can review current prices, accept a change, or replace unavailable items before resubmitting. Lost responses retain the same request key for a safe retry. Saved orders have visible receipts, timestamps, item summaries, and confirmed discard actions; the entry form resets after a successful local save.
- Customers can copy GCash payment details or download the store's GCash QR code when choosing that payment method. Payment confirmation is a separate step from placing or fulfilling an order.

## Capabilities and Constraints

- Owner authentication supports email/password and optional Google sign-in, with one owner able to switch between stores and choose a default store. Store setup includes business type, contact details, business hours, storefront appearance, and pickup, delivery, or dine-in settings. Owners manage categories, products or services, images, prices, availability, product options, and priced extras; they can preview and publish a catalog and share its link or QR code. XLSX product import is available. Guest checkout and an owner order queue with manual order entry and status updates are available. Stores can enable Cash and/or GCash; customers can upload GCash payment proof for manual owner review. For delivery, the store sets the fee per order when confirming it. PasaOrder does not process or settle payments.
- Store order status follows a simple standard progression. Owners can accept or cancel orders and update their status; complex workflow customization is not part of the MVP.
- Store owners can open Sales Reports for a selected date range to review completed-order sales, all orders received, daily completed sales, and the five best-selling products by units. Reports default to the last seven days, including today. Report dates follow the store reporting timezone (Asia/Manila); open orders count as received but are excluded from sales and product rankings until completed.
- Customers can follow order status from a public tracking link. The page refreshes automatically when the store changes order status, delivery fee, or payment state; customers may separately opt in to a push notification when an order is ready.
- Store logos, banners, and product images can be uploaded to Cloudflare R2 or supplied by public HTTPS URL. Uploaded images are normalized to WebP and served through the app; custom modifiers remain planned. Drafts and inactive stores are not public; publishing requires an available item. Saved edits to published catalogs go live immediately. Making the last item unavailable unpublishes the catalog.
- Each store belongs directly to an owner, with categories, products, and orders attached to stores.
- Public catalog ordering works without requiring a customer account.
- Pickup, delivery, and dine-in are the selected first-release order types.
- GCash copyable details and an optional downloadable QR are manual payment instructions. Store owners verify payment from their GCash account and update the order; automatic payment confirmation or a payment gateway has not been decided.
- Customer chat ordering, Messenger/Instagram integrations, AI classification, and chat order extraction are out of the current MVP. Their product surfaces and active routes are disabled; historical chat and integration records may remain in the database but are not available through the current app.
- Customer research, subscription terms, and pricing have not been established.

## Brand Commitments

- Product name: PasaOrder.
- Food-specific features, such as table numbers, are shown only where appropriate for the store's business type. Food-service language is not a product-wide commitment.

## Evidence on Hand

- The repository contains working owner authentication and a catalog workspace in `apps/web`, plus the store, product, and order data model.
- The current feature checklist is in `docs/roadmap.md`; local setup and operating instructions are in the root `README.md`. `docs/original-project-guide.md` is an archived early proposal, not a description of the current implementation.
- No customer testimonials, merchant performance claims, or approved pricing evidence are available in the project.

## Product Principles

1. Keep catalog and manually entered orders in one trackable order workflow.
2. Make the public ordering path straightforward on a customer's phone.
3. Let store users control catalog truth, order confirmation, and payment verification.
4. Keep order details and pricing under the store owner's control.
