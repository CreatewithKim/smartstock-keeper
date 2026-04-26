---
name: Account-scoped data sync
description: All business tables are owned per-user; syncService pushes-then-pulls and merges by remoteId so data follows the account across devices without losing local-only rows.
type: feature
---

All business tables (`products`, `sales`, `stock_intakes`, `excess_sales`, `products_out`, `expenses`) carry a NOT NULL `user_id` column with strict RLS: a user can only read/insert/update their own rows; admins can read/delete all.

`src/services/syncService.ts` is the bridge between the local IndexedDB cache and Supabase:
- On sign-in (`AuthContext`), `startSync(userId)` first PUSHES any unsynced local rows (rows missing `remoteId`) so offline-created data reaches the cloud, then PULLS all rows owned by the user.
- The PULL is a **merge**, not a clear-and-replace: it upserts every cloud row by `remoteId` and only deletes local rows whose `remoteId` is no longer present remotely. Local rows without a `remoteId` are preserved (they are pending upload).
- A periodic loop (60s, also triggered by the `online` event) keeps both sides in sync.
- On sign-out or user switch, `stopSyncAndClear()` wipes local IndexedDB so the next user never sees foreign data.
- Every `add()` in `db.ts` triggers `kickSync()` so newly created rows reach the cloud immediately when online.
- A "Force Upload Local Data" button in Settings calls `forceUploadAll(userId)` to push every unsynced row with progress reporting — used for recovery when offline data needs to be reconciled with the account.

Local rows track sync state via `remoteId` and `syncedAt`. The local primary key is overwritten with the remote `id` after a pull so cross-device references stay stable.
