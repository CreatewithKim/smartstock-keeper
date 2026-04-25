---
name: Account-scoped data sync
description: All business tables are owned per-user; syncService pulls/pushes per user_id so data follows the account across devices.
type: feature
---

All business tables (`products`, `sales`, `stock_intakes`, `excess_sales`, `products_out`, `expenses`) carry a NOT NULL `user_id` column with strict RLS: a user can only read/insert/update their own rows; admins can read/delete all.

`src/services/syncService.ts` is the bridge between the local IndexedDB cache and Supabase:
- On sign-in (`AuthContext`), `startSync(userId)` runs an initial PULL of all rows owned by the user, replaces local stores, then PUSHes any unsynced local rows.
- A periodic loop (60s, also triggered by the `online` event) keeps both sides in sync.
- On sign-out or user switch, `stopSyncAndClear()` wipes local IndexedDB so the next user never sees foreign data.
- Every `add()` in `db.ts` triggers `kickSync()` so newly created rows reach the cloud immediately when online.

Local rows track sync state via `remoteId` and `syncedAt`. The local primary key is overwritten with the remote `id` after a pull so cross-device references stay stable.
