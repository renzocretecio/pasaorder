# Original planning guide (archived)

This is a historical planning document, not a guide to the current product or architecture. It contains proposals for features and integrations—including AI, Meta messaging, and OCI—that are not part of the current implementation. Use the root `README.md`, `PROJECT_SUMMARY.md`, `apps/web/PRODUCT.md`, and `docs/architecture.md` for current behavior. The current data model attaches each store directly to its owner and does not have a separate business entity.

Absolutely. Since you’ve settled on **Next.js + Express + TypeScript + PostgreSQL** with a monorepo, I’d build PasaOrder incrementally rather than setting up every module at once.

The goal is to get to a working **Menu → Cart → Order → Dashboard** first, then add payments, AI, and Meta integrations.

### Target architecture

```text
PasaOrder/
├── apps/
│   ├── web/                  # Next.js
│   └── api/                  # Express + TypeScript
│
├── packages/
│   ├── types/                # Shared TypeScript types
│   └── validation/           # Shared Zod schemas
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

I recommend doing it in **10 steps**.

---

## Step 1 — Install the development tools

You should have:

```text
Node.js 20+
pnpm
Git
PostgreSQL
VS Code
```

Check:

```bash
node -v
pnpm -v
git --version
psql --version
```

For your project, I'd use **pnpm** because the frontend, backend, and shared packages are all TypeScript projects.

---

# Step 2 — Create the monorepo

Create the project:

```bash
mkdir pasaorder
cd pasaorder

git init
pnpm init
```

Create:

```text
apps/
packages/
database/
```

Then:

```bash
mkdir apps packages database
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Your project is now:

```text
pasaorder/
├── apps/
├── packages/
├── database/
├── package.json
└── pnpm-workspace.yaml
```

---

# Step 3 — Create the Next.js application

Inside `apps`:

```bash
cd apps

pnpm create next-app web
```

Choose roughly:

```text
TypeScript       Yes
ESLint           Yes
Tailwind         Yes
src/ directory   Yes
App Router       Yes
Turbopack        Yes
```

Then:

```bash
cd ..
```

You now have:

```text
apps/
└── web/
    ├── src/
    │   └── app/
    ├── public/
    ├── package.json
    └── ...
```

Test it:

```bash
pnpm --filter web dev
```

Open:

```text
http://localhost:3000
```

---

# Step 4 — Create the Express API

Create:

```text
apps/api
```

```bash
mkdir -p apps/api
cd apps/api
pnpm init
```

Install dependencies:

```bash
pnpm add express cors dotenv helmet
pnpm add zod
pnpm add pg
pnpm add jsonwebtoken bcrypt
pnpm add -D typescript tsx @types/node @types/express @types/cors @types/jsonwebtoken @types/bcrypt
```

Create:

```text
apps/api/
├── src/
│   ├── server.ts
│   └── app.ts
├── package.json
└── tsconfig.json
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### `src/app.ts`

```ts
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "pasaorder-api",
  });
});

export default app;
```

### `src/server.ts`

```ts
import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
```

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

Run:

```bash
pnpm dev
```

Then visit:

```text
http://localhost:4000/api/health
```

You should get:

```json
{
  "status": "ok",
  "service": "pasaorder-api"
}
```

---

# Step 5 — Set up PostgreSQL

Create a database:

```sql
CREATE DATABASE pasaorder;
```

Your architecture becomes:

```text
                 ┌──────────────┐
                 │   Next.js    │
                 │     Web      │
                 └──────┬───────┘
                        │
                        │ HTTP
                        ▼
                 ┌──────────────┐
                 │   Express    │
                 │     API      │
                 └──────┬───────┘
                        │
                        │ SQL
                        ▼
                 ┌──────────────┐
                 │ PostgreSQL   │
                 └──────────────┘
```

Create:

```text
apps/api/.env
```

```env
PORT=4000

DATABASE_URL=postgresql://postgres:password@localhost:5432/pasaorder
```

---

# Step 6 — Create your database structure

This is where you should **slow down**.

Don't immediately create 30 tables.

Start with the core business model.

### Initial tables

```text
users
businesses
stores
categories
products
product_options
orders
order_items
customers
payments
```

Relationship:

```text
User
 │
 ▼
Business
 │
 ├── Store
 │    │
 │    ├── Categories
 │    │      │
 │    │      └── Products
 │    │
 │    └── Payment Settings
 │
 └── Orders
       │
       ├── Customer
       │
       └── Order Items
              │
              └── Products
