import { useEffect, useState } from "react";
import { FileDown, Calendar, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { productDB, salesDB, stockIntakeDB, dataUtils, Product, Sale, StockIntake } from "@/services/db";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [intakes, setIntakes] = useState<StockIntake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, salesData, intakesData] = await Promise.all([
        productDB.getAll(),
        salesDB.getAll(),
        stockIntakeDB.getAll(),
      ]);
      setProducts(productsData);
      setSales(salesData);
      setIntakes(intakesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWeekSales = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return sales.filter((s) => s.date >= weekStart && s.date <= weekEnd);
  };

  const getMonthSales = () => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return sales.filter((s) => s.date >= monthStart && s.date <= monthEnd);
  };

  const weekSales = getWeekSales();
  const monthSales = getMonthSales();
  const weekTotal = weekSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const monthTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);

  const lowStockProducts = products.filter((p) => p.currentStock <= p.lowStockThreshold);

  const handleExport = async (type: "products" | "sales" | "intakes") => {
    try {
      const csv = await dataUtils.exportToCSV(type);
      const filename = `${type}-${format(new Date(), "yyyy-MM-dd")}.csv`;
      dataUtils.downloadCSV(csv, filename);
      toast({
        title: "Success",
        description: `${type} exported successfully`,
      });
    } catch (error) {
      console.error("Error exporting:", error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Reports</h1>
        <p className="text-muted-foreground">View insights and export your data</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <GlassCard>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">This Week</p>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              KSh {weekTotal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{weekSales.length} transactions</p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">This Month</p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              KSh {monthTotal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{monthSales.length} transactions</p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Products</p>
            <p className="text-2xl font-bold text-foreground">{products.length}</p>
            <p className="text-xs text-destructive">{lowStockProducts.length} low stock</p>
          </div>
        </GlassCard>
      </div>

      {/* Current Stock Levels */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Current Stock Levels</h2>
          <Button onClick={() => handleExport("products")} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" />
            Export
          </Button>
        </div>
        <div className="space-y-3">
          {products.length > 0 ? (
            products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg bg-primary/5 p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.category}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      product.currentStock <= product.lowStockThreshold
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {product.currentStock} units
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Value: KSh {(product.currentStock * product.costPrice).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">No products available</p>
          )}
        </div>
      </GlassCard>

      {/* Sales History Export */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Sales History</h2>
          <Button onClick={() => handleExport("sales")} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" />
            Export Sales
          </Button>
        </div>
        <div className="space-y-3">
          {sales.length > 0 ? (
            sales.slice(0, 10).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg bg-primary/5 p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{sale.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(sale.date, "MMM dd, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">
                    KSh {sale.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Qty: {sale.quantity}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">No sales recorded yet</p>
          )}
        </div>
      </GlassCard>

      {/* Stock Intake History */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Stock Intake History</h2>
          <Button onClick={() => handleExport("intakes")} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" />
            Export Intakes
          </Button>
        </div>
        <div className="space-y-3">
          {intakes.length > 0 ? (
            intakes.slice(0, 10).map((intake) => (
              <div
                key={intake.id}
                className="flex items-center justify-between rounded-lg bg-primary/5 p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{intake.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(intake.date, "MMM dd, yyyy")}
                  </p>
                  {intake.notes && (
                    <p className="text-xs text-muted-foreground italic mt-1">{intake.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">+{intake.quantity} units</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">No stock intake recorded yet</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
