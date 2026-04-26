/**
 * Account-aware sync service.
 *
 * Pushes locally created IndexedDB rows up to Supabase tagged with the
 * current user's id, and pulls the user's rows down so they appear on
 * any device they sign in on.
 *
 * Strategy:
 *  - Local IndexedDB remains the source of truth for the running session
 *    (offline-first). Each row gets an optional `remoteId` once synced.
 *  - On login we PULL all rows owned by the user and merge them into the
 *    local stores by remoteId. This is what makes data visible on a new
 *    device.
 *  - On logout (or user switch) we CLEAR the local stores so the next user
 *    only sees their own data after the next pull.
 *  - A background loop pushes any unsynced local rows and re-pulls every
 *    minute while the tab is online.
 */

import { openDB } from 'idb';
import { supabase } from '@/integrations/supabase/client';
import { ensureDate } from './dateUtils';

type StoreName =
  | 'products'
  | 'sales'
  | 'stockIntakes'
  | 'excessSales'
  | 'productsOut'
  | 'expenses';

// Map local store -> remote table
const STORE_TO_TABLE: Record<StoreName, string> = {
  products: 'products',
  sales: 'sales',
  stockIntakes: 'stock_intakes',
  excessSales: 'excess_sales',
  productsOut: 'products_out',
  expenses: 'expenses',
};

const ALL_STORES: StoreName[] = [
  'products',
  'sales',
  'stockIntakes',
  'excessSales',
  'productsOut',
  'expenses',
];

const DB_NAME = 'smartstock-db';
const DB_VERSION = 4; // must match db.ts

async function openLocal() {
  return openDB(DB_NAME, DB_VERSION);
}

// Convert a local row (camelCase, Date objects) to a remote row (snake_case)
function localToRemote(store: StoreName, row: any, userId: string): any {
  const base = { user_id: userId };
  switch (store) {
    case 'products':
      return {
        ...base,
        name: row.name,
        category: row.category ?? '',
        quantity_kg: row.quantityKg ?? 0,
        selling_price: row.sellingPrice ?? 0,
        current_stock: row.currentStock ?? 0,
        initial_stock: row.initialStock ?? 0,
        low_stock_threshold: row.lowStockThreshold ?? 0,
        local_id: row.id ?? null,
        created_at: ensureDate(row.createdAt).toISOString(),
        updated_at: ensureDate(row.updatedAt).toISOString(),
      };
    case 'sales':
      return {
        ...base,
        product_id: row.productId,
        product_name: row.productName,
        quantity: row.quantity ?? 0,
        unit_price: row.unitPrice ?? 0,
        total_amount: row.totalAmount ?? 0,
        date: ensureDate(row.date).toISOString(),
        notes: row.notes ?? null,
        local_id: row.id ?? null,
      };
    case 'stockIntakes':
      return {
        ...base,
        product_id: row.productId,
        product_name: row.productName,
        quantity: row.quantity ?? 0,
        date: ensureDate(row.date).toISOString(),
        notes: row.notes ?? null,
        vendor_name: row.vendorName ?? null,
        is_paid: !!row.isPaid,
        local_id: row.id ?? null,
      };
    case 'excessSales':
      return {
        ...base,
        amount: row.amount ?? 0,
        date: ensureDate(row.date).toISOString(),
        notes: row.notes ?? null,
        local_id: row.id ?? null,
      };
    case 'productsOut':
      return {
        ...base,
        product_id: row.productId,
        product_name: row.productName,
        quantity: row.quantity ?? 0,
        destination: row.destination ?? '',
        date: ensureDate(row.date).toISOString(),
        notes: row.notes ?? null,
        local_id: row.id ?? null,
      };
    case 'expenses':
      return {
        ...base,
        description: row.description,
        category: row.category ?? '',
        amount: row.amount ?? 0,
        date: ensureDate(row.date).toISOString(),
        notes: row.notes ?? null,
        created_at: ensureDate(row.createdAt).toISOString(),
        local_id: row.id ?? null,
      };
  }
}

