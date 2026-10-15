---
name: PasaOrder
description: A warm, practical storefront identity paired with a premium operational workspace for menus, catalogs, ordering, and business management.

colors:
  primary: "#244d35"
  forest: "#173d2c"
  lime: "#d6efa8"

  background: "#f8faf7"
  auth-background: "#f6f5ef"
  foreground: "#18251d"
  card: "#ffffff"

  dashboard-background: "#f8faf7"
  dashboard-surface: "#ffffff"
  dashboard-surface-raised: "#eef2ea"
  dashboard-foreground: "#18251d"
  dashboard-muted: "#59685d"
  dashboard-border: "#d6dfd6"

  muted-foreground: "#59685d"
  border: "#d6dfd6"
  auth-input-border: "#859184"
  ring: "#37794b"
  destructive: "#aa3428"

color-distribution:
  rule: "60-30-10"
  strict: false

  auth:
    dominant-60:
      role: "Warm neutral foundation"
      colors:
        - "#f6f5ef"
        - "#f8faf7"

    secondary-30:
      role: "Brand structure and supporting surfaces"
      colors:
        - "#173d2c"
        - "#ffffff"

    accent-10:
      role: "Actions, selected states, and restrained emphasis"
      colors:
        - "#244d35"
        - "#d6efa8"

  storefront:
    dominant-60:
      role: "Clean neutral shopping surface"
      colors:
        - "#f8faf7"
        - "#ffffff"

    secondary-30:
      role: "Brand structure, product grouping, and supporting surfaces"
      colors:
        - "#173d2c"
        - "#ffffff"

    accent-10:
      role: "Primary actions, active states, and small highlights"
      colors:
        - "#244d35"
        - "#d6efa8"

  dashboard:
    dominant-60:
      role: "Light application foundation"
      colors:
        - "#f8faf7"

    secondary-30:
      role: "Operational surfaces and structural separation"
      colors:
        - "#ffffff"
        - "#eef2ea"

    accent-10:
      role: "Primary actions, selected states, and meaningful emphasis"
      colors:
        - "#244d35"
        - "#d6efa8"

  guidance:
    - "Treat 60-30-10 as a visual composition guideline, not a strict mathematical requirement."
    - "Apply the distribution to the overall screen or surface, not every individual component."
    - "Do not interpret the 10 percent allocation as requiring lime on 10 percent of the interface."
    - "Forest green is the primary brand and action color; lime is a restrained supporting accent."
    - "Semantic success, warning, destructive, and informational colors are exempt from the accent allocation and should only appear when their meaning applies."
    - "Avoid spreading accent colors across too many icons, badges, borders, controls, and decorative elements."

typography:
  fontFamily:
    sans: "Geist, Arial, Helvetica, sans-serif"

  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5

  page-title:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"

  section-title:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"

  field-label:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4

  metadata:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4

  price:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 600

  auth-heading:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.04em"

rounded:
  control: "10px"
  primary-button: "12px"
  illustration-panel: "32px"
---

# Overview

PasaOrder combines a warm, approachable customer-facing identity with a focused operational workspace for store owners.

The established authentication experience pairs warm cream with forest green and a soft lime accent. It should feel approachable, practical, and appropriate for businesses that manage menus, catalogs, and customer orders.

The business dashboard uses a light theme by default for now, with an operational layout. It should feel premium and focused without becoming futuristic, overly technical, or visually noisy.

The customer storefront should remain welcoming, simple, product-focused, and optimized for customers arriving through QR codes or shared links.

This document records both established implementation decisions and the intended design direction for future PasaOrder interfaces.

Runtime theme tokens live in `apps/web/app/globals.css`. Authentication composition lives in `apps/web/components/auth/auth-page-shell.tsx`.

Update this document whenever an intentional visual change modifies the established PasaOrder design language.

# Authority

This document is the source of truth for PasaOrder's visual language.

When instructions conflict, use this priority:

1. Explicit requirements in the current task.
2. Existing intentional PasaOrder patterns documented here.
3. The design language and rules in this document.
4. Global frontend or design skills.
5. shadcn/ui defaults.

Do not allow generic design recommendations, external design skills, or default shadcn styling to override established PasaOrder design decisions.

Existing implementation should not automatically be considered authoritative if this document explicitly identifies it as transitional.

# Implementation Status

## Authentication

**Status: Established**

Preserve the existing authentication identity unless the task explicitly requests an authentication redesign.

Authentication uses:

- Warm cream backgrounds.
- Forest green primary surfaces.
- Soft lime accents.
- Geist typography with Arial and Helvetica fallbacks.
- A large decorative storefront illustration on desktop.
- Clear, high-contrast form controls.
- Shared `AuthPageShell` and `AuthForm` composition.

Authentication is currently the most developed visual reference for PasaOrder's warm brand identity.

## Public landing page

**Status: Established**

The public home page presents PasaOrder as an order management tool for small Filipino stores. Its headline is “Orders made simple, from chat to checkout.” The page uses the existing Geist typeface, forest green, soft lime, and warm neutral foundation. A warm light opening pairs a large left-aligned headline with compact supporting copy and actions. Wide neighborhood-store photography, a forest-green handoff strip, and a lime-backed interactive example give the page its identity. The primary action leads to account creation. A sticky header keeps sign-in reachable on mobile.

The landing page’s focal motion is a visitor-controlled Messenger → owner review → confirmed order walkthrough. Its play sequence is finite, pauses offscreen, and stops when the document is hidden. Reduced-motion preferences remove spatial transitions and playback while preserving manual stage controls. Section reveals run once, retain visible HTML before JavaScript, and cancel when reduced motion is enabled. CTA arrows provide small directional feedback; avoid perpetual decorative loops.

Marketing copy must distinguish current QR/link checkout and owner-reviewed Facebook Messenger order drafts from planned capabilities. Demonstrations are explicitly illustrative; do not invent testimonials, metrics, prices, or automatic payment confirmation. Keep the page readable on phones and tablets, with the handoff path stacking vertically on narrow screens.

## Business Dashboard

**Status: Light default**

The owner workspace uses light backgrounds, white surfaces, forest green actions, and muted green secondary surfaces. Light is the default for now, including when the device prefers dark mode.

New dashboard pages should use the shared semantic theme tokens. A dark palette remains available in CSS through the opt-in `.merchant-theme.dark` selector; no theme toggle is implemented.

Workspace pages use a direct page title with supporting copy beneath it. Put the selected store name and other page context in that supporting line, and align page actions beside the title on wider screens and below it on narrow screens. Avoid repeating a small eyebrow label above every workspace title.

Do not automatically redesign unrelated existing dashboard screens while working on a scoped task.

Manual order entry uses a bottom sheet on phones and a centered dialog on larger screens. Keep its header and subtotal/action footer outside the scrolling form, with safe-area padding at the bottom. Searchable product rows show product, option, category, and price; selected items use 44px quantity and removal controls with wrapping names and visible line totals. Saved device orders and creation receipts stay visible in the Orders workspace. Distinguish waiting, review, and connection-retry states; changed prices require an explicit acceptance action.

Keep theme changes intentional and preserve the existing operational layout.

## Customer Storefront

**Status: Direction established; implementation may evolve**

New storefront work should follow the mobile-first, product-focused direction defined in this document.

The storefront should visually belong to PasaOrder while allowing the individual business's products, logo, and identity to remain prominent.

# Design Direction

- Clean, modern, operational, and premium.
- Prioritize clarity and speed over decoration.
- The interface should feel like a real business product, not an AI-generated SaaS template.
- Use strong typography, deliberate whitespace, subtle depth, and clear visual hierarchy.
- Make important actions immediately understandable.
- Keep visual noise low.
- Prefer purposeful simplicity over decorative complexity.
- Every visual element should support comprehension, navigation, ordering, or business operations.