```

For example:

### `users`

```text
id
email
password_hash
name
created_at
```

### `businesses`

```text
id
owner_id
name
slug
created_at
```

### `stores`

```text
id
business_id
name
slug
description
logo_url
is_active
```

### `categories`

```text
id
store_id
name
sort_order
```

### `products`

```text
id
category_id
name
description
price
image_url
is_available
sort_order
```

### `orders`

```text
id
store_id
customer_id
status
order_type
total
notes
created_at
```

### `order_items`

```text
id
order_id
product_id
quantity
unit_price
subtotal
```

---

# Step 7 — Organize the Express backend by modules

Don't put everything into:

```text
routes.ts
controllers.ts
services.ts
```

You'll eventually end up with enormous files.

Use domain modules.

```text
apps/api/src/

├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.repository.ts
│   │
│   ├── businesses/
│   │
│   ├── stores/
│   │
│   ├── menu/
│   │
│   ├── orders/
│   │
│   ├── customers/
│   │
│   ├── payments/
│   │
│   ├── ai/
│   │
│   └── meta/
│
├── middleware/
│
├── routes/
│
├── db/
│
├── config/
│
└── server.ts
```

For example:

```text
orders/
├── order.routes.ts
├── order.controller.ts
├── order.service.ts
├── order.repository.ts
└── order.schema.ts
```

The responsibility is:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
PostgreSQL
```

Example:

```text
POST /api/orders
       ↓
order.controller
       ↓
order.service
       ↓
order.repository
       ↓
PostgreSQL
```

This becomes very useful once PasaOrder gets complicated.

---

# Step 8 — Create shared packages

Now create:

```text
packages/
├── types/
└── validation/
```

### Types

```text
packages/types/
├── src/
│   ├── business.ts
│   ├── store.ts
│   ├── product.ts
│   ├── order.ts
│   └── index.ts
└── package.json
```

For example:

```ts
export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";
```

Both applications can use it:

```text
Next.js
   │
   └── @pasaorder/types

Express
   │
   └── @pasaorder/types
```

---

### Validation

Use Zod:

```text
packages/validation/
└── src/
    ├── auth.ts
    ├── product.ts
    ├── order.ts
    └── index.ts
```

Example:

```ts
import { z } from "zod";

export const createOrderSchema = z.object({
  storeId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })
  ),
});
```

Now both frontend and backend can share validation rules.

---

# Step 9 — Build PasaOrder in this order

This is the most important part.

**Don't start with AI or Meta.**

Build the actual ordering system first.

### Phase 1 — Authentication

Build:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Owner creates account:

```text
Owner
 ↓
Register
 ↓
Business created
 ↓
Store created
```

---

## Phase 2 — Store management

Owner dashboard:

```text
Dashboard
│
├── Store
│   ├── Store Profile
│   ├── Logo
│   └── QR Code
│
├── Menu
│   ├── Categories
│   ├── Products
│   └── Options
│
└── Orders
```

API:

```text
GET    /api/stores/:id
PATCH  /api/stores/:id

GET    /api/stores/:id/categories
POST   /api/stores/:id/categories

GET    /api/categories/:id/products
POST   /api/categories/:id/products
PATCH  /api/products/:id
DELETE /api/products/:id
```

---

# Step 10 — Build the public customer experience

This is the heart of PasaOrder.

Your Next.js routes could be:

```text
app/
├── (dashboard)/
│   ├── dashboard/
│   ├── menu/
│   ├── orders/
│   └── settings/
│
├── store/
│   └── [slug]/
│       ├── page.tsx
│       └── loading.tsx
│
├── order/
│   └── [id]/
│       └── page.tsx
│
└── login/
    └── page.tsx
```

Customer scans:

```text
QR CODE
   ↓
https://pasaorder.com/store/juan-burger
   ↓
Store Menu
   ↓
Product
   ↓
Cart
   ↓
Checkout
   ↓
Order Created
   ↓
Order Tracking
```

---

# The first complete MVP

Once those pieces work, you should have:

