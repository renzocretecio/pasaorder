# Architecture

## Boundaries

Next.js owns the customer portal and owner dashboard. Express owns authentication, tenant authorization, business operations, and future webhook ingestion. PostgreSQL is the source of truth.

Requests flow through route → controller → service → repository. Controllers translate HTTP inputs/outputs; services validate and apply business rules; repositories use parameterized SQL. Share request schemas through `@pasaorder/validation`, response contracts through `@pasaorder/types`, and server-only database access through `@pasaorder/db`. Never import the database package into the browser.

The API configures the database once. The DB package creates pools without reading environment variables at import time. Services receive unknown request input and parse it before repository access. Auth middleware verifies signed token issuer, audience, expiry, and subject, then checks the user’s persisted token version. Logout increments that version to invalidate all issued tokens for the account. All merchant data access must include authenticated ownership.

## Adding a domain

Add a directory under `apps/api/src/modules` when implementing the domain, with routes, controller, service, and repository files as needed. Mount its router in `modules/index.ts`. Avoid empty placeholder modules. Add shared schemas/contracts only when used. Update database schema and generate/review migrations together.

Keep public menu access separate from merchant management. Public order tracking should use a random, unguessable access token, not an enumerable database ID. Do not accept owner/customer identity as an authorization decision from a request body.

## Future ordering and integrations

Portal checkout and chat confirmation resolve catalog items within the selected store, verify availability, compute totals server-side, snapshot item names/options/prices, and insert order/items atomically. The Express API sends saved chat messages to a private FastAPI service using ThinkLess. That service returns one of three buckets: Possible order, Needs attention, or Normal. Questions and greetings need a human reply and enter Needs attention; simple acknowledgements enter Normal. The default rules provider abstains on ambiguity, which also maps to Needs attention; optional Laya inference requires language-specific evaluation. Opening a Possible order triggers Gemini extraction; the owner can explicitly override a route for other chats. Gemini uses a stateless structured-output request, and Express resolves only unique, available catalog names and options. Neither ThinkLess nor Gemini determines authoritative prices or mutates existing orders. Chat confirmation keeps its source channel on the order and clears the private conversation text after confirmation. The remaining confirmed draft links a Messenger customer to an active order; completing that order deletes the draft in the same transaction while preserving the order and item snapshots.

The public `/chat/[store-slug]` test route stores a customer name and message thread as a `WEB_CHAT` draft. The API stores only a hash of the customer's resume token, caps message count and transcript length, and appends messages atomically. Each store can connect one Facebook Page and one linked Instagram professional account through Meta OAuth; Page tokens are encrypted at rest, and incoming text events are accepted only after validating Meta's webhook signature. Events are deduplicated by Meta message ID, grouped by channel and sender ID into an active draft, and sent to the same ThinkLess/Gemini review path. PasaOrder makes a best-effort profile lookup for Messenger names and Instagram usernames and lets the store owner send text replies through the connected account. Background classification saves a decision only if the transcript has not changed. The owner edits matched order details and confirms the draft into the order queue.

Payment status is independent of fulfillment status. Manual GCash submissions require merchant verification; provider webhooks need signature validation and deduplication when integrated.

Direct Meta integrations remain future work. Persist incoming social events before asynchronous processing, verify Meta signatures against raw request bytes, deduplicate provider message IDs, track conversation revisions, and apply explicit human handoff. An AI extraction provider has not been selected; when added, keep model output editable and enforce catalog, money, and tenant constraints in deterministic backend rules.

Before production, add authentication abuse protection/rate limiting, a reviewed session/token revocation policy, deployment secret management, database backups, and monitoring. No deployment is included in this foundation setup.