// Convert a remote row (snake_case) into the local shape (camelCase, Date)
function remoteToLocal(store: StoreName, row: any): any {
  switch (store) {
    case 'products':
      return {
        name: row.name,
        category: row.category ?? '',
        quantityKg: Number(row.quantity_kg ?? 0),
        sellingPrice: Number(row.selling_price ?? 0),
        currentStock: Number(row.current_stock ?? 0),
        initialStock: Number(row.initial_stock ?? 0),
        lowStockThreshold: Number(row.low_stock_threshold ?? 0),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        remoteId: row.id,
        syncedAt: new Date(row.synced_at ?? row.updated_at ?? Date.now()),
      };
    case 'sales':
      return {
        productId: Number(row.product_id),
        productName: row.product_name,
        quantity: Number(row.quantity ?? 0),
        unitPrice: Number(row.unit_price ?? 0),
        totalAmount: Number(row.total_amount ?? 0),
        date: new Date(row.date),
        notes: row.notes ?? undefined,
        remoteId: row.id,
        syncedAt: new Date(row.synced_at ?? Date.now()),
      };
    case 'stockIntakes':
      return {
        productId: Number(row.product_id),
        productName: row.product_name,
        quantity: Number(row.quantity ?? 0),
        date: new Date(row.date),
        notes: row.notes ?? undefined,
        vendorName: row.vendor_name ?? undefined,
        isPaid: !!row.is_paid,
        remoteId: row.id,
        syncedAt: new Date(row.synced_at ?? Date.now()),
      };
    case 'excessSales':
      return {
        amount: Number(row.amount ?? 0),
        date: new Date(row.date),
        notes: row.notes ?? undefined,
        remoteId: row.id,
        syncedAt: new Date(row.synced_at ?? Date.now()),
      };
    case 'productsOut':
      return {
        productId: Number(row.product_id),
        productName: row.product_name,
        quantity: Number(row.quantity ?? 0),
        destination: row.destination ?? '',
        date: new Date(row.date),
        notes: row.notes ?? undefined,
        remoteId: row.id,
        syncedAt: new Date(row.synced_at ?? Date.now()),
      };
    case 'expenses':
      return {
        description: row.description,
        category: row.category ?? '',
        amount: Number(row.amount ?? 0),
        date: new Date(row.date),
        notes: row.notes ?? undefined,
        createdAt: new Date(row.created_at),
        remoteId: row.id,
        syncedAt: new Date(row.synced_at ?? Date.now()),
      };
  }
}

/** Wipe all local business data (called on sign-out and on user switch). */
export async function clearLocalData() {
  try {
    const db = await openLocal();
    const tx = db.transaction(ALL_STORES as any, 'readwrite');
    await Promise.all(ALL_STORES.map((s) => tx.objectStore(s as any).clear()));
    await tx.done;
  } catch (err) {
    console.warn('[sync] clearLocalData failed', err);
  }
}

/** Pull all remote rows for the user and replace local stores with them. */
export async function pullFromCloud(userId: string) {
  if (!navigator.onLine) return;
  const db = await openLocal();

  for (const store of ALL_STORES) {
    const table = STORE_TO_TABLE[store];
    const { data, error } = await supabase
      .from(table as any)
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.warn(`[sync] pull ${table} failed:`, error.message);
      continue;
    }
    if (!data) continue;

    const tx = db.transaction(store as any, 'readwrite');
    const objStore = tx.objectStore(store as any);

    // Clear and re-insert. Safe because pull happens right after a wipe
    // on login, or as a refresh of an already-synced state.
    await objStore.clear();
    for (const remoteRow of data as any[]) {
      const localRow = remoteToLocal(store, remoteRow);
      // Use remote id as local primary key for stability across devices.
      (localRow as any).id = Number(remoteRow.id);
      await objStore.put(localRow);
    }
    await tx.done;
  }
}