# Visual Style

PasaOrder should feel grounded, practical, and trustworthy.

Use warm neutrals, forest greens, restrained lime accents, and intentional contrast.

Avoid generic technology aesthetics.

The three major product surfaces have different visual requirements:

- Authentication: warm, welcoming, cream-and-green.
- Business dashboard: light by default, compact, operational.
- Customer storefront: clean, inviting, product-focused, mobile-first.

These surfaces should feel related through typography, color, spacing, controls, and interaction patterns without being visually identical.

Use neutral surfaces with restrained brand color.

Prefer subtle borders, tonal separation, whitespace, and typography before adding shadows or containers.

Use rounded corners moderately.

Do not make every piece of content a floating rounded rectangle.

Allow content to breathe rather than nesting cards inside cards.

# Colors

## Brand Colors

Forest green is the primary PasaOrder brand color.

Use it for:

- Brand identity.
- Primary actions.
- Important selected states.
- Navigation emphasis where appropriate.
- Major branded surfaces.

Lime is a supporting accent.

Use it sparingly for:

- Highlights.
- Illustration details.
- Small areas of emphasis.
- Selected branded moments.

Do not allow lime to dominate large application surfaces.

## Authentication Colors

Authentication uses:

- Warm cream background.
- Forest illustration panel.
- Lime emphasis.
- Pale green supporting text on dark forest surfaces.

Both authentication forms use a darker input border than the generic input primitive to make controls clearer against cream backgrounds.

Preserve this treatment in the shared authentication shell.

## Dashboard Colors

The dashboard uses a light palette by default:

- `dashboard-background`: primary application background.
- `dashboard-surface`: standard secondary surface.
- `dashboard-surface-raised`: selectively elevated or emphasized surface.
- `dashboard-foreground`: primary readable text.
- `dashboard-muted`: secondary and metadata text.
- `dashboard-border`: subtle structural separation.

Use forest green for primary actions and selected states. Merchant form controls use `#859184` borders for clear visibility against light surfaces.

The retained dark palette uses green-charcoal backgrounds and lime actions. Activate it only through an intentional future theme change; do not follow the device color scheme automatically.

## Semantic Colors

Brand color and semantic status colors serve different purposes.

- Forest green: brand identity, primary actions, selected states.
- Success green: completed, successful, available.
- Amber: attention, preparing, pending, waiting.
- Red: destructive, cancelled, failed, unavailable.
- Muted neutral: inactive, secondary, informational.

Success green should remain visually distinguishable from the primary forest brand color.

Never rely on color alone to communicate state.

Combine color with text, icons, labels, or other clear indicators.

Green must never imply that a payment has been confirmed unless the payment state has actually been confirmed by the application.

# Typography

Geist is the primary typeface, with Arial and Helvetica fallbacks. Load Geist locally through the Next.js font package so the site does not rely on a browser font request. Check fallback behavior and layout when changing font metrics.

## Hierarchy

Page titles should be confident but not oversized.

Application interfaces should use typography to establish hierarchy before relying on containers.

Use:

- Page titles for page-level context.
- Section titles for meaningful content groups.
- Body text for primary information.
- Field labels for persistent form context.
- Metadata text for timestamps, IDs, secondary details, and supporting information.

Avoid unnecessarily large hero typography inside the business dashboard.

## Authentication Typography

Authentication headings are:

- 40px on mobile.
- 48px from the small breakpoint where appropriate.
- Semibold.
- Tightly tracked at `-0.04em`, with `1.15` line height.
- Balanced when wrapping.

Desktop illustration copy may use 36–48px typography with a lighter weight.

Supporting copy is 16px with relaxed line height.

Authentication field labels are 13px.

## Dashboard Typography

Dashboard typography should support rapid scanning.

Order numbers, customer names, totals, status, and primary actions should establish clear hierarchy.

Secondary information such as timestamps, source, notes, and IDs should be quieter.

