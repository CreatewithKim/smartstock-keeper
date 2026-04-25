# Project Memory

## Core
- **Architecture**: PWA Offline-first. IndexedDB primary storage, hybrid Supabase sync every 5m.
- **Hardware**: Direct Web Serial API integration for ACLAS PS6X weighing scale.
- **Auth**: Supabase Auth (Email/Google) + strict RLS on all core business tables.
- **Data ownership**: All business tables are per-user (user_id NOT NULL). Sync follows the signed-in account across devices.
- **Formatting**: All monetary values in Kenyan Shillings (KSh). Numbers: 2 decimals standard, scale readings 3 decimals.
- **Style**: Glassmorphism UI effects throughout.

## Memories
- [IndexedDB Migrations](mem://architecture/indexeddb-versioning-migrations) — Schema changes must use versioned upgrades
- [PWA Caching](mem://architecture/pwa-caching-strategy) — Network First strategy, background update every 60s
- [PWA Status UI](mem://features/pwa-update-and-status-ui) — Dedicated component for offline status and manual SW refresh
- [React Optimization](mem://architecture/react-instance-optimization) — Vite config dedupes react to fix PWA duplicate instance errors
- [Cloud Sync](mem://architecture/hybrid-cloud-sync-system) — syncService pushes IndexedDB to Supabase when online
- [Account-Scoped Sync](mem://architecture/account-scoped-data-sync) — All data is per-user; syncService pulls/pushes by user_id so data follows the account across devices
- [Web Serial Integration](mem://architecture/direct-web-serial-integration) — Direct offline browser-to-hardware communication
- [Serial Lifecycle](mem://architecture/persistent-serial-connection-lifecycle) — Port persists across route changes, closes on beforeunload
- [Scale Parser](mem://architecture/scale-parser-compatibility) — Generic numeric regex extraction for scale weight signals
- [Scale State Machine](mem://features/scale-weighing-state-machine-logic) — STABLE after 800ms static, Complete Sale always clickable
- [Scale Settings](mem://features/scale-hardware-settings) — Baud Rate/Parity/Stop Bits managed in global Settings page
- [Scale Testing](mem://constraints/scale-testing-environment) — Web Serial API fails in dev iframes; use standalone tab
- [Auth System](mem://auth/application-authentication-system) — Global AuthProvider, ProtectedRoute redirects unauthenticated
- [User Profiles](mem://auth/user-profile-architecture) — 'profiles' table initialized via trigger on signup
- [Remote Admin](mem://features/remote-admin-monitoring) — /admin/login for remote KPIs, requires 'admin' RBAC role
- [Product Quantity](mem://features/product-quantity-kilograms) — Products track quantity in kilograms; no cost price field
- [Product Edits](mem://constraints/product-edit-restrictions) — Current Stock input disabled during product edits
- [Sales Input](mem://features/price-based-sales-input) — Sales record Total Amount; system derives quantity sold
- [Daily Sales View](mem://features/sales/daily-operational-view) — Sales and logs default to current day only
- [Sales History](mem://features/sales/hierarchical-history) — Historical sales grouped by week and date
- [Excess Sales](mem://features/excess-sales-management) — Tracks unaccounted revenue; deducts from Net Stock Value
- [Payment Avenues](mem://features/payment-avenues-reconciliation-and-reporting) — Tracks/reconciles M-Pesa, Pochi la Biashara, Cash
- [Stock Intake](mem://features/stock-intake-vendor-tracking) — Includes vendor name and boolean payment status flag
- [Products Out](mem://features/products-out-distribution-tracking) — Tracks and deducts distributions to other shops
- [Expenses Management](mem://features/expenses-management) — Cost tracking by description, category, and amount
- [Date Normalization](mem://architecture/offline-data-integrity-safeguards) — 'ensureDate' utility converts serialized strings to Date objects
