import { useEffect, useState } from "react";
import { Package, TrendingDown, DollarSign, AlertTriangle, ShoppingCart, FileText } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { GlassCard } from "@/components/GlassCard";
import { productDB, salesDB, excessSalesDB, Product, Sale, ExcessSale } from "@/services/db";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [totalExcessSales, setTotalExcessSales] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [allProducts, lowStock, sales, total, allExcessSales] = await Promise.all([
        productDB.getAll(),
        productDB.getLowStockProducts(),
        salesDB.getTodaySales(),
        salesDB.getDailySalesTotal(),
        excessSalesDB.getAll(),
      ]);

      const excessTotal = allExcessSales.reduce((sum, e) => sum + e.amount, 0);

      setProducts(allProducts);
      setLowStockProducts(lowStock);
      setTodaySales(sales);
      setTodayTotal(total);
      setTotalExcessSales(excessTotal);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const productStockValue = products.reduce(
    (sum, p) => sum + p.currentStock * p.sellingPrice,
    0
  );
  const totalStockValue = productStockValue - totalExcessSales;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's your inventory overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={products.length}
          icon={Package}
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockProducts.length}
          icon={AlertTriangle}
          className={lowStockProducts.length > 0 ? "border-destructive/50" : ""}
        />
        <StatCard
          title="Today's Sales"
          value={`KSh ${todayTotal.toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          title="Stock Value"
          value={`KSh ${totalStockValue.toLocaleString()}`}
          icon={TrendingDown}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <GlassCard className="border-destructive/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="text-xl font-semibold text-foreground">Low Stock Alert</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/products")}
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {lowStockProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-lg bg-destructive/5 p-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-destructive">
                      {product.currentStock} left
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Threshold: {product.lowStockThreshold}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Recent Sales */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Today's Sales</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sales")}
            >
              Record Sale
            </Button>
          </div>
          {todaySales.length > 0 ? (
            <div className="space-y-3">
              {todaySales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between rounded-lg bg-primary/5 p-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{sale.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(sale.date, "h:mm a")} • Qty: {sale.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-primary">
                    KSh {sale.totalAmount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No sales recorded today</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Quick Actions */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Button
            className="h-auto flex-col gap-2 py-6"
            onClick={() => navigate("/products")}
          >
            <Package className="h-6 w-6" />
            <span>Add Product</span>
          </Button>
          <Button
            className="h-auto flex-col gap-2 py-6"
            onClick={() => navigate("/sales")}
          >
            <ShoppingCart className="h-6 w-6" />
            <span>Record Sale</span>
          </Button>
          <Button
            className="h-auto flex-col gap-2 py-6"
            onClick={() => navigate("/reports")}
          >
            <FileText className="h-6 w-6" />
            <span>View Reports</span>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
