# PasaOrder product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Store owners and staff who maintain a menu or catalog, receive orders, and track their progress. The initial audience is any store with a menu or catalog, rather than one food-service niche.
- Customers who open a store's menu from a QR code or shared link and place an order in a mobile browser.
- Store owners who review customer chat conversations and use ThinkLess inbox sorting and Gemini extraction to prepare order drafts. Facebook Messenger Page and linked Instagram professional account connections deliver incoming text messages, look up the customer's profile name when Meta makes it available, and let owners reply from PasaOrder.
- Customers testing the public store chat can enter a name and send messages that appear as an owner-reviewed draft. Replies from the public test chat and automatic AI replies are not available yet.

## Product Purpose

PasaOrder helps a store publish a menu, receive customer orders, and manage them in one place. A successful core journey is: a store publishes its menu and QR/link, a customer opens the menu and orders, and the store sees and handles that order. The first release is intended to support pickup, delivery, and dine-in orders.

## Positioning

The product connects a store's public QR/link ordering flow with its order workspace. Owners can review public test chat, Facebook Messenger, and Instagram conversations in an inbox organized by the current conversation state, use ThinkLess to sort conversations and Gemini to extract orders during review, reply to connected Meta messaging customers, review an editable order draft against the store catalog, and confirm it into the same order queue.

## Operating Context

- Store users create and update catalog items, share a stable menu link or QR code, review incoming orders, and update order status.
- Customers can copy GCash payment details or download the store's GCash QR code when choosing that payment method. Payment confirmation is a separate step from placing or fulfilling an order.
- Chat ordering must resolve requested items against the store's actual catalog; the model does not set authoritative prices or availability.

## Capabilities and Constraints

- Owner authentication supports email/password and optional Google sign-in, plus store setup, contact phone, address, weekly operating hours, store banners, configurable dine-in/to-go/delivery options, category and item editing, XLSX product import with preview, optional size/piece variants with individual prices, image uploads, availability, accent customization, private preview, catalog publishing, public menu links, and downloadable menu QR codes exist. Guest checkout and a basic owner order queue with status updates exist. Stores can enable Cash and/or GCash, add copyable GCash account details and an optional QR image, and customers choose a method at checkout. Orders snapshot GCash instructions and track payment status independently; owners manually mark payment paid or unpaid. For delivery, the store sets the fee per order when confirming it. Facebook Messenger supports per-store Page connections, verified inbound text webhooks, best-effort customer profile name lookup, and owner-initiated text replies through Meta. Instagram supports per-store connections to a professional account linked to a Facebook Page, inbound text webhooks, best-effort customer username lookup, and owner-initiated replies. Automatic payment confirmation and payment gateways remain planned.
- Store logos, banners, and product images can be uploaded to Cloudflare R2 or supplied by public HTTPS URL. Uploaded images are normalized to WebP and served through the app; custom modifiers remain planned. Drafts and inactive stores are not public; publishing requires an available item. Saved edits to published catalogs go live immediately. Making the last item unavailable unpublishes the catalog.
- Each store belongs directly to an owner, with categories, products, and orders attached to stores.
- Public menu ordering is intended to work without requiring a customer account.
- Pickup, delivery, and dine-in are the selected first-release order types.
- GCash copyable details and an optional downloadable QR are manual payment instructions. Store owners verify payment from their GCash account and update the order; automatic payment confirmation or a payment gateway has not been decided.
- The owner chat inbox shows All, Possible order, and Needs attention. ThinkLess sorts the conversation into these three buckets; greetings and product, store, or payment questions enter Needs attention because the owner may need to reply. Simple thanks and acknowledgements remain in All. Obvious new orders enter Possible order, while ambiguity, complaints, and possible changes to active orders stay in Needs attention. The workspace Chats badge counts open conversations in Possible order and Needs attention for the selected store; it is not an unread-message count. Opening a Possible order starts Gemini review automatically. Only items Gemini marks as ordered and the API uniquely matches to available catalog products enter the editable form; tentative and ambiguous items remain for owner review. The owner can explicitly retry extraction for a Needs attention chat. PasaOrder sends chat text only to the private classifier and, during review, to Google when Gemini is configured. Provider failure leaves manual review usable. Confirmation re-reads availability and prices from the database and closes the chat draft. Automatic AI replies and post-order follow-ups remain planned.
- A public `/chat/[store-slug]` test route asks for a customer name, then stores customer messages as a Web chat draft in the same review workflow. The customer can resume in the same browser tab while the draft remains open. It does not send a store reply or create an order automatically. Owner chat views update as new messages arrive, and confirmation rejects a stale transcript.
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
