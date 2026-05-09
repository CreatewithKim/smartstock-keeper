import { supabase } from "@/integrations/supabase/client";
import {
  productDB,
  stockIntakeDB,
  salesDB,
  excessSalesDB,
  productOutDB,
  expenseDB,
} from "./db";

const toISO = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export async function backupToCloud(): Promise<{
  totals: Record<string, number>;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to back up to the cloud.");
  const user_id = user.id;

  const [products, intakes, sales, excess, productsOut, expenses] = await Promise.all([
    productDB.getAll(),
    stockIntakeDB.getAll(),
    salesDB.getAll(),
    excessSalesDB.getAll(),
    productOutDB.getAll(),
    expenseDB.getAll(),
  ]);

  // Replace strategy: wipe this user's rows, then re-insert from local.
  const tables = ["products", "stock_intakes", "sales", "excess_sales", "products_out", "expenses"] as const;
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().eq("user_id", user_id);
    if (error) throw new Error(`Failed clearing ${t}: ${error.message}`);
  }

  const insertChunked = async (table: string, rows: any[]) => {
    if (!rows.length) return;
    const size = 500;
    for (let i = 0; i < rows.length; i += size) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + size));
      if (error) throw new Error(`Failed uploading ${table}: ${error.message}`);
    }
  };

  await insertChunked("products", products.map((p) => ({
    user_id,
    local_id: p.id,
    name: p.name,
    category: p.category,
    quantity_kg: p.quantityKg,
    selling_price: p.sellingPrice,
    current_stock: p.currentStock,
    initial_stock: p.initialStock,
    low_stock_threshold: p.lowStockThreshold,
    created_at: toISO(p.createdAt),
    updated_at: toISO(p.updatedAt),
  })));

  await insertChunked("stock_intakes", intakes.map((s) => ({
    user_id,
    local_id: s.id,
    product_id: s.productId,
    product_name: s.productName,
    quantity: s.quantity,
    date: toISO(s.date),
    notes: s.notes ?? null,
    vendor_name: s.vendorName ?? null,
    is_paid: !!s.isPaid,
  })));

  await insertChunked("sales", sales.map((s) => ({
    user_id,
    local_id: s.id,
    product_id: s.productId,
    product_name: s.productName,
    quantity: s.quantity,
    unit_price: s.unitPrice,
    total_amount: s.totalAmount,
    date: toISO(s.date),
    notes: s.notes ?? null,
  })));

  await insertChunked("excess_sales", excess.map((e) => ({
    user_id,
    local_id: e.id,
    amount: e.amount,
    date: toISO(e.date),
    notes: e.notes ?? null,
  })));

  await insertChunked("products_out", productsOut.map((p) => ({
    user_id,
    local_id: p.id,
    product_id: p.productId,
    product_name: p.productName,
    quantity: p.quantity,
    destination: p.destination,
    date: toISO(p.date),
    notes: p.notes ?? null,
  })));

  await insertChunked("expenses", expenses.map((e) => ({
    user_id,
    local_id: e.id,
    description: e.description,
    category: e.category,
    amount: e.amount,
    date: toISO(e.date),
    notes: e.notes ?? null,
    created_at: toISO(e.createdAt),
  })));

  const totals = {
    products: products.length,
    stock_intakes: intakes.length,
    sales: sales.length,
    excess_sales: excess.length,
    products_out: productsOut.length,
    expenses: expenses.length,
  };
  localStorage.setItem("lastCloudBackup", new Date().toISOString());
  return { totals };
}

export function getLastBackupAt(): Date | null {
  const v = localStorage.getItem("lastCloudBackup");
  return v ? new Date(v) : null;
}
