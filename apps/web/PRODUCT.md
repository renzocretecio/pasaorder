# PasaOrder product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Store owners and staff who maintain a menu or catalog, receive orders, and track their progress. The initial audience is any store with a menu or catalog, rather than one food-service niche.
- Customers who open a store's menu from a QR code or shared link and place an order in a mobile browser.
- Premium store users who review order drafts extracted from Facebook Messenger or Instagram conversations.

## Product Purpose

PasaOrder helps a store publish a menu, receive customer orders, and manage them in one place. A successful core journey is: a store publishes its menu and QR/link, a customer opens the menu and orders, and the store sees and handles that order. The first release is intended to support pickup, delivery, and dine-in orders.

## Positioning

The product connects a store's public QR/link ordering flow with its order workspace. The planned premium capability turns Messenger and Instagram conversations into structured, trackable order drafts within that same workflow. The owner reviews and confirms an AI-created draft before it becomes an order.

## Operating Context

- Store users create and update catalog items, share a stable menu link or QR code, review incoming orders, and update order status.
- Customers can copy GCash payment details or download the store's GCash QR code when choosing that payment method. Payment confirmation is a separate step from placing or fulfilling an order.
- Chat ordering must resolve requested items against the store's actual catalog; the model does not set authoritative prices or availability.

## Capabilities and Constraints

- Owner authentication, store setup, contact phone, address, weekly operating hours, store banners, configurable dine-in/to-go/delivery options, category and item editing, optional size/piece variants with individual prices, image uploads, availability, accent customization, private preview, catalog publishing, public menu links, and downloadable menu QR codes exist. Guest checkout and a basic owner order queue with status updates exist. For delivery, the store sets the fee per order when confirming it. Cash/GCash setup and verification, expanded order operations, and Meta integrations remain planned.
- Store logos, banners, and product images can be uploaded to OCI Object Storage or supplied by public HTTPS URL. Uploaded images are normalized to WebP and served through the app; custom modifiers remain planned. Drafts and inactive stores are not public; publishing requires an available item. Saved edits to published catalogs go live immediately. Making the last item unavailable unpublishes the catalog.
- Each store belongs directly to an owner, with categories, products, and orders attached to stores.
- Public menu ordering is intended to work without requiring a customer account.
- Pickup, delivery, and dine-in are the selected first-release order types.
- GCash copyable details and a downloadable QR are planned manual payment instructions. Automatic payment confirmation or a payment gateway has not been decided.
- Premium chat extraction creates an editable draft for owner review and confirmation. The choice of Jev or Laya and the LLM provider remains open.
- Customer research, subscription terms, and pricing have not been established.

## Brand Commitments

- Product name: PasaOrder.
- Current authentication copy refers to food, but the confirmed audience includes any store with a menu or catalog. Food-specific language is not a product-wide commitment.

## Evidence on Hand

- The repository contains working owner authentication and a catalog workspace in `apps/web`, plus the store, product, and order data model.
- Product flow and implementation sequence are described in `docs/roadmap.md` and `docs/original-project-guide.md` at the repository root.
- No customer testimonials, merchant performance claims, or approved pricing evidence are available in the project.

## Product Principles

1. Keep menu and future chat orders in one trackable order workflow.
2. Make the public ordering path straightforward on a customer's phone.
3. Let store users control catalog truth, order confirmation, and payment verification.
4. Keep AI output reviewable before it affects a real order.
