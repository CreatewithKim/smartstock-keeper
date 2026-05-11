import { supabase } from "@/integrations/supabase/client";
import { openDB } from "idb";

/**
 * Two-way cross-device sync layer.
 *
 * Strategy:
 *  - All local mutations push to Supabase via upsert/delete (fire-and-forget when offline).
 *  - On login, on `online`, and on realtime postgres_changes, we pull all rows from Supabase
 *    and write them into IndexedDB, then dispatch a global "cloud-data-changed" event so pages
 *    can reload their state.
 *  - IndexedDB remains the source of truth for reads, so the app keeps working offline.
 */

export type SyncTable =
  | "products"
  | "stock_intakes"
  | "sales"
  | "excess_sales"
  | "products_out"
  | "expenses";

const STORE_BY_TABLE: Record<SyncTable, string> = {
  products: "products",
  stock_intakes: "stockIntakes",
  sales: "sales",
  excess_sales: "excessSales",
  products_out: "productsOut",
  expenses: "expenses",
};

const ALL_TABLES: SyncTable[] = [
  "products",
  "stock_intakes",
  "sales",
  "excess_sales",
  "products_out",
  "expenses",
];

const DATA_CHANGED_EVENT = "cloud-data-changed";

export function emitDataChanged() {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
}

export function onDataChanged(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}

async function getRawDB() {
  return openDB("smartstock-db", 4);
}

const toDate = (v: any) => (v ? new Date(v) : new Date());

// ---------- Mappers: cloud row -> local record ----------

function mapCloudToLocal(table: SyncTable, row: any): any {
  switch (table) {
    case "products":
      return {
        id: row.local_id,
        name: row.name,
        category: row.category,
        quantityKg: Number(row.quantity_kg) || 0,
        sellingPrice: Number(row.selling_price) || 0,
        currentStock: Number(row.current_stock) || 0,
        initialStock: Number(row.initial_stock) || 0,
        lowStockThreshold: Number(row.low_stock_threshold) || 0,
        createdAt: toDate(row.created_at),
        updatedAt: toDate(row.updated_at),
      };
    case "stock_intakes":
      return {
        id: row.local_id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: Number(row.quantity) || 0,
        date: toDate(row.date),
        notes: row.notes ?? undefined,
        vendorName: row.vendor_name ?? undefined,
        isPaid: !!row.is_paid,
      };
    case "sales":
      return {
        id: row.local_id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: Number(row.quantity) || 0,
        unitPrice: Number(row.unit_price) || 0,
        totalAmount: Number(row.total_amount) || 0,
        date: toDate(row.date),
        notes: row.notes ?? undefined,
      };
    case "excess_sales":
      return {
        id: row.local_id,
        amount: Number(row.amount) || 0,
        date: toDate(row.date),
        notes: row.notes ?? undefined,
      };
    case "products_out":
      return {
        id: row.local_id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: Number(row.quantity) || 0,
        destination: row.destination,
        date: toDate(row.date),
        notes: row.notes ?? undefined,
      };
    case "expenses":
      return {
        id: row.local_id,
        description: row.description,
        category: row.category,
        amount: Number(row.amount) || 0,
        date: toDate(row.date),
        notes: row.notes ?? undefined,
        createdAt: toDate(row.created_at),
      };
  }
}

// ---------- Mappers: local record -> cloud row ----------

const iso = (d: any) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

function mapLocalToCloud(table: SyncTable, rec: any, userId: string): any {
  switch (table) {
    case "products":
      return {
        user_id: userId,
        local_id: rec.id,
        name: rec.name,
        category: rec.category,
        quantity_kg: rec.quantityKg,
        selling_price: rec.sellingPrice,
        current_stock: rec.currentStock,
        initial_stock: rec.initialStock,
        low_stock_threshold: rec.lowStockThreshold,
        created_at: iso(rec.createdAt),
        updated_at: iso(rec.updatedAt ?? new Date()),
      };
    case "stock_intakes":
      return {
        user_id: userId,
        local_id: rec.id,
        product_id: rec.productId,
        product_name: rec.productName,
        quantity: rec.quantity,
        date: iso(rec.date),
        notes: rec.notes ?? null,
        vendor_name: rec.vendorName ?? null,
        is_paid: !!rec.isPaid,
      };
    case "sales":
      return {
        user_id: userId,
        local_id: rec.id,
        product_id: rec.productId,
        product_name: rec.productName,
        quantity: rec.quantity,
        unit_price: rec.unitPrice,
        total_amount: rec.totalAmount,
        date: iso(rec.date),
        notes: rec.notes ?? null,
      };
    case "excess_sales":
      return {
        user_id: userId,
        local_id: rec.id,
        amount: rec.amount,
        date: iso(rec.date),
        notes: rec.notes ?? null,
      };
    case "products_out":
      return {
        user_id: userId,
        local_id: rec.id,
        product_id: rec.productId,
        product_name: rec.productName,
        quantity: rec.quantity,
        destination: rec.destination,
        date: iso(rec.date),
        notes: rec.notes ?? null,
      };
    case "expenses":
      return {
        user_id: userId,
        local_id: rec.id,
        description: rec.description,
        category: rec.category,
        amount: rec.amount,
        date: iso(rec.date),
        notes: rec.notes ?? null,
        created_at: iso(rec.createdAt ?? new Date()),
      };
  }
}

