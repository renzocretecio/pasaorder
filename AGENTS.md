# PasaOrder project instructions

PasaOrder is a QR/link storefront catalog and order management app for small-business owners and their customers. Read `apps/web/PRODUCT.md` for product scope and `DESIGN.md` for the current visual language before frontend work.

## Workspace

- `apps/web`: Next.js App Router, React, Tailwind CSS v4, shadcn/ui with Radix primitives and Lucide icons. Read `apps/web/AGENTS.md` and the relevant installed Next.js guides before changing Next.js code.
- `apps/api`: Express API. Database access, authorization, and secrets belong here, not in browser code.
- `packages`: shared database, types, and validation. Reuse shared contracts across applications.

## Design skills

- The global `frontend-design` skill lives at `~/.agents/skills/frontend-design/SKILL.md` and applies across projects.
- Project-only Impeccable lives at `.agents/skills/impeccable/SKILL.md`. Its launcher is `.agents/skills/impeccable/scripts/impeccable`; run commands from the app being worked on when app-specific context is needed.
- Preserve existing auth actions, validation, redirects, cookies, and pending/error states when changing presentation. Use the shared auth shell and shadcn components instead of duplicating screens.
- Treat existing visual identity as the baseline for polish. Product features marked planned must not be presented as available.

## Validation

Use pnpm with the repository's configured Node version. Run checks proportional to the change: `pnpm lint`, `pnpm typecheck`, and relevant formatting/tests. `pnpm build` verifies production compilation; `pnpm test:auth:e2e` builds and exercises auth against the configured database using a temporary account that it removes. Browser inspection is separate from compilation; report when visual verification is unavailable.

Keep vendored skill bundles out of application formatting changes. Never reset the database or run destructive migrations as part of UI work. Preserve unrelated local changes.
