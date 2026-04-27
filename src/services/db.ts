import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Product {
  id?: number;
  name: string;
  category: string;
  quantityKg: number;
  sellingPrice: number;
  currentStock: number;
  initialStock: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockIntake {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  date: Date;
  notes?: string;
  vendorName?: string;
  isPaid: boolean;
}

export interface Sale {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  date: Date;
  notes?: string;
}

export interface ExcessSale {
  id?: number;
  amount: number;
  date: Date;
  notes?: string;
}

export interface ProductOut {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  destination: string;
  date: Date;
  notes?: string;
}

interface SmartStockDB extends DBSchema {
  products: {
    key: number;
    value: Product;
    indexes: { 'by-category': string };
  };
  stockIntakes: {
    key: number;
    value: StockIntake;
    indexes: { 'by-product': number; 'by-date': Date };
  };
  sales: {
    key: number;
    value: Sale;
    indexes: { 'by-product': number; 'by-date': Date };
  };
  excessSales: {
    key: number;
    value: ExcessSale;
    indexes: { 'by-date': Date };
  };
  productsOut: {
    key: number;
    value: ProductOut;
    indexes: { 'by-product': number; 'by-date': Date; 'by-destination': string };
  };
}

let dbInstance: IDBPDatabase<SmartStockDB> | null = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SmartStockDB>('smartstock-db', 3, {
    upgrade(db, oldVersion) {
      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', {
          keyPath: 'id',
          autoIncrement: true,
        });
        productStore.createIndex('by-category', 'category');
      }

      // Stock intakes store
      if (!db.objectStoreNames.contains('stockIntakes')) {
        const intakeStore = db.createObjectStore('stockIntakes', {
          keyPath: 'id',
          autoIncrement: true,
        });
        intakeStore.createIndex('by-product', 'productId');
        intakeStore.createIndex('by-date', 'date');
      }

      // Sales store
      if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', {
          keyPath: 'id',
          autoIncrement: true,
        });
        salesStore.createIndex('by-product', 'productId');
        salesStore.createIndex('by-date', 'date');
      }

      // Excess sales store (added in version 2)
      if (!db.objectStoreNames.contains('excessSales')) {
        const excessSalesStore = db.createObjectStore('excessSales', {
          keyPath: 'id',
          autoIncrement: true,
        });
        excessSalesStore.createIndex('by-date', 'date');
      }

      // Products out store (added in version 3)
      if (!db.objectStoreNames.contains('productsOut')) {
        const productsOutStore = db.createObjectStore('productsOut', {
          keyPath: 'id',
          autoIncrement: true,
        });
        productsOutStore.createIndex('by-product', 'productId');
        productsOutStore.createIndex('by-date', 'date');
        productsOutStore.createIndex('by-destination', 'destination');
      }
    },
  });

  return dbInstance;
}

// Product operations
export const productDB = {
  async getAll(): Promise<Product[]> {
    const db = await getDB();
    return db.getAll('products');
  },

  async getById(id: number): Promise<Product | undefined> {
    const db = await getDB();
    return db.get('products', id);
  },

  async add(product: Omit<Product, 'id'>): Promise<number> {
    const db = await getDB();
    return db.add('products', product as Product);
  },

  async update(product: Product): Promise<void> {
    const db = await getDB();
    await db.put('products', { ...product, updatedAt: new Date() });
  },

  async delete(id: number): Promise<void> {
    const db = await getDB();
    await db.delete('products', id);
  },

  async updateStock(id: number, quantity: number, isAddition: boolean): Promise<void> {
    const db = await getDB();
    const product = await db.get('products', id);
    if (product) {
      product.currentStock = isAddition
        ? product.currentStock + quantity
        : product.currentStock - quantity;
      product.updatedAt = new Date();
      await db.put('products', product);
    }
  },

  async getLowStockProducts(): Promise<Product[]> {
    const db = await getDB();
    const products = await db.getAll('products');
    return products.filter(p => p.currentStock <= p.lowStockThreshold);
  },
};

// Stock intake operations
export const stockIntakeDB = {
  async getAll(): Promise<StockIntake[]> {
    const db = await getDB();
    return db.getAll('stockIntakes');
  },

  async getByProduct(productId: number): Promise<StockIntake[]> {
    const db = await getDB();
    return db.getAllFromIndex('stockIntakes', 'by-product', productId);
  },

  async add(intake: Omit<StockIntake, 'id'>): Promise<number> {
    const db = await getDB();
    const id = await db.add('stockIntakes', intake as StockIntake);
    
    // Update product stock
    await productDB.updateStock(intake.productId, intake.quantity, true);
    
    return id;
  },

  async getRecent(limit: number = 10): Promise<StockIntake[]> {
    const db = await getDB();
    const intakes = await db.getAll('stockIntakes');
    return intakes.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
  },
};

