# PasaOrder web

Next.js App Router frontend for the public menu portal and merchant dashboard. Owner sign-up, login, sign-out, and a protected dashboard are available.

Run `pnpm dev:web` from the repository root. Shared types and validation are workspace dependencies; secrets and database access belong in the API.

See the [root setup guide](../../README.md) for environment, database, checks, and build commands.

The UI uses Tailwind CSS v4 and shadcn/ui (Radix primitives, Lucide icons). Components live in `components/ui`; theme tokens live in `app/globals.css`. Use `cn` from `@/lib/utils` to merge conditional utilities.

Add components from the web directory:

```sh
cd apps/web
pnpm dlx shadcn@latest add dialog
```

The app currently uses a light theme.
