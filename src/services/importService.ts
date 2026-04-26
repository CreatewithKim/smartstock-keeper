import {
  productDB,
  salesDB,
  stockIntakeDB,
  excessSalesDB,
  productOutDB,
  expenseDB,
  type Product,
} from './db';

export type ImportDataType =
  | 'products'
  | 'sales'
  | 'intakes'
  | 'excessSales'
  | 'productsOut'
  | 'expenses';

export interface ImportResult {
  type: ImportDataType;
  inserted: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ImportProgress {
  type: ImportDataType;
  processed: number;
  total: number;
}

// ---------- Parsing ----------

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseFile(text: string, filename: string): { rows: Record<string, any>[] } {
  const trimmed = text.trim();
  // JSON
  if (filename.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [parsed];
      return { rows: arr.map((r: any) => normalizeKeys(r)) };
    } catch {
      // fall through to CSV
    }
  }
  // CSV
  return { rows: parseCSV(text) };
}

function normalizeKeys(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    out[k.toLowerCase().trim()] = row[k];
  }
  return out;
}

// ---------- Type detection ----------

function pick(row: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return undefined;
}

export function detectType(rows: Record<string, any>[]): ImportDataType | null {
  if (!rows.length) return null;
  const sample = rows[0];
  const keys = Object.keys(sample);
  const has = (...names: string[]) => names.some(n => keys.includes(n));

  // Sales: has unit price & total
  if (has('unitprice', 'unit price', 'unit_price') || has('total', 'totalamount', 'total_amount')) {
    if (has('product', 'productname', 'product_name', 'product name')) return 'sales';
  }
  // Stock intakes: product + quantity + (vendor or "intake")
  if (has('vendor', 'vendorname', 'vendor_name', 'vendor name') || has('ispaid', 'is_paid', 'paid')) {
    return 'intakes';
  }
  // Products out: destination
  if (has('destination')) return 'productsOut';
  // Expenses: description + amount + category
  if (has('description') && has('amount')) return 'expenses';
  // Excess sales: amount but no product
  if (has('amount') && !has('product', 'productname', 'product_name')) return 'excessSales';
  // Products: name + (selling price or stock)
  if (has('name') && (has('sellingprice', 'selling price', 'selling_price', 'price') || has('currentstock', 'current stock', 'current_stock', 'stock'))) {
    return 'products';
  }
  // Sales fallback (product + quantity)
  if (has('product', 'productname', 'product_name', 'product name') && has('quantity')) return 'sales';

  return null;
}

// ---------- Helpers ----------

function toNumber(v: any, fallback = 0): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function toDate(v: any): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function findProductByName(name: string) {
  const all = await productDB.getAll();
  const target = name.toLowerCase().trim();
  return all.find(p => p.name.toLowerCase().trim() === target);
}

// ---------- Importers ----------

async function importProducts(rows: Record<string, any>[], onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
  const result: ImportResult = { type: 'products', inserted: 0, skipped: 0, failed: 0, errors: [] };
  const existing = await productDB.getAll();
  const existingNames = new Set(existing.map(p => p.name.toLowerCase().trim()));

  for (let i = 0; i < rows.length; i++) {
    try {
      const r = rows[i];
      const name = String(pick(r, 'name', 'product', 'productname', 'product_name', 'product name') ?? '').trim();
      if (!name) {
        result.skipped++;
        continue;
      }
      if (existingNames.has(name.toLowerCase())) {
        result.skipped++;
        continue;
      }
      const product: Omit<Product, 'id'> = {
        name,
        category: String(pick(r, 'category') ?? ''),
        quantityKg: toNumber(pick(r, 'quantity (kg)', 'quantitykg', 'quantity_kg', 'quantity kg', 'quantity')),
        sellingPrice: toNumber(pick(r, 'selling price', 'sellingprice', 'selling_price', 'price')),
        currentStock: toNumber(pick(r, 'current stock', 'currentstock', 'current_stock', 'stock')),
        initialStock: toNumber(pick(r, 'initial stock', 'initialstock', 'initial_stock'), toNumber(pick(r, 'current stock', 'currentstock', 'current_stock', 'stock'))),
        lowStockThreshold: toNumber(pick(r, 'low stock threshold', 'lowstockthreshold', 'low_stock_threshold', 'threshold')),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await productDB.add(product);
      existingNames.add(name.toLowerCase());
      result.inserted++;
    } catch (e: any) {
      result.failed++;
      result.errors.push(`Row ${i + 2}: ${e?.message || 'failed'}`);
    }
    onProgress?.({ type: 'products', processed: i + 1, total: rows.length });
  }
  return result;
}

async function importSales(rows: Record<string, any>[], onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
  const result: ImportResult = { type: 'sales', inserted: 0, skipped: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      const r = rows[i];
      const productName = String(pick(r, 'product', 'productname', 'product_name', 'product name') ?? '').trim();
      const product = productName ? await findProductByName(productName) : undefined;
      if (!product) {
        result.failed++;
        result.errors.push(`Row ${i + 2}: product "${productName}" not found. Add the product first.`);
        continue;
      }
      const quantity = toNumber(pick(r, 'quantity', 'qty'));
      const unitPrice = toNumber(pick(r, 'unit price', 'unitprice', 'unit_price', 'price'), product.sellingPrice);
      const totalAmount = toNumber(pick(r, 'total', 'totalamount', 'total_amount', 'total amount'), quantity * unitPrice);
      await salesDB.add({
        productId: product.id!,
        productName: product.name,
        quantity,
        unitPrice,
        totalAmount,
        date: toDate(pick(r, 'date')),
        notes: String(pick(r, 'notes') ?? '') || undefined,
      });
      result.inserted++;
    } catch (e: any) {
      result.failed++;
      result.errors.push(`Row ${i + 2}: ${e?.message || 'failed'}`);
    }
    onProgress?.({ type: 'sales', processed: i + 1, total: rows.length });
  }
  return result;
}