// Sales operations
export const salesDB = {
  async getAll(): Promise<Sale[]> {
    const db = await getDB();
    return db.getAll('sales');
  },

  async getByProduct(productId: number): Promise<Sale[]> {
    const db = await getDB();
    return db.getAllFromIndex('sales', 'by-product', productId);
  },

  async add(sale: Omit<Sale, 'id'>): Promise<number> {
    const db = await getDB();
    const product = await productDB.getById(sale.productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.currentStock < sale.quantity) {
      throw new Error(`Insufficient stock. Available: ${product.currentStock}, Requested: ${sale.quantity}`);
    }

    const id = await db.add('sales', sale as Sale);
    
    // Update product stock
    await productDB.updateStock(sale.productId, sale.quantity, false);
    
    return id;
  },

  async getByDateRange(startDate: Date, endDate: Date): Promise<Sale[]> {
    const db = await getDB();
    const sales = await db.getAll('sales');
    return sales.filter(s => s.date >= startDate && s.date <= endDate);
  },

  async getTodaySales(): Promise<Sale[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.getByDateRange(today, tomorrow);
  },

  async getDailySalesTotal(date: Date = new Date()): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    const sales = await this.getByDateRange(startOfDay, endOfDay);
    return sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  },
};

// Excess sales operations
export const excessSalesDB = {
  async getAll(): Promise<ExcessSale[]> {
    const db = await getDB();
    return db.getAll('excessSales');
  },

  async getById(id: number): Promise<ExcessSale | undefined> {
    const db = await getDB();
    return db.get('excessSales', id);
  },

  async add(excessSale: Omit<ExcessSale, 'id'>): Promise<number> {
    const db = await getDB();
    return db.add('excessSales', excessSale as ExcessSale);
  },

  async update(excessSale: ExcessSale): Promise<void> {
    const db = await getDB();
    await db.put('excessSales', excessSale);
  },

  async delete(id: number): Promise<void> {
    const db = await getDB();
    await db.delete('excessSales', id);
  },

  async getByDateRange(startDate: Date, endDate: Date): Promise<ExcessSale[]> {
    const db = await getDB();
    const excessSales = await db.getAll('excessSales');
    return excessSales.filter(s => s.date >= startDate && s.date <= endDate);
  },

  async getTodayExcessSales(): Promise<ExcessSale[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.getByDateRange(today, tomorrow);
  },

  async getDailyExcessTotal(date: Date = new Date()): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    const excessSales = await this.getByDateRange(startOfDay, endOfDay);
    return excessSales.reduce((sum, sale) => sum + sale.amount, 0);
  },
};

// Products out operations
export const productOutDB = {
  async getAll(): Promise<ProductOut[]> {
    const db = await getDB();
    return db.getAll('productsOut');
  },

  async getById(id: number): Promise<ProductOut | undefined> {
    const db = await getDB();
    return db.get('productsOut', id);
  },

  async getByProduct(productId: number): Promise<ProductOut[]> {
    const db = await getDB();
    return db.getAllFromIndex('productsOut', 'by-product', productId);
  },

  async add(productOut: Omit<ProductOut, 'id'>): Promise<number> {
    const db = await getDB();
    const product = await productDB.getById(productOut.productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.currentStock < productOut.quantity) {
      throw new Error(`Insufficient stock. Available: ${product.currentStock.toFixed(2)}, Requested: ${productOut.quantity}`);
    }

    const id = await db.add('productsOut', productOut as ProductOut);
    
    // Update product stock
    await productDB.updateStock(productOut.productId, productOut.quantity, false);
    
    return id;
  },

  async update(productOut: ProductOut): Promise<void> {
    const db = await getDB();
    await db.put('productsOut', productOut);
  },

  async delete(id: number): Promise<void> {
    const db = await getDB();
    await db.delete('productsOut', id);
  },

  async getByDateRange(startDate: Date, endDate: Date): Promise<ProductOut[]> {
    const db = await getDB();
    const productsOut = await db.getAll('productsOut');
    return productsOut.filter(p => p.date >= startDate && p.date <= endDate);
  },

  async getByDestination(destination: string): Promise<ProductOut[]> {
    const db = await getDB();
    return db.getAllFromIndex('productsOut', 'by-destination', destination);
  },

  async getTodayProductsOut(): Promise<ProductOut[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.getByDateRange(today, tomorrow);
  },
};

// Export/Import operations
export const dataUtils = {
  async exportToCSV(type: 'products' | 'sales' | 'intakes'): Promise<string> {
    let data: any[] = [];
    let headers: string[] = [];

    switch (type) {
      case 'products':
        data = await productDB.getAll();
        headers = ['ID', 'Name', 'Category', 'Quantity (Kg)', 'Selling Price', 'Current Stock', 'Low Stock Threshold'];
        break;
      case 'sales':
        data = await salesDB.getAll();
        headers = ['ID', 'Product', 'Quantity', 'Unit Price', 'Total', 'Date'];
        break;
      case 'intakes':
        data = await stockIntakeDB.getAll();
        headers = ['ID', 'Product', 'Quantity', 'Date', 'Notes'];
        break;
    }

    const csv = [
      headers.join(','),
      ...data.map(row => {
        if (type === 'products') {
          return [row.id, row.name, row.category, row.quantityKg, row.sellingPrice, row.currentStock, row.lowStockThreshold].join(',');
        } else if (type === 'sales') {
          return [row.id, row.productName, row.quantity, row.unitPrice, row.totalAmount, row.date.toISOString()].join(',');
        } else {
          return [row.id, row.productName, row.quantity, row.date.toISOString(), row.notes || ''].join(',');
        }
      })
    ].join('\n');

    return csv;
  },

  downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
