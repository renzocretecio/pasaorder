# PasaOrder product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Store owners and staff who maintain a menu or catalog, receive orders, and track their progress. The initial audience is any store with a menu or catalog, rather than one food-service niche.
- Customers who open a store's menu from a QR code or shared link and place an order in a mobile browser.
- Store owners who review customer chat conversations and use Clef-flash cues and Gemini extraction to prepare order drafts. Facebook Messenger Page connections deliver incoming text messages, look up the customer's profile name when Meta makes it available, and let owners reply from PasaOrder; Instagram remains planned.
- Customers testing the public store chat can enter a name and send messages that appear as an owner-reviewed draft. Replies from the public test chat and automatic AI replies are not available yet.

## Product Purpose

PasaOrder helps a store publish a menu, receive customer orders, and manage them in one place. A successful core journey is: a store publishes its menu and QR/link, a customer opens the menu and orders, and the store sees and handles that order. The first release is intended to support pickup, delivery, and dine-in orders.

## Positioning

The product connects a store's public QR/link ordering flow with its order workspace. Owners can review public test chat and Facebook Messenger conversations in an inbox organized by the current conversation state, use Clef-flash routing and automatic Gemini extraction for clear order candidates, reply to Messenger customers, review an editable order draft against the store catalog, and confirm it into the same order queue. Instagram remains planned.

## Operating Context

- Store users create and update catalog items, share a stable menu link or QR code, review incoming orders, and update order status.
- Customers can copy GCash payment details or download the store's GCash QR code when choosing that payment method. Payment confirmation is a separate step from placing or fulfilling an order.
- Chat ordering must resolve requested items against the store's actual catalog; the model does not set authoritative prices or availability.

## Capabilities and Constraints

- Owner authentication, store setup, contact phone, address, weekly operating hours, store banners, configurable dine-in/to-go/delivery options, category and item editing, optional size/piece variants with individual prices, image uploads, availability, accent customization, private preview, catalog publishing, public menu links, and downloadable menu QR codes exist. Guest checkout and a basic owner order queue with status updates exist. Stores can enable Cash and/or GCash, add copyable GCash account details and an optional QR image, and customers choose a method at checkout. Orders snapshot GCash instructions and track payment status independently; owners manually mark payment paid or unpaid. For delivery, the store sets the fee per order when confirming it. Facebook Messenger supports per-store Page connections, verified inbound text webhooks, best-effort customer profile name lookup, and owner-initiated text replies through Meta. Instagram, automatic payment confirmation, and payment gateways remain planned.
- Store logos, banners, and product images can be uploaded to OCI Object Storage or supplied by public HTTPS URL. Uploaded images are normalized to WebP and served through the app; custom modifiers remain planned. Drafts and inactive stores are not public; publishing requires an available item. Saved edits to published catalogs go live immediately. Making the last item unavailable unpublishes the catalog.
- Each store belongs directly to an owner, with categories, products, and orders attached to stores.
- Public menu ordering is intended to work without requiring a customer account.
- Pickup, delivery, and dine-in are the selected first-release order types.
- GCash copyable details and an optional downloadable QR are manual payment instructions. Store owners verify payment from their GCash account and update the order; automatic payment confirmation or a payment gateway has not been decided.
- The owner chat inbox shows All, Possible order, and Needs attention. Harmless greetings and thanks can remain in All without appearing in an actionable filter. Clef reads the conversation and stores nine intents internally, but the owner sees only the operational queue and next action. Only a clear order with enough detail enters Possible order. Opening a chat starts review automatically. When new-order intent has a distinct lead, Gemini Flash-Lite can add clearly requested items to an editable form even if the chat remains in Needs attention. Tentative, unavailable, and ambiguous items remain listed for owner review. Other requests show guidance and available store facts. Product, store, and payment inquiries show owner-facing facts from catalog/settings data. Modification, cancellation, and status requests stay with the owner because chat identity is not linked to a verified order. PasaOrder matches only unique available catalog items and options; unresolved requests remain visible for manual review. AI review sends chat text to Cloudflare and/or Google when configured; provider failure leaves the manual flow usable. Confirmation re-reads availability and prices from the database and closes the chat draft. Automatic AI replies and post-order follow-ups remain planned.
- A public `/chat/[store-slug]` test route asks for a customer name, then stores customer messages as a Web chat draft in the same review workflow. The customer can resume in the same browser tab while the draft remains open. It does not send a store reply or create an order automatically. Owners refresh messages before review, and confirmation rejects a stale transcript.
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