/** Push any local rows that don't yet have a remoteId. */
export async function pushToCloud(userId: string) {
  if (!navigator.onLine) return;
  const db = await openLocal();

  for (const store of ALL_STORES) {
    const table = STORE_TO_TABLE[store];
    const all = await db.getAll(store as any);
    const unsynced = all.filter((r: any) => !r.remoteId);
    if (unsynced.length === 0) continue;

    for (const row of unsynced) {
      const payload = localToRemote(store, row, userId);
      const { data, error } = await supabase
        .from(table as any)
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn(`[sync] push ${table} failed:`, error.message);
        continue;
      }
      if (data) {
        const updated = { ...row, remoteId: (data as any).id, syncedAt: new Date() };
        await db.put(store as any, updated);
      }
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let activeUserId: string | null = null;
let onlineHandler: (() => void) | null = null;

/**
 * Start syncing for the given user. Performs an initial pull, then
 * runs a push+pull loop every 60s while the tab stays online.
 */
export async function startSync(userId: string) {
  // If a different user signs in, blow away the previous user's local
  // cache so they never see foreign data, then pull the new user's data.
  if (activeUserId && activeUserId !== userId) {
    await clearLocalData();
  }
  activeUserId = userId;

  try {
    await pullFromCloud(userId);
  } catch (err) {
    console.warn('[sync] initial pull failed', err);
  }
  try {
    await pushToCloud(userId);
  } catch (err) {
    console.warn('[sync] initial push failed', err);
  }

  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(async () => {
    if (!activeUserId || !navigator.onLine) return;
    try {
      await pushToCloud(activeUserId);
      await pullFromCloud(activeUserId);
    } catch (err) {
      console.warn('[sync] periodic sync failed', err);
    }
  }, 60_000);

  if (!onlineHandler) {
    onlineHandler = () => {
      if (!activeUserId) return;
      pushToCloud(activeUserId).catch(() => {});
      pullFromCloud(activeUserId).catch(() => {});
    };
    window.addEventListener('online', onlineHandler);
  }
}

export interface ForceUploadProgress {
  store: StoreName;
  table: string;
  totalUnsynced: number;
  uploaded: number;
  failed: number;
  done: boolean;
}

export interface ForceUploadResult {
  totalUnsynced: number;
  uploaded: number;
  failed: number;
  byStore: Record<string, { uploaded: number; failed: number; total: number }>;
  errors: string[];
}

/**
 * Push every unsynced local row to the cloud, reporting progress per store.
 * Used by the "Force Upload Local Data" recovery button in Settings.
 */
export async function forceUploadAll(
  userId: string,
  onProgress?: (p: ForceUploadProgress) => void,
): Promise<ForceUploadResult> {
  const result: ForceUploadResult = {
    totalUnsynced: 0,
    uploaded: 0,
    failed: 0,
    byStore: {},
    errors: [],
  };

  if (!navigator.onLine) {
    result.errors.push('You are offline. Connect to the internet and try again.');
    return result;
  }

  const db = await openLocal();

  for (const store of ALL_STORES) {
    const table = STORE_TO_TABLE[store];
    const all = await db.getAll(store as any);
    const unsynced = all.filter((r: any) => !r.remoteId);
    const total = unsynced.length;
    result.totalUnsynced += total;
    result.byStore[store] = { uploaded: 0, failed: 0, total };

    onProgress?.({ store, table, totalUnsynced: total, uploaded: 0, failed: 0, done: total === 0 });
    if (total === 0) continue;

    for (const row of unsynced) {
      const payload = localToRemote(store, row, userId);
      const { data, error } = await supabase
        .from(table as any)
        .insert(payload)
        .select()
        .single();

      if (error) {
        result.failed += 1;
        result.byStore[store].failed += 1;
        result.errors.push(`${table}: ${error.message}`);
      } else if (data) {
        const updated = { ...row, remoteId: (data as any).id, syncedAt: new Date() };
        await db.put(store as any, updated);
        result.uploaded += 1;
        result.byStore[store].uploaded += 1;
      }

      onProgress?.({
        store,
        table,
        totalUnsynced: total,
        uploaded: result.byStore[store].uploaded,
        failed: result.byStore[store].failed,
        done: result.byStore[store].uploaded + result.byStore[store].failed >= total,
      });
    }
  }

  return result;
}

/** Stop syncing and wipe local data (called on sign-out). */
export async function stopSyncAndClear() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
  activeUserId = null;
  await clearLocalData();
}
