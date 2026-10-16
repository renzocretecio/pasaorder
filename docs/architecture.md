# Architecture

## Boundaries

Next.js owns the customer menu and owner dashboard. Express owns authentication, tenant authorization, and business operations. PostgreSQL is the source of truth.

Requests flow through route → controller → service → repository. Controllers translate HTTP inputs/outputs; services validate and apply business rules; repositories use parameterized SQL. Share request schemas through `@pasaorder/validation`, response contracts through `@pasaorder/types`, and server-only database access through `@pasaorder/db`. Never import the database package into the browser.

The API configures the database once. The DB package creates pools without reading environment variables at import time. Services receive unknown request input and parse it before repository access. Auth middleware verifies signed token issuer, audience, expiry, and subject, then checks the user’s persisted token version. Logout increments that version to invalidate all issued tokens for the account. All merchant data access must include authenticated ownership.

## Adding a domain

Add a directory under `apps/api/src/modules` when implementing the domain, with routes, controller, service, and repository files as needed. Mount its router in `modules/index.ts`. Avoid empty placeholder modules. Add shared schemas/contracts only when used. Update database schema and generate/review migrations together.

Keep public menu access separate from merchant management. Public order tracking should use a random, unguessable access token, not an enumerable database ID. Do not accept owner/customer identity as an authorization decision from a request body.

## Ordering

Public checkout and manual order entry resolve catalog items within the selected store, verify availability, compute totals server-side, snapshot item names/options/prices, and insert order/items atomically. The store owner reviews incoming orders and controls confirmation and fulfillment. Chat ordering and Meta messaging integrations have been removed from the application; their legacy database records and migrations remain available for data retention.

Payment status is independent of fulfillment status. Manual GCash submissions require merchant verification; provider webhooks need signature validation and deduplication when integrated.

Before production, add authentication abuse protection/rate limiting, a reviewed session/token revocation policy, deployment secret management, database backups, and monitoring. No deployment is included in this foundation setup.
