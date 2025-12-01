import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Product {
  id?: number;
  name: string;
  category: string;
  costPrice: number;
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
}

let dbInstance: IDBPDatabase<SmartStockDB> | null = null;

async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SmartStockDB>('smartstock-db', 1, {
    upgrade(db) {
      // Products store
      const productStore = db.createObjectStore('products', {
        keyPath: 'id',
        autoIncrement: true,
      });
      productStore.createIndex('by-category', 'category');

      // Stock intakes store
      const intakeStore = db.createObjectStore('stockIntakes', {
        keyPath: 'id',
        autoIncrement: true,
      });
      intakeStore.createIndex('by-product', 'productId');
      intakeStore.createIndex('by-date', 'date');

      // Sales store
      const salesStore = db.createObjectStore('sales', {
        keyPath: 'id',
        autoIncrement: true,
      });
      salesStore.createIndex('by-product', 'productId');
      salesStore.createIndex('by-date', 'date');
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

// Export/Import operations
export const dataUtils = {
  async exportToCSV(type: 'products' | 'sales' | 'intakes'): Promise<string> {
    let data: any[] = [];
    let headers: string[] = [];

    switch (type) {
      case 'products':
        data = await productDB.getAll();
        headers = ['ID', 'Name', 'Category', 'Cost Price', 'Selling Price', 'Current Stock', 'Low Stock Threshold'];
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
          return [row.id, row.name, row.category, row.costPrice, row.sellingPrice, row.currentStock, row.lowStockThreshold].join(',');
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