// ---------- Public API ----------

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Push (upsert) a single local record to Supabase. Fire-and-forget safe. */
export async function pushRow(table: SyncTable, rec: any): Promise<void> {
  try {
    if (!navigator.onLine) return;
    const userId = await getUserId();
    if (!userId || rec?.id == null) return;
    const payload = mapLocalToCloud(table, rec, userId);
    const { error } = await (supabase.from(table as any) as any).upsert(payload, {
      onConflict: "user_id,local_id",
    });
    if (error) console.warn(`[cloudSync] push ${table} failed:`, error.message);
  } catch (e) {
    console.warn(`[cloudSync] push ${table} threw:`, e);
  }
}

/** Delete a single local record from Supabase. Fire-and-forget safe. */
export async function deleteRow(table: SyncTable, localId: number): Promise<void> {
  try {
    if (!navigator.onLine) return;
    const userId = await getUserId();
    if (!userId) return;
    const { error } = await (supabase.from(table as any) as any)
      .delete()
      .eq("user_id", userId)
      .eq("local_id", localId);
    if (error) console.warn(`[cloudSync] delete ${table} failed:`, error.message);
  } catch (e) {
    console.warn(`[cloudSync] delete ${table} threw:`, e);
  }
}

/** Pull all rows for the current user from Supabase and replace local store contents. */
export async function pullFromCloud(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const userId = await getUserId();
  if (!userId) return false;

  const db = await getRawDB();

  let anyChanged = false;
  for (const table of ALL_TABLES) {
    const { data, error } = await (supabase.from(table as any) as any)
      .select("*")
      .eq("user_id", userId);
    if (error) {
      console.warn(`[cloudSync] pull ${table} failed:`, error.message);
      continue;
    }
    const storeName = STORE_BY_TABLE[table];
    const tx = db.transaction(storeName, "readwrite");
    await tx.store.clear();
    for (const row of data ?? []) {
      const local = mapCloudToLocal(table, row);
      if (local.id != null) {
        try {
          await tx.store.put(local);
        } catch (e) {
          console.warn(`[cloudSync] put ${table} failed:`, e);
        }
      }
    }
    await tx.done;
    anyChanged = true;
  }

  if (anyChanged) emitDataChanged();
  return anyChanged;
}

/** Push every local record up to Supabase (one-time backfill on first login from a device). */
export async function pushAllLocal(): Promise<void> {
  if (!navigator.onLine) return;
  const userId = await getUserId();
  if (!userId) return;
  const db = await getRawDB();
  for (const table of ALL_TABLES) {
    const storeName = STORE_BY_TABLE[table];
    const all = await db.getAll(storeName);
    if (!all.length) continue;
    const payload = all
      .filter((r: any) => r?.id != null)
      .map((r: any) => mapLocalToCloud(table, r, userId));
    if (!payload.length) continue;
    const { error } = await (supabase.from(table as any) as any).upsert(payload, {
      onConflict: "user_id,local_id",
    });
    if (error) console.warn(`[cloudSync] backfill ${table} failed:`, error.message);
  }
}

/** Subscribe to realtime changes on all sync tables. Returns an unsubscribe fn. */
export function subscribeRealtime(userId: string, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };

  const channel = supabase.channel(`cloud-sync-${userId}`);
  for (const table of ALL_TABLES) {
    channel.on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table,
        filter: `user_id=eq.${userId}`,
      },
      debounced,
    );
  }
  channel.subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
