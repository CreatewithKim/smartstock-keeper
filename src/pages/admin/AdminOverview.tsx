import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, AlertTriangle, TrendingUp, Receipt, Truck } from "lucide-react";
import { format } from "date-fns";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    todaySales: 0,
    todaySalesAmount: 0,
    todayExpenses: 0,
    todayProductsOut: 0,
    lastSynced: null as string | null,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [productsRes, salesRes, expensesRes, productsOutRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('sales').select('*').gte('date', startOfDay).lt('date', endOfDay).order('date', { ascending: false }),
        supabase.from('expenses').select('amount').gte('date', startOfDay).lt('date', endOfDay),
        supabase.from('products_out').select('*').gte('date', startOfDay).lt('date', endOfDay),
      ]);

      const products = productsRes.data || [];
      const sales = salesRes.data || [];
      const expenses = expensesRes.data || [];
      const productsOut = productsOutRes.data || [];

      const lowStock = products.filter((p: any) => p.current_stock <= p.low_stock_threshold);

      setStats({
        totalProducts: products.length,
        lowStockCount: lowStock.length,
        todaySales: sales.length,
        todaySalesAmount: sales.reduce((sum: number, s: any) => sum + (Number(s.total_amount) || 0), 0),
        todayExpenses: expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0),
        todayProductsOut: productsOut.length,
        lastSynced: products.length > 0 ? products.reduce((latest: string, p: any) => p.synced_at > latest ? p.synced_at : latest, products[0].synced_at) : null,
      });

      setRecentSales(sales.slice(0, 5));
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading dashboard...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Overview</h1>
        <p className="text-muted-foreground">
          Remote inventory monitoring dashboard
          {stats.lastSynced && <span className="ml-2 text-xs">• Last synced: {format(new Date(stats.lastSynced), 'PPp')}</span>}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3"><Package className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold">{stats.totalProducts}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.lowStockCount > 0 ? "border-destructive/50" : ""}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`rounded-full p-3 ${stats.lowStockCount > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
              <AlertTriangle className={`h-6 w-6 ${stats.lowStockCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
              <p className="text-2xl font-bold">{stats.lowStockCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-accent/10 p-3"><ShoppingCart className="h-6 w-6 text-accent" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Sales</p>
              <p className="text-2xl font-bold">KES {stats.todaySalesAmount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stats.todaySales} transactions</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-destructive/10 p-3"><Receipt className="h-6 w-6 text-destructive" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Expenses</p>
              <p className="text-2xl font-bold">KES {stats.todayExpenses.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-3"><TrendingUp className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Profit</p>
              <p className="text-2xl font-bold">KES {(stats.todaySalesAmount - stats.todayExpenses).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-muted p-3"><Truck className="h-6 w-6 text-muted-foreground" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Products Out Today</p>
              <p className="text-2xl font-bold">{stats.todayProductsOut}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Recent Sales Today</CardTitle></CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales recorded today.</p>
            ) : (
              <div className="space-y-3">
                {recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{sale.product_name}</p>
                      <p className="text-xs text-muted-foreground">{sale.quantity} units @ KES {Number(sale.unit_price).toLocaleString()}</p>
                    </div>
                    <p className="font-semibold text-sm">KES {Number(sale.total_amount).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className={lowStockProducts.length > 0 ? "border-destructive/30" : ""}>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2">
            {lowStockProducts.length > 0 && <AlertTriangle className="h-5 w-5 text-destructive" />}
            Low Stock Alerts
          </CardTitle></CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">All products are well stocked.</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">Category: {product.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-destructive">{Number(product.current_stock).toFixed(1)} kg</p>
                      <p className="text-xs text-muted-foreground">Threshold: {Number(product.low_stock_threshold)} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