Do not make every metric or number oversized.

# Layout

Prefer flat page composition over nested containers.

Use whitespace, typography, alignment, dividers, and tonal changes to establish hierarchy before introducing cards.

Maintain consistent page widths, spacing, and alignment.

Primary actions should be easy to locate.

Tables and lists should be preferred when they communicate operational information more effectively than cards.

Do not use a grid of cards simply because the data can fit inside cards.

## Authentication Layout

Authentication pages use a full-height composition capped at 1440px.

Outer padding grows from:

- 20px.
- To 32px.
- To 40px.

Below 1280px:

- Show the form column.
- Hide the illustration panel.

At desktop widths (1280px and above):

- Use two equal columns.
- Keep the forest illustration panel inset and vertically centered within its column, rather than filling the entire column. This gives warm neutrals more visual weight in line with the 60-30-10 guidance.
- Use warm light text on the panel; reserve lime primarily for small brand and illustration details.

The form is capped at approximately 390px.

A brand link appears above the form.

A quiet footer appears below it, separated by a subtle divider. Align the brand, form, and footer to the same content width. Do not place decorative icons above authentication headings.

Both authentication pages center the form column at intermediate widths.

Registration uses less vertical padding to accommodate additional fields.

Permit natural vertical scrolling on short screens.

Do not force the submit button outside a fixed-height container.

## Dashboard Layout

The owner workspace starts with a compact header on phones, an account disclosure, and a bottom navigation bar with the implemented Stores and New store destinations. Keep planned operations out of navigation until they exist.

At 768px and above, replace the bottom navigation with an 88px rail. Show the full 216px sidebar from 1280px. Keep portrait and landscape iPad layouts usable; a tablet should not inherit a wide desktop sidebar.

The publish panel precedes catalog items on narrow screens and becomes a contextual side panel from 1024px. Sharing controls and the setup checklist use a disclosure to keep the main task in view. Published catalogs keep visibility controls inside the sharing section, while draft catalogs expose the publish action. Category/item actions stay reachable under the compact header while browsing.

Chat order review stacks the conversation before order details on phones. From tablet width, use a 60/40 split with editable order details on the left and the conversation and review guidance on the right. Keep item controls readable within the narrower order column.

Dashboard content should be information-dense without feeling crowded.

Prioritize operational information above decorative analytics.

Use consistent alignment across page headers, filters, tables, lists, and actions.

Avoid unnecessary nested surface layers.

## Storefront Layout

The storefront is mobile-first.

Assume many customers arrive through:

- QR codes.
- Messenger links.
- Instagram links.
- Shared URLs.

Design the primary experience for narrow screens first and progressively enhance larger screens.

# Dashboard Density

The business dashboard is an operational interface intended for frequent use.

Default to compact-to-moderate information density.

Do not use oversized cards for simple counts, statuses, or metadata.

Keep order rows easy to scan quickly.

Important order information should normally be visible without opening the full order:

- Order number.
- Customer.
- Total.
- Order source.
- Time.
- Current status.

Secondary metadata should be visually quieter than operational actions.

Use progressive disclosure for information that is useful but not immediately necessary.

Avoid forcing owners to open multiple dialogs or pages to understand basic order state.

Prefer compact controls when the action is frequently repeated.

# Elevation & Depth

Depth should remain restrained.

Use, in order of preference:

1. Spacing.
2. Typography.
3. Tonal surface changes.
4. Borders.
5. Subtle shadows only when necessary.

Authentication inputs have no shadow in the shared auth shell.

The storefront illustration awning may use a small soft shadow.

Dashboard surfaces should primarily use tonal differences and borders rather than floating shadows.

Avoid excessive drop shadows.

Avoid creating visual hierarchy solely through elevation.

Keep decorative illustration separate from task controls.

# Shapes

Control corners are moderately rounded.

Current established values include:

- Controls: 10px.
- Primary authentication buttons: 12px.
- Authentication illustration panel: 32px.

