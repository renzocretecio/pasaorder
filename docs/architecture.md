# Architecture

## Boundaries

Next.js owns the customer portal and owner dashboard. Express owns authentication, tenant authorization, business operations, and future webhook ingestion. PostgreSQL is the source of truth.

Requests flow through route → controller → service → repository. Controllers translate HTTP inputs/outputs; services validate and apply business rules; repositories use parameterized SQL. Share request schemas through `@pasaorder/validation`, response contracts through `@pasaorder/types`, and server-only database access through `@pasaorder/db`. Never import the database package into the browser.

The API configures the database once. The DB package creates pools without reading environment variables at import time. Services receive unknown request input and parse it before repository access. Auth middleware verifies signed token issuer, audience, expiry, and subject, then checks the user’s persisted token version. Logout increments that version to invalidate all issued tokens for the account. All merchant data access must include authenticated ownership.

## Adding a domain

Add a directory under `apps/api/src/modules` when implementing the domain, with routes, controller, service, and repository files as needed. Mount its router in `modules/index.ts`. Avoid empty placeholder modules. Add shared schemas/contracts only when used. Update database schema and generate/review migrations together.

Keep public menu access separate from merchant management. Public order tracking should use a random, unguessable access token, not an enumerable database ID. Do not accept owner/customer identity as an authorization decision from a request body.

## Future ordering and integrations

Portal checkout and chat confirmation resolve catalog items within the selected store, verify availability, compute totals server-side, snapshot item names/options/prices, and insert order/items atomically. Optional Cloudflare Clef-flash analysis runs in the API and stores one of nine typed intents plus clarification/LLM/human probability cues on a draft. The deterministic decision router applies intent-specific confidence thresholds. Opening a chat triggers review; a clear new-order request or a lower-confidence new-order request with a distinct lead can reach Gemini extraction even if the inbox bucket is Needs attention. Tentative items do not enter the form. The owner can explicitly override a route. A Clef failure falls back to extraction. Modification, cancellation, status, and inquiry intents never mutate or disclose an existing order from unverified chat identity. Product, store, and payment inquiries can show the owner read-only database facts. Optional Gemini Flash-Lite extraction uses a stateless structured-output request; the API resolves only unique, available catalog names and options, returning unresolved items for owner review. Neither model determines authoritative prices. Chat confirmation keeps its source channel on the order and clears the private conversation text after confirmation. Add idempotency keys before accepting checkout retries.

The public `/chat/[store-slug]` test route stores a customer name and message thread as a `WEB_CHAT` draft. The API stores only a hash of the customer's resume token, caps message count and transcript length, and appends messages atomically. Each store can also connect one Facebook Page through Meta OAuth; its Page token is encrypted at rest, and incoming Messenger text events are accepted only after validating Meta's webhook signature. Events are deduplicated by Meta message ID, grouped into an active draft by sender ID, and passed to the same Clef/Gemini review path. PasaOrder makes a best-effort profile lookup for the Messenger customer's name and lets the store owner send text replies through the connected Page. Background Clef analysis saves a decision only if the transcript has not changed. Clear actionable orders go to Possible order, requests needing a person go to Needs attention, and harmless greetings or thanks remain in All only. The owner edits matched order details and confirms the draft into the order queue. Instagram messaging is not supported yet.

Payment status is independent of fulfillment status. Manual GCash submissions require merchant verification; provider webhooks need signature validation and deduplication when integrated.

Direct Meta integrations remain future work. Persist incoming social events before asynchronous processing, verify Meta signatures against raw request bytes, deduplicate provider message IDs, track conversation revisions, and apply explicit human handoff. An AI extraction provider has not been selected; when added, keep model output editable and enforce catalog, money, and tenant constraints in deterministic backend rules.

Before production, add authentication abuse protection/rate limiting, a reviewed session/token revocation policy, deployment secret management, database backups, and monitoring. No deployment is included in this foundation setup.
