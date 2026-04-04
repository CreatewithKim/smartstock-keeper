import { supabase } from '@/integrations/supabase/client';
import { productDB, salesDB, stockIntakeDB, excessSalesDB, productOutDB, expenseDB } from './db';

let syncInProgress = false;

async function syncProducts() {
  const products = await productDB.getAll();
  for (const product of products) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('local_id', product.id!)
      .maybeSingle();

    const row = {
      local_id: product.id!,
      name: product.name,
      category: product.category,
      quantity_kg: product.quantityKg,
      selling_price: product.sellingPrice,
      current_stock: product.currentStock,
      initial_stock: product.initialStock,
      low_stock_threshold: product.lowStockThreshold,
      created_at: product.createdAt instanceof Date ? product.createdAt.toISOString() : new Date(product.createdAt).toISOString(),
      updated_at: product.updatedAt instanceof Date ? product.updatedAt.toISOString() : new Date(product.updatedAt).toISOString(),
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('products').update(row).eq('id', existing.id);
    } else {
      await supabase.from('products').insert(row);
    }
  }
}

async function syncSales() {
  const sales = await salesDB.getAll();
  for (const sale of sales) {
    const { data: existing } = await supabase
      .from('sales')
      .select('id')
      .eq('local_id', sale.id!)
      .maybeSingle();

    const row = {
      local_id: sale.id!,
      product_id: sale.productId,
      product_name: sale.productName,
      quantity: sale.quantity,
      unit_price: sale.unitPrice,
      total_amount: sale.totalAmount,
      date: sale.date instanceof Date ? sale.date.toISOString() : new Date(sale.date).toISOString(),
      notes: sale.notes || null,
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('sales').update(row).eq('id', existing.id);
    } else {
      await supabase.from('sales').insert(row);
    }
  }
}

async function syncStockIntakes() {
  const intakes = await stockIntakeDB.getAll();
  for (const intake of intakes) {
    const { data: existing } = await supabase
      .from('stock_intakes')
      .select('id')
      .eq('local_id', intake.id!)
      .maybeSingle();

    const row = {
      local_id: intake.id!,
      product_id: intake.productId,
      product_name: intake.productName,
      quantity: intake.quantity,
      date: intake.date instanceof Date ? intake.date.toISOString() : new Date(intake.date).toISOString(),
      notes: intake.notes || null,
      vendor_name: intake.vendorName || null,
      is_paid: intake.isPaid,
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('stock_intakes').update(row).eq('id', existing.id);
    } else {
      await supabase.from('stock_intakes').insert(row);
    }
  }
}

async function syncExcessSales() {
  const items = await excessSalesDB.getAll();
  for (const item of items) {
    const { data: existing } = await supabase
      .from('excess_sales')
      .select('id')
      .eq('local_id', item.id!)
      .maybeSingle();

    const row = {
      local_id: item.id!,
      amount: item.amount,
      date: item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString(),
      notes: item.notes || null,
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('excess_sales').update(row).eq('id', existing.id);
    } else {
      await supabase.from('excess_sales').insert(row);
    }
  }
}

async function syncProductsOut() {
  const items = await productOutDB.getAll();
  for (const item of items) {
    const { data: existing } = await supabase
      .from('products_out')
      .select('id')
      .eq('local_id', item.id!)
      .maybeSingle();

    const row = {
      local_id: item.id!,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      destination: item.destination,
      date: item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString(),
      notes: item.notes || null,
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('products_out').update(row).eq('id', existing.id);
    } else {
      await supabase.from('products_out').insert(row);
    }
  }
}

async function syncExpenses() {
  const items = await expenseDB.getAll();
  for (const item of items) {
    const { data: existing } = await supabase
      .from('expenses')
      .select('id')
      .eq('local_id', item.id!)
      .maybeSingle();

    const row = {
      local_id: item.id!,
      description: item.description,
      category: item.category,
      amount: item.amount,
      date: item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString(),
      notes: item.notes || null,
      created_at: item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date(item.createdAt).toISOString(),
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('expenses').update(row).eq('id', existing.id);
    } else {
      await supabase.from('expenses').insert(row);
    }
  }
}

export async function syncAllData() {
  if (syncInProgress) return;
  syncInProgress = true;
  
  try {
    console.log('[Sync] Starting data sync to cloud...');
    await Promise.all([
      syncProducts(),
      syncSales(),
      syncStockIntakes(),
      syncExcessSales(),
      syncProductsOut(),
      syncExpenses(),
    ]);
    console.log('[Sync] Data sync completed successfully');
  } catch (error) {
    console.error('[Sync] Error syncing data:', error);
  } finally {
    syncInProgress = false;
  }
}

export function initAutoSync() {
  // Sync when coming online
  window.addEventListener('online', () => {
    console.log('[Sync] App came online, triggering sync...');
    syncAllData();
  });

  // Sync on initial load if online
  if (navigator.onLine) {
    // Delay slightly to let IndexedDB initialize
    setTimeout(() => syncAllData(), 3000);
  }

  // Periodic sync every 5 minutes when online
  setInterval(() => {
    if (navigator.onLine) {
      syncAllData();
    }
  }, 5 * 60 * 1000);
}
