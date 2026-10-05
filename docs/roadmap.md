# Implementation roadmap

1. **Foundation (implemented):** workspace configuration, environment examples/setup, shared DB boundary, authentication/tenant protection, centralized errors, development database, CI, regression tests.
2. **Catalog (implemented):** store setup, permanent menu slug, categories, items with optional size/piece variants and individual prices, OCI image uploads or public HTTPS image links, availability, accent customization, private preview, publication, public mobile catalog, and downloadable menu QR. Custom modifiers remain planned.
3. **Public ordering (implemented):** guest checkout, transactional server-side totals, item snapshots, idempotency, and private tracking tokens. Checkout supports the store's configured fulfillment types; delivery fees are entered by the store during confirmation.
4. **Operations (basic order queue implemented):** owner-wide order inbox, status progression, delivery fee entry, order history, and live Socket.IO refreshes. Store payment options, Cash/GCash checkout selection, snapshotted GCash instructions, and manual payment status verification are implemented. Add database quantity/amount constraints and foreign-key indexes as part of reviewed schema migrations.
5. **Assisted chat:** manually supplied conversations → editable drafts; evaluate Tagalog/English extraction and correction handling.
6. **Meta integrations:** validate permissions/onboarding with a pilot merchant, verified durable webhooks, retry queue, deduplication, conversation state, messaging-window enforcement, human handoff.
7. **Automation/premium:** benchmark an LLM-only baseline against Jev/Laya routing, meter costs and usage, billing/entitlements, automate only workflows supported by measured accuracy.

The first publishable catalog, guest checkout, and basic owner order handling are available. Payment methods are manual; gateway processing and automatic payment verification are not implemented.
