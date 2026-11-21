# Role & Objective
Act as a Principal Full-Stack Engineer and Senior UI/UX Designer. We are building a luxury-editorial e-commerce ecosystem for **kushkousins**, a fashion brand selling both **New** and **One-of-a-Kind Upcycled** clothing.

The aesthetic is inspired by Gucci's editorial minimalism—large serif typography, ample whitespace, and tactile interactions—paired with modern, geometric product cards.

# Recommended Architecture (Monorepo)
Initialize a clean monorepo (using Turborepo + pnpm) with the following apps and shared packages:
- `apps/web`: Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion (Customer Storefront + Admin Portal).
- `apps/mobile`: React Native (Expo + Expo Router), NativeWind, React Native Reanimated (iOS & Android app).
- `packages/database`: PostgreSQL with **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`).
- `packages/auth`: **Better Auth** (`better-auth`) configured with standard Email & Password authentication, Role-Based Access Control (`CUSTOMER` | `ADMIN`), and the Expo plugin (`@better-auth/expo`) for seamless mobile auth.
- `packages/ui`: Shared design tokens, typography scales, and core component logic.

> Note: in this repo the database package lives at `packages/db` (`@repo/db`).

# Design System & Visual Identity
- **Color Palette**:
  - Primary Canvas: Warm Alabaster / Cream (`#F7F5F0`)
  - Primary Text & Dark Surface: Deep Forest Green (`#1C2B21`)
  - Secondary Accent / Earth Tone: Rich Espresso (`#38251A`)
  - Highlight / Editorial Badge: Burnt Tangerine (`#EE7218`)
  - Neutral Card Backdrop: Soft Stone (`#E8E6E1`)
- **Typography**:
  - Display / Headings: High-contrast editorial Serif (e.g., *Cormorant Garamond* or *Playfair Display*) with tight tracking.
  - UI / Body / Pricing: Clean Geometric Sans-Serif (e.g., *Inter* or *Plus Jakarta Sans*).
- **Currency**: Default to **KES** (Kenyan Shillings).
- **Signature Card Geometry**:
  - Product cards must feature asymmetric **chamfered corners** (clipped top-left and bottom-right corners using CSS `clip-path` on web and SVG/masked views on mobile).
  - Include floating top-left discount/status pills (e.g., `-20%`, `UPCYCLED`), an optional editorial star badge for featured pieces, and a circular quick-add shopping bag button anchored to the bottom-right.

# Core Features & Page Architecture

## 1. Web Storefront (`apps/web`)
Model the navigation and multi-page depth after Gucci's storefront:
- **Global Navigation**: Minimalist sticky header with left links (`NEW ARRIVALS`, `UPCYCLED`, `COLLECTIONS`, `ABOUT US`), centered serif **kushkousins** wordmark, and right utility icons (Search, Account, Wishlist, Shopping Bag with live count).
- **Landing Page (`/`)**:
  - **Hero — "The Hanging Line"**: A full-width interactive horizontal clothing rack. Garments hang side-by-side on minimalist wire hangers along a thin horizontal rail. By default, items are neatly aligned; hovering or clicking a garment smoothly scales it forward, subtly parts adjacent garments using spring physics (Framer Motion), and reveals a floating editorial card with the item name, price, `One-of-a-kind` / `New` tag, and a `View Details` CTA.
  - **Fan Favorites Section**: A horizontal showcase of fast-moving and on-offer pieces using the signature chamfered-corner cards, category filter pills (`All`, `Upcycled`, `Streetwear`, `Formal`, `Outerwear`), strikethrough pricing for discounts, and `Previous` / `Next` progress controls.
  - **Editorial Lookbook**: Full-bleed asymmetric grid highlighting upcycled craftsmanship stories.
- **Category / Shop Pages (`/shop/[category]`)**: Filterable product grid (Type: New vs. Upcycled, Size, Price, Color) with instant sort and quick-add.
- **Product Detail Page (`/product/[slug]`)**: High-res editorial gallery, size selector (or a dedicated **"1-of-1 Unique Piece"** badge for upcycled items with garment provenance/materials story), and sticky add-to-bag bar.
- **Cart Drawer & Checkout (`/checkout`)**: Slide-over bag drawer with real-time stock validation (crucial for preventing double-purchasing 1-of-1 upcycled items) and a clean multi-step checkout.
- **Customer Account (`/account`)**: Better Auth Email/Password sign-in & sign-up, order history, saved wishlist, and shipping addresses.

## 2. Mobile Application (`apps/mobile`)
Translate the web experience natively rather than wrapping a webview:
- **Touch-Native Hanging Line**: Convert the hover-based rack into a horizontal gesture-driven carousel with snap-to-center physics. As the user swipes across the rack, the centered garment scales up and reveals its floating detail card with subtle haptic feedback.
- **Navigation**: Clean bottom tab bar (`Home`, `Shop`, `Upcycled`, `Bag`, `Profile`).
- **Cards**: 2-column staggered grid using the same chamfered-corner card aesthetic and quick-add bag button.
- **Auth**: Integrated with Better Auth (`@better-auth/expo`) using Email & Password.

## 3. Admin Dashboard (`apps/web/app/admin`)
Protected by Better Auth RBAC (`role === 'ADMIN'`):
- **Inventory Management**: Full CRUD for products. Must support two distinct inventory modes:
  1. `NEW`: Standard SKU matrix (Size/Color variants with multi-unit stock counts).
  2. `UPCYCLED`: Single-unit (`stock = 1`), auto-archived/marked sold upon checkout, with fields for "Original Material" and "Artisan Notes".
- **Landing Page Curation**: Toggle which products appear on **The Hanging Line** (with drag-and-drop ordering) and in **Fan Favorites** (with discount percentage overrides).
- **Orders & Fulfillment**: Order status pipeline (`Pending Payment` -> `Paid` -> `Processing` -> `Shipped` -> `Delivered`), customer details, M-Pesa receipt tracking, and revenue overview dashboard.

## 4. Payments — M-Pesa (Safaricom Daraja API) [Implement Last]
- Integrate **M-Pesa STK Push (Lipa Na M-Pesa Online)** for both Web and Mobile checkout.
- Include a secure webhook/callback endpoint to verify `CheckoutRequestID`, record the `MpesaReceiptNumber`, transition the order to `Paid`, and atomically decrement stock (or mark `UPCYCLED` items as sold).

# Execution Plan
Do not generate everything at once. Follow this phased approach and wait for my approval after each phase:
1. **Phase 1**: Initialize the monorepo, PostgreSQL + **Drizzle ORM** schema & seed script (with sample New and Upcycled products in KES), and **Better Auth** (Email/Password + Admin RBAC).
2. **Phase 2**: Build the Design System tokens, Tailwind config, chamfered card component, and the interactive **Hanging Line** component.
3. **Phase 3**: Build the remaining Web Storefront pages (PLP, PDP, Cart, Account, and Checkout with a placeholder/mock payment confirmation).
4. **Phase 4**: Build the Admin Dashboard (Inventory, Curation, Orders).
5. **Phase 5**: Build the React Native (Expo) Mobile App sharing types, API endpoints, and Better Auth.
6. **Phase 6**: Replace the mock checkout with live **M-Pesa (Daraja API)** STK Push, callback webhooks, and atomic stock locking.
