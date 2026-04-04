import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package, TrendingDown } from "lucide-react";
import { format } from "date-fns";

const AdminAlerts = () => {
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [outOfStock, setOutOfStock] = useState<any[]>([]);
  const [recentLargeExpenses, setRecentLargeExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const [productsRes, expensesRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('expenses').select('*').order('amount', { ascending: false }).limit(10),
      ]);

      const products = productsRes.data || [];
      const expenses = expensesRes.data || [];

      setLowStockProducts(products.filter((p: any) => p.current_stock > 0 && p.current_stock <= p.low_stock_threshold));
      setOutOfStock(products.filter((p: any) => p.current_stock <= 0));
      setRecentLargeExpenses(expenses.filter((e: any) => Number(e.amount) >= 1000));
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading alerts...</p></div>;

  const totalAlerts = lowStockProducts.length + outOfStock.length + recentLargeExpenses.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Alerts & Notifications</h1>
        <p className="text-muted-foreground">{totalAlerts} active alerts</p>
      </div>

      {/* Out of Stock */}
      {outOfStock.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Out of Stock ({outOfStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outOfStock.map((p: any) => (
              <div key={p.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <span className="text-sm font-bold text-destructive">0 kg</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Low Stock */}
      {lowStockProducts.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <Package className="h-5 w-5" /> Low Stock Warning ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockProducts.map((p: any) => (
              <div key={p.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category} • Threshold: {Number(p.low_stock_threshold)} kg</p>
                </div>
                <span className="text-sm font-bold text-yellow-600">{Number(p.current_stock).toFixed(1)} kg</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Large Expenses */}
      {recentLargeExpenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-muted-foreground" /> Large Expenses (KES 1,000+)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLargeExpenses.map((e: any) => (
              <div key={e.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                <div>
                  <p className="font-medium">{e.description}</p>
                  <p className="text-xs text-muted-foreground">{e.category} • {format(new Date(e.date), 'PP')}</p>
                </div>
                <span className="font-bold text-destructive">KES {Number(e.amount).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {totalAlerts === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-lg">✅ No alerts. Everything looks good!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminAlerts;