async function importIntakes(rows: Record<string, any>[], onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
  const result: ImportResult = { type: 'intakes', inserted: 0, skipped: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      const r = rows[i];
      const productName = String(pick(r, 'product', 'productname', 'product_name', 'product name') ?? '').trim();
      const product = productName ? await findProductByName(productName) : undefined;
      if (!product) {
        result.failed++;
        result.errors.push(`Row ${i + 2}: product "${productName}" not found.`);
        continue;
      }
      const paidRaw = String(pick(r, 'ispaid', 'is_paid', 'paid') ?? '').toLowerCase();
      await stockIntakeDB.add({
        productId: product.id!,
        productName: product.name,
        quantity: toNumber(pick(r, 'quantity', 'qty')),
        date: toDate(pick(r, 'date')),
        notes: String(pick(r, 'notes') ?? '') || undefined,
        vendorName: String(pick(r, 'vendor', 'vendorname', 'vendor_name', 'vendor name') ?? '') || undefined,
        isPaid: paidRaw === 'true' || paidRaw === 'yes' || paidRaw === '1',
      });
      result.inserted++;
    } catch (e: any) {
      result.failed++;
      result.errors.push(`Row ${i + 2}: ${e?.message || 'failed'}`);
    }
    onProgress?.({ type: 'intakes', processed: i + 1, total: rows.length });
  }
  return result;
}

async function importExcessSales(rows: Record<string, any>[], onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
  const result: ImportResult = { type: 'excessSales', inserted: 0, skipped: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      const r = rows[i];
      await excessSalesDB.add({
        amount: toNumber(pick(r, 'amount')),
        date: toDate(pick(r, 'date')),
        notes: String(pick(r, 'notes') ?? '') || undefined,
      });
      result.inserted++;
    } catch (e: any) {
      result.failed++;
      result.errors.push(`Row ${i + 2}: ${e?.message || 'failed'}`);
    }
    onProgress?.({ type: 'excessSales', processed: i + 1, total: rows.length });
  }
  return result;
}

async function importProductsOut(rows: Record<string, any>[], onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
  const result: ImportResult = { type: 'productsOut', inserted: 0, skipped: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      const r = rows[i];
      const productName = String(pick(r, 'product', 'productname', 'product_name', 'product name') ?? '').trim();
      const product = productName ? await findProductByName(productName) : undefined;
      if (!product) {
        result.failed++;
        result.errors.push(`Row ${i + 2}: product "${productName}" not found.`);
        continue;
      }
      await productOutDB.add({
        productId: product.id!,
        productName: product.name,
        quantity: toNumber(pick(r, 'quantity', 'qty')),
        destination: String(pick(r, 'destination') ?? ''),
        date: toDate(pick(r, 'date')),
        notes: String(pick(r, 'notes') ?? '') || undefined,
      });
      result.inserted++;
    } catch (e: any) {
      result.failed++;
      result.errors.push(`Row ${i + 2}: ${e?.message || 'failed'}`);
    }
    onProgress?.({ type: 'productsOut', processed: i + 1, total: rows.length });
  }
  return result;
}

async function importExpenses(rows: Record<string, any>[], onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
  const result: ImportResult = { type: 'expenses', inserted: 0, skipped: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      const r = rows[i];
      await expenseDB.add({
        description: String(pick(r, 'description') ?? '').trim() || 'Imported expense',
        category: String(pick(r, 'category') ?? ''),
        amount: toNumber(pick(r, 'amount')),
        date: toDate(pick(r, 'date')),
        notes: String(pick(r, 'notes') ?? '') || undefined,
        createdAt: new Date(),
      });
      result.inserted++;
    } catch (e: any) {
      result.failed++;
      result.errors.push(`Row ${i + 2}: ${e?.message || 'failed'}`);
    }
    onProgress?.({ type: 'expenses', processed: i + 1, total: rows.length });
  }
  return result;
}

// ---------- Public API ----------

export async function importFromFile(
  file: File,
  forcedType?: ImportDataType,
  onProgress?: (p: ImportProgress) => void,
): Promise<{ type: ImportDataType; result: ImportResult; rowCount: number }> {
  const text = await file.text();
  const { rows } = parseFile(text, file.name);
  if (!rows.length) {
    throw new Error('The file is empty or could not be parsed.');
  }

  const type = forcedType ?? detectType(rows);
  if (!type) {
    throw new Error('Could not detect the data type. Please choose one manually.');
  }

  let result: ImportResult;
  switch (type) {
    case 'products': result = await importProducts(rows, onProgress); break;
    case 'sales': result = await importSales(rows, onProgress); break;
    case 'intakes': result = await importIntakes(rows, onProgress); break;
    case 'excessSales': result = await importExcessSales(rows, onProgress); break;
    case 'productsOut': result = await importProductsOut(rows, onProgress); break;
    case 'expenses': result = await importExpenses(rows, onProgress); break;
  }

  return { type, result, rowCount: rows.length };
}

export const IMPORT_TYPE_LABELS: Record<ImportDataType, string> = {
  products: 'Products',
  sales: 'Sales',
  intakes: 'Stock Intakes',
  excessSales: 'Excess Sales',
  productsOut: 'Products Out',
  expenses: 'Expenses',
};