The storefront authentication illustration uses an alternating cream/lime awning. The redesigned auth shell uses a shared SVG storefront with shelves, a door, and a small plant above the supporting copy.

Its inset rounded doorway depicts a physical doorframe and is illustration geometry, not a reusable card treatment.

Do not propagate large illustration radii to dashboard cards or application containers.

Avoid excessive pill-shaped UI.

Reserve pills for elements where the shape is semantically appropriate, such as compact status indicators or tags.

# Components

Use local shadcn primitives from `apps/web/components/ui`.

Use `cn` from `@/lib/utils`.

Use shadcn as primitives, not as the design language.

PasaOrder determines:

- Composition.
- Layout.
- Spacing.
- Surface treatment.
- Typography.
- Density.
- Branding.
- Visual hierarchy.

shadcn provides implementation primitives.

Customize shadcn components to match the PasaOrder visual language rather than preserving their default appearance.

Do not automatically wrap every section in:

- `Card`
- `CardHeader`
- `CardContent`

Prefer typography, spacing, dividers, and layout hierarchy before introducing containers.

Use Tailwind CSS for styling.

Keep shared UI primitives in `components/ui`.

Keep domain-specific components inside their corresponding `features` directory.

Do not create new abstractions when an existing primitive or feature component already solves the problem cleanly.

# Forms

Forms should remain explicit and predictable.

Keep labels persistent.

Do not rely on placeholders as labels.

Authentication and merchant editing inputs are 48px high. Use at least 16px text in editable controls on phones and tablets. Merchant editing forms keep their submit button above phone navigation; leave enough content padding for the action bar and device safe area. On tablets and desktop, submit controls stay within the form.

Authentication submit buttons are 52px high.

Password visibility controls must maintain at least a 44px touch target.

Preserve:

- Visible focus.
- Required field indicators where appropriate.
- Correct autocomplete attributes.
- Password confirmation.
- Pending states.
- Disabled states.
- Accessible error descriptions.
- Existing backend success and failure behavior.

Validation errors should appear near the relevant control whenever possible.

Avoid using destructive styling before an actual validation or request error exists.

# Iconography

Use Lucide icons.

Icons should clarify an action, state, or navigation destination.

Do not use icons merely to decorate headings.

Prefer text labels for important actions.

Do not rely on unfamiliar icon-only controls for important operations.

Keep icon size and stroke weight visually consistent.

Avoid placing an icon inside every:

- Heading.
- Card.
- Metric.
- Navigation item.
- Button.

Use icons intentionally.

# Motion

Motion should communicate state changes rather than decorate the interface.

Keep most transitions subtle and fast, generally between 150ms and 250ms.

Use motion for:

- State transitions.
- Opening and closing overlays.
- Order status feedback.
- Navigation changes where useful.
- Small interaction confirmations.

Avoid:

- Entrance animations on every card or row.
- Continuous floating elements.
- Bouncing UI.
- Glowing animations.
- Excessive scale effects.
- Decorative motion that delays interaction.

Respect `prefers-reduced-motion`.

Order status changes may use brief visual feedback to confirm that the operation succeeded.

# Accessibility

Accessibility is a product requirement.

Maintain strong text-to-background contrast.

Provide visible keyboard focus states.

Use semantic HTML.

Interactive elements must have adequate touch targets.

Do not communicate meaning through color alone.

Decorative illustrations must be hidden from assistive technology.

Form controls must have accessible names.

Errors must be associated with the relevant controls.

Status changes should remain understandable without relying solely on animation.

Customer ordering flows must remain usable on narrow screens and with increased text size.

# Customer Storefront

The customer storefront should feel inviting, simple, and fast.

It must not look like the business dashboard.

Product photography, product names, prices, availability, and ordering actions should dominate the hierarchy.

Make adding items to the cart extremely obvious.

Keep checkout short and distraction-free.

Avoid unnecessary account creation.