```text
                PASAORDER

              ┌─────────────┐
              │   Owner     │
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │   Dashboard │
              └──────┬──────┘
                     │
              Create Menu
                     │
                     ▼
              ┌─────────────┐
              │   Store     │
              │    Menu     │
              └──────┬──────┘
                     │
                  QR Code
                     │
                     ▼
             ┌───────────────┐
             │   Customer    │
             └───────┬───────┘
                     │
                  Add items
                     │
                     ▼
                  Checkout
                     │
                     ▼
                Create Order
                     │
                     ▼
              ┌─────────────┐
              │   Owner     │
              │   Orders    │
              └──────┬──────┘
                     │
               Update status
                     │
                     ▼
              Customer tracks
```

## Then add payments

Once ordering works:

```text
payments/
├── payment.service.ts
├── payment.controller.ts
└── payment.repository.ts
```

Start with:

```text
CASH
GCASH
```

For GCash:

```text
Business
 ├── gcash_name
 ├── gcash_number
 └── gcash_qr_url
```

The customer sees:

```text
Payment Method

○ Cash
○ GCash

GCash:
Juan Dela Cruz
09XXXXXXXXX

[ Copy Number ]

[ Download GCash QR ]
```

You don't need a payment gateway for the first version.

---

# Then add real-time order status

Once the basic system works:

```text
Customer
   │
   │ WebSocket
   ▼
Express
   │
   ▼
Order status
```

Example:

```text
NEW
 ↓
CONFIRMED
 ↓
PREPARING
 ↓
READY
 ↓
COMPLETED
```

Customer tracking page automatically updates.

---

# Then add Object Storage

Don't store uploaded images directly in PostgreSQL.

Use:

```text
Product Image
     ↓
Object Storage
     ↓
https://.../burger.webp
     ↓
PostgreSQL
     ↓
image_url
```

Store:

* product images
* store logo
* GCash QR
* potentially future promotional images

This keeps PostgreSQL focused on structured data.

---

# Then add AI

Only after the normal ordering flow works.

Create:

```text
modules/
└── ai/
    ├── ai.controller.ts
    ├── ai.service.ts
    ├── order-extractor.ts
    └── ai.schemas.ts
```

The flow should be:

```text
Customer message
       ↓
AI
       ↓
Extract intent
       ↓
Structured order draft
       ↓
Validate against DB
       ↓
Owner confirmation
       ↓
Real Order
```

For example:

```text
Customer:

"Pa order 3 burgers,
2 fries and 1 coke."
```

AI produces:

```json
{
  "items": [
    {
      "productName": "Burger",
      "quantity": 3
    },
    {
      "productName": "Fries",
      "quantity": 2
    },
    {
      "productName": "Coke",
      "quantity": 1
    }
  ]
}
```

Then **your backend** checks:

```text
Burger exists?
Fries exists?
Coke exists?
Prices?
Availability?
```

AI should **not** determine these values.

---

# Finally — Meta integration

Only after AI works independently.

Build:

```text
modules/
└── meta/
    ├── meta.controller.ts
    ├── meta.service.ts
    ├── messenger.service.ts
    └── instagram.service.ts

webhooks/
└── meta.webhook.ts
```

Final flow:

```text
Facebook Messenger
        │
        ▼
     Meta API
        │
        ▼
     Webhook
        │
        ▼
     Express
        │
        ▼
   PasaOrder AI
        │
        ▼
 Order extraction
        │
        ▼
 Validate DB
        │
        ▼
 Order Draft
        │
        ▼
 Owner Dashboard
        │
        ▼
 Confirm Order
```

That gives you the differentiating feature of PasaOrder without making it a dependency for the basic product.

---

## Recommended development sequence

If you're actually starting the project now, I'd follow this exact order:

```text
01. Monorepo
        ↓
02. Next.js
        ↓
03. Express
        ↓
04. PostgreSQL
        ↓
05. Database schema
        ↓
06. Authentication
        ↓
07. Business/Store
        ↓
08. Categories/Products
        ↓
09. Public Menu
        ↓
10. Cart
        ↓
11. Checkout
        ↓
12. Orders
        ↓
13. Order Dashboard
        ↓
14. Order Tracking
        ↓
15. GCash/Cash
        ↓
16. Image Storage
        ↓
17. WebSockets
        ↓
18. AI Order Manager
        ↓
19. Facebook Messenger
        ↓
20. Instagram
        ↓
21. Deployment to OCI
```

**Most importantly:** don't build all 21 things before testing the idea. Your first milestone should be:

> **A store owner creates a menu → generates a QR → customer scans it → places an order → owner sees the order.**

Once that works end-to-end, PasaOrder already has a usable core product. Everything after that can be layered onto the same architecture.
