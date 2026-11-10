# PasaOrder plans

The app currently defaults new accounts to the Free plan. Plan entitlements are
enforced by the API; hiding a control in the web app is not the security
boundary.

| Limit                     |    Free beta |       Pro |
| ------------------------- | -----------: | --------: |
| Stores                    |            1 |         3 |
| Active products per store |           50 | Unlimited |
| Sales report history      |      30 days |  365 days |
| CSV report export         | Not included |  Included |

Pro is ₱299/month, paid through manual GCash renewal. An owner submits the
transaction reference, and an allowlisted billing administrator verifies and
approves it. Each approval activates or extends Pro by one month; there is no
automatic charge. Accounts retain Pro for a 7-day grace period after
expiration, then return to Free limits without deleting existing data. Set
`SUBSCRIPTION_ADMIN_EMAILS` in the API environment. Owners only submit the
payment reference number in the app; payment arrangements and verification
remain manual. Apply the database migration before deploying the billing
routes.

For exceptional support, the operator command remains available:

```sh
pnpm --filter api exec tsx src/scripts/set-owner-plan.ts owner@example.com PRO
```

Use `FREE` to return an account to the Free plan. Existing stores and products
are retained when an account changes plans; Free limits prevent creating more
stores or activating more products, but do not delete existing data.

To deploy plan enforcement, build and run the database migration before
releasing the API and web applications. The migration assigns all existing
accounts to Free.