Avoid dashboard-like cards, analytics styling, or admin-oriented density.

Maintain the PasaOrder brand language while allowing each business's:

- Logo.
- Store name.
- Products.
- Product photography.
- Business identity.

to remain visually prominent.

The PasaOrder platform should support the store rather than visually overpower it.

## Store Accent

Use the store's accent for primary buttons and active categories. Prices and secondary controls use a readable shade of that accent, darkened when needed for contrast on light surfaces. Selected options and hover states use a subtle accent tint. Primary button labels use contrasting black or white.

Apply the same scoped theme variables to product and cart dialog content rendered through portals. Include shared button hover and focus tokens so they do not fall back to PasaOrder green.

Catalog image placeholders inherit the store accent tint and readable accent foreground, including missing or failed images in dialogs. Outside a store theme, they fall back to the shared muted colors. Product photos retain their original colors.

The cart action floats at the bottom right with a visible item count. Respect device safe areas and the owner preview’s mobile navigation, and leave enough bottom padding to scroll content clear of the action.

## Storefront Product Presentation

The menu opens with the complete store profile above category navigation and products. Its wide banner and overlapping square logo follow a familiar social profile composition. The banner is optional; an accent-tinted cover remains when none is set. Show the store name, full description, optional address and tap-to-call phone number, and weekly hours when configured. Display closed days and mark closing times after midnight as next day. Give the banner a restrained height on phones and keep the profile details easy to scan before the catalog.

Prioritize:

1. Product image.
2. Product name.
3. Price.
4. Short description where useful.
5. Availability.
6. Options or variants.
7. Add-to-cart action.

Do not bury price or availability beneath decorative content.

Use product cards only where they improve browsing.

Product lists may use flatter layouts on narrow screens when that improves scanning.

## Cart

The cart should make the following immediately clear:

- Items.
- Quantities.
- Options.
- Individual prices.
- Total.
- Primary checkout action.

Quantity controls should be easy to operate with one hand on mobile.

Do not hide the checkout action unnecessarily.

## Checkout

Checkout should be short and task-focused.

Avoid unrelated navigation or promotional content.

Clearly separate:

- Customer information.
- Pickup or delivery.
- Payment method.
- Order summary.
- Final order action.

Payment instructions must never visually imply successful payment before confirmation exists.

# Business Dashboard

The dashboard should feel like a focused operational workspace.

Optimize for frequent daily use.

Orders and order status receive the strongest visual priority.

Prefer:

- Tables.
- Lists.
- Tabs.
- Compact operational views.
- Contextual drawers or sheets.

over large decorative cards.

Surface actionable information before analytics.

Analytics should answer operational questions rather than exist as decoration.

Examples:

- How many orders need attention?
- Which orders are preparing?
- Which orders are ready?
- What requires action now?

AI features should feel integrated into existing workflows rather than appearing as a separate chatbot product.

# Orders

Orders are the operational center of PasaOrder.

Order interfaces should prioritize:

- Status.
- Customer.
- Items.
- Total.
- Source.
- Time.
- Fulfillment method.
- Immediate next action.

Status changes should be obvious and quick.

New-order cards stay compact, with View order and Confirm order actions together. View order opens the full review in a dialog, presented as a bottom sheet on phones. Delivery confirmation opens the dialog so the owner can set the required fee.

Do not make owners navigate through unnecessary layers to perform common order actions.

Use semantic status treatment consistently.

New, preparing, ready, completed, and cancelled orders must remain distinguishable without relying only on color.

# AI Order Manager

AI is a supporting capability, not the visual identity of PasaOrder.

Do not introduce:

- Purple AI gradients.
- Sparkling backgrounds.
- Neon glows.
- Futuristic AI illustrations.
- Excessive "magic" iconography.

AI-assisted orders should visually belong to the normal order workflow.

Clearly distinguish:

- Original customer message.
- AI interpretation.
- Extracted order draft.
- Missing or uncertain information.
- Owner confirmation.

