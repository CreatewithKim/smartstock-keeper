import { useEffect, useState } from "react";
import { FileDown, Calendar, TrendingUp, Smartphone, Wallet, Banknote } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { productDB, salesDB, stockIntakeDB, excessSalesDB, dataUtils, Product, Sale, StockIntake, ExcessSale } from "@/services/db";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface AvenueRecord {
  mpesa: number;
  pochiLaBiashara: number;
  cash: number;
  date: string;
}

const AVENUES_STORAGE_KEY = "smartstock-avenues";

export default function Reports() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [intakes, setIntakes] = useState<StockIntake[]>([]);
  const [excessSales, setExcessSales] = useState<ExcessSale[]>([]);
  const [avenueRecords, setAvenueRecords] = useState<AvenueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, salesData, intakesData, excessData] = await Promise.all([
        productDB.getAll(),
        salesDB.getAll(),
        stockIntakeDB.getAll(),
        excessSalesDB.getAll(),
      ]);
      setProducts(productsData);
      setSales(salesData);
      setIntakes(intakesData);
      setExcessSales(excessData);

      // Load avenue records from localStorage
      const storedRecords = localStorage.getItem(AVENUES_STORAGE_KEY);
      if (storedRecords) {
        setAvenueRecords(JSON.parse(storedRecords));
      }
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

  const getWeekExcessSales = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return excessSales.filter((e) => e.date >= weekStart && e.date <= weekEnd);
  };

  const getMonthExcessSales = () => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return excessSales.filter((e) => e.date >= monthStart && e.date <= monthEnd);
  };

  const getWeekAvenues = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return avenueRecords.filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate >= weekStart && recordDate <= weekEnd;
    });
  };

  const getMonthAvenues = () => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return avenueRecords.filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });
  };

  const weekSales = getWeekSales();
  const monthSales = getMonthSales();
  const weekExcess = getWeekExcessSales();
  const monthExcess = getMonthExcessSales();
  const weekAvenues = getWeekAvenues();
  const monthAvenues = getMonthAvenues();
  
  const weekProductTotal = weekSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const monthProductTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const weekExcessTotal = weekExcess.reduce((sum, e) => sum + e.amount, 0);
  const monthExcessTotal = monthExcess.reduce((sum, e) => sum + e.amount, 0);
  
  const weekTotal = weekProductTotal + weekExcessTotal;
  const monthTotal = monthProductTotal + monthExcessTotal;

  // Avenue totals
  const weekMpesa = weekAvenues.reduce((sum, r) => sum + r.mpesa, 0);
  const weekPochi = weekAvenues.reduce((sum, r) => sum + r.pochiLaBiashara, 0);
  const weekCash = weekAvenues.reduce((sum, r) => sum + r.cash, 0);
  
  const monthMpesa = monthAvenues.reduce((sum, r) => sum + r.mpesa, 0);
  const monthPochi = monthAvenues.reduce((sum, r) => sum + r.pochiLaBiashara, 0);
  const monthCash = monthAvenues.reduce((sum, r) => sum + r.cash, 0);

  const allTimeMpesa = avenueRecords.reduce((sum, r) => sum + r.mpesa, 0);
  const allTimePochi = avenueRecords.reduce((sum, r) => sum + r.pochiLaBiashara, 0);
  const allTimeCash = avenueRecords.reduce((sum, r) => sum + r.cash, 0);
  const allTimeTotal = allTimeMpesa + allTimePochi + allTimeCash;

  const totalExcessSales = excessSales.reduce((sum, e) => sum + e.amount, 0);
  const productStockValue = products.reduce((sum, p) => sum + p.currentStock * p.sellingPrice, 0);
  const totalStockValue = productStockValue - totalExcessSales;

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
            <p className="text-xs text-muted-foreground">
              {weekSales.length} product sales + {weekExcess.length} excess
            </p>
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
            <p className="text-xs text-muted-foreground">
              {monthSales.length} product sales + {monthExcess.length} excess
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Net Stock Value</p>
            <p className="text-2xl font-bold text-foreground">
              KSh {totalStockValue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Product value: KSh {productStockValue.toFixed(2)}
            </p>
            <p className="text-xs text-destructive">
              Excess deducted: KSh {totalExcessSales.toFixed(2)}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Payment Avenues Breakdown */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-4">Payment Avenues Breakdown</h2>
        
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {/* This Week */}
          <div className="space-y-3 p-4 rounded-lg bg-primary/5">
            <h3 className="text-sm font-medium text-muted-foreground">This Week</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span className="text-sm">M-Pesa</span>
                </div>
                <span className="font-medium">KSh {weekMpesa.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Pochi la Biashara</span>
                </div>
                <span className="font-medium">KSh {weekPochi.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Cash</span>
                </div>
                <span className="font-medium">KSh {weekCash.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-bold text-primary">KSh {(weekMpesa + weekPochi + weekCash).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* This Month */}
          <div className="space-y-3 p-4 rounded-lg bg-primary/5">
            <h3 className="text-sm font-medium text-muted-foreground">This Month</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span className="text-sm">M-Pesa</span>
                </div>
                <span className="font-medium">KSh {monthMpesa.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Pochi la Biashara</span>
                </div>
                <span className="font-medium">KSh {monthPochi.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Cash</span>
                </div>
                <span className="font-medium">KSh {monthCash.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-bold text-primary">KSh {(monthMpesa + monthPochi + monthCash).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* All Time */}
          <div className="space-y-3 p-4 rounded-lg bg-primary/5">
            <h3 className="text-sm font-medium text-muted-foreground">All Time</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span className="text-sm">M-Pesa</span>
                </div>
                <span className="font-medium">KSh {allTimeMpesa.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Pochi la Biashara</span>
                </div>
                <span className="font-medium">KSh {allTimePochi.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Cash</span>
                </div>
                <span className="font-medium">KSh {allTimeCash.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-bold text-primary">KSh {allTimeTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {avenueRecords.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No avenue records yet. Go to Avenues to record payments.</p>
        )}
      </GlassCard>

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
                    {product.currentStock.toFixed(2)} units
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Value: KSh {(product.currentStock * product.sellingPrice).toFixed(2)}
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