AI output should never visually imply certainty when clarification is required.

The owner should remain in control of creating or confirming an order.

# Responsive Behavior

Customer storefront experiences must be designed mobile-first.

Business dashboard experiences prioritize phones and tablets/iPads. Desktop layouts enhance the same workflow.

Do not simply shrink desktop layouts.

Reorganize information according to priority.

On narrow screens:

- Preserve primary actions.
- Collapse secondary information where appropriate.
- Maintain readable spacing.
- Avoid horizontal overflow.
- Use sheets or drawers when they improve focused interaction.
- Keep frequent order actions reachable.
- Account for device safe areas in headers, bottom navigation, and editing action bars.
- Preserve browser zoom and text enlargement.
- Use product image fallbacks when an optional remote image fails to load.

# Interaction

Keep interactions predictable.

Primary actions should be obvious.

Provide immediate feedback for important operations such as:

- Creating an order.
- Updating order status.
- Saving a menu item.
- Updating store settings.
- Submitting checkout.

Use dialogs only when confirmation or focused input is necessary.

Prefer sheets or drawers for quick editing where they preserve context.

Always provide clear:

- Loading states.
- Empty states.
- Success states.
- Error states.
- Disabled states.

Do not block the entire page for small local operations unless necessary.

# Avoid

Avoid generic AI-generated SaaS aesthetics.

Specifically avoid:

- Purple/blue AI gradients.
- Excessive gradients.
- Glassmorphism unless explicitly requested.
- Neon glows.
- Oversized rounded cards everywhere.
- Box-in-a-box layouts.
- Excessive floating surfaces.
- Decorative elements that do not improve usability.
- Generic admin dashboard templates.
- Excessive badges.
- Excessive pills.
- Excessive shadows.
- Excessive borders.
- Icons attached to every heading or metric.
- Huge numbers used merely to fill space.
- Unnecessary hero sections inside application pages.
- Decorative charts without operational value.
- Artificial testimonials.
- Fictional customer logos.
- Fictional business metrics.
- Fictional payment confirmations.

# Do's and Don'ts

## Do

- Keep the main action clear.
- Keep labels persistent.
- Write copy specifically for store owners and customers.
- Preserve strong contrast.
- Preserve keyboard usability.
- Preserve narrow-screen readability.
- Use whitespace intentionally.
- Prefer straightforward layouts.
- Keep frequent actions easy to reach.
- Make order state immediately understandable.
- Make customer ordering simple.
- Keep AI subordinate to the actual ordering workflow.
- Use real application data when available.
- Use realistic empty states when data is unavailable.

## Don't

- Add fictional metrics.
- Add fictional testimonials.
- Add fictional customer logos.
- Invent payment confirmation.
- Invent order state.
- Add decoration that competes with signing in, ordering, or managing orders.
- Introduce generic AI visual language.
- Automatically convert every content group into a card.
- Redesign unrelated screens while implementing a scoped feature.

# Implementation References

Current visual implementation references include:

- Global theme tokens:
  `apps/web/app/globals.css`

- Authentication shell:
  `apps/web/components/auth/auth-page-shell.tsx`

- Shared UI primitives:
  `apps/web/components/ui`

These implementation references should remain aligned with this document.

When an intentional design change modifies established PasaOrder patterns, update both the implementation and this document.

# Final Implementation Rule

Before generating, modifying, reviewing, or polishing HTML, CSS, Tailwind, or React UI for PasaOrder:

1. Read this document.
2. Identify which surface is being modified:
   - Authentication.
   - Business dashboard.
   - Customer storefront.
3. Respect that surface's established or target design direction.
4. Reuse existing intentional patterns before introducing new ones.
5. Use shadcn as primitives, not as the design language.
6. Prefer clarity, usability, and operational efficiency over decoration.
7. Do not redesign unrelated surfaces unless explicitly requested.

When uncertain, choose the simpler, clearer, more purposeful solution.
