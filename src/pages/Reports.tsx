import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Calendar, TrendingUp, Smartphone, Wallet, Banknote, ArrowDownCircle, ArrowUpCircle, Package as PackageIcon, DatabaseBackup, Upload, Loader2, ClipboardList, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productDB, salesDB, stockIntakeDB, excessSalesDB, productOutDB, stockTakeDB, dataUtils, Product, Sale, StockIntake, ExcessSale, ProductOut, StockTake } from "@/services/db";
import { downloadBackup, downloadFile, restoreBackup } from "@/services/localBackup";
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
  const [productsOut, setProductsOut] = useState<ProductOut[]>([]);
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [avenueRecords, setAvenueRecords] = useState<AvenueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementRange, setMovementRange] = useState<"week" | "month" | "all">("month");
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stockTakeForm, setStockTakeForm] = useState({
    productName: "",
    quantity: "",
    date: format(new Date(), "yyyy-MM-dd"),
    totalValue: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, salesData, intakesData, excessData, productsOutData, stockTakesData] = await Promise.all([
        productDB.getAll(),
        salesDB.getAll(),
        stockIntakeDB.getAll(),
        excessSalesDB.getAll(),
        productOutDB.getAll(),
        stockTakeDB.getAll(),
      ]);
      setProducts(productsData);
      setSales(salesData);
      setIntakes(intakesData);
      setExcessSales(excessData);
      setProductsOut(productsOutData);
      setStockTakes(stockTakesData);



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

  // Product movement (stock in vs stock out) per product for selected range
  const productMovement = useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = null;
    if (movementRange === "week") {
      start = startOfWeek(new Date(), { weekStartsOn: 1 });
      end = endOfWeek(new Date(), { weekStartsOn: 1 });
    } else if (movementRange === "month") {
      start = startOfMonth(new Date());
      end = endOfMonth(new Date());
    }
    const inRange = (d: Date) => (!start || !end ? true : d >= start && d <= end);

    return products
      .map((p) => {
        const stockIn = intakes
          .filter((i) => i.productId === p.id && inRange(i.date))
          .reduce((s, i) => s + i.quantity, 0);
        const soldQty = sales
          .filter((s) => s.productId === p.id && inRange(s.date))
          .reduce((s, x) => s + x.quantity, 0);
        const soldRevenue = sales
          .filter((s) => s.productId === p.id && inRange(s.date))
          .reduce((s, x) => s + x.totalAmount, 0);
        const distributedQty = productsOut
          .filter((o) => o.productId === p.id && inRange(o.date))
          .reduce((s, o) => s + o.quantity, 0);
        const stockOut = soldQty + distributedQty;
        const net = stockIn - stockOut;
        return {
          product: p,
          stockIn,
          soldQty,
          soldRevenue,
          distributedQty,
          stockOut,
          net,
        };
      })
      .filter((r) => r.stockIn > 0 || r.stockOut > 0)
      .sort((a, b) => b.stockOut - a.stockOut);
  }, [products, intakes, sales, productsOut, movementRange]);


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

  const escapeCsv = (value: string | number) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportMovement = () => {
    if (productMovement.length === 0) {
      toast({ title: "Nothing to export", description: "No product movement in this period", variant: "destructive" });
      return;
    }
    const headers = ["Product", "Category", "Stock In (Kg)", "Stock Out (Kg)", "Sold (Kg)", "Sales Revenue (KSh)", "Distributed (Kg)", "Net Change (Kg)", "Current Stock (Kg)"];
    const rows = productMovement.map(({ product, stockIn, soldQty, soldRevenue, distributedQty, stockOut, net }) =>
      [
        product.name,
        product.category || "Uncategorized",
        stockIn.toFixed(2),
        stockOut.toFixed(2),
        soldQty.toFixed(2),
        soldRevenue.toFixed(2),
        distributedQty.toFixed(2),
        net.toFixed(2),
        product.currentStock.toFixed(2),
      ].map(escapeCsv).join(","),
    );
    const csv = [headers.map(escapeCsv).join(","), ...rows].join("\n");
    downloadFile(csv, `product-movement-${movementRange}-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
    toast({ title: "Exported", description: "Product movement CSV downloaded" });
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { filename, totals } = await downloadBackup();
      const summary = Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ");
      toast({ title: "Backup downloaded", description: `${filename} (${summary})` });
    } catch (error: any) {
      toast({ title: "Backup failed", description: error?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    setRestoring(true);
    try {
      const totals = await restoreBackup(file, "replace");
      const summary = Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(", ");
      await loadData();
      toast({ title: "Data restored", description: summary });
    } catch (error: any) {
      toast({ title: "Restore failed", description: error?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sortedStockTakes = useMemo(
    () => [...stockTakes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [stockTakes],
  );

  const stockTakeTotalValue = useMemo(
    () => stockTakes.reduce((sum, s) => sum + (s.totalValue || 0), 0),
    [stockTakes],
  );

  const handleAddStockTake = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseFloat(stockTakeForm.quantity);
    const totalValue = parseFloat(stockTakeForm.totalValue);
    if (!stockTakeForm.productName.trim() || isNaN(quantity) || isNaN(totalValue)) {
      toast({ title: "Missing details", description: "Enter item, quantity and total stock value", variant: "destructive" });
      return;
    }
    try {
      await stockTakeDB.add({
        productName: stockTakeForm.productName.trim(),
        productId: products.find((p) => p.name === stockTakeForm.productName.trim())?.id,
        quantity,
        totalValue,
        date: new Date(stockTakeForm.date),
        createdAt: new Date(),
      });
      setStockTakeForm({ productName: "", quantity: "", date: format(new Date(), "yyyy-MM-dd"), totalValue: "" });
      setStockTakes(await stockTakeDB.getAll());
      toast({ title: "Stock take recorded" });
    } catch (error: any) {
      toast({ title: "Failed to record", description: error?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const handleDeleteStockTake = async (id?: number) => {
    if (!id) return;
    await stockTakeDB.delete(id);
    setStockTakes(await stockTakeDB.getAll());
    toast({ title: "Record deleted" });
  };

  const handleExportStockTakes = () => {
    if (sortedStockTakes.length === 0) {
      toast({ title: "Nothing to export", description: "No stock taking records yet", variant: "destructive" });
      return;
    }
    const headers = ["Item", "Quantity", "Date Recorded", "Total Stock Value (KSh)"];
    const rows = sortedStockTakes.map((s) =>
      [s.productName, s.quantity, format(new Date(s.date), "yyyy-MM-dd"), s.totalValue.toFixed(2)]
        .map((v) => escapeCsv(v as string | number))
        .join(","),
    );
    downloadFile(
      [headers.map(escapeCsv).join(","), ...rows].join("\n"),
      `stock-taking-${format(new Date(), "yyyy-MM-dd")}.csv`,
      "text/csv",
    );
    toast({ title: "Exported", description: "Stock taking CSV downloaded" });
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

      {/* Stock Taking */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Stock Taking</h2>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportStockTakes}>
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <form onSubmit={handleAddStockTake} className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="st-item">Item</Label>
            <Input
              id="st-item"
              list="stock-take-products"
              placeholder="Item name"
              value={stockTakeForm.productName}
              onChange={(e) => setStockTakeForm({ ...stockTakeForm, productName: e.target.value })}
            />
            <datalist id="stock-take-products">
              {products.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-qty">Quantity per item</Label>
            <Input
              id="st-qty"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={stockTakeForm.quantity}
              onChange={(e) => setStockTakeForm({ ...stockTakeForm, quantity: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-date">Date Recorded</Label>
            <Input
              id="st-date"
              type="date"
              value={stockTakeForm.date}
              onChange={(e) => setStockTakeForm({ ...stockTakeForm, date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-value">Total stock value (KSh)</Label>
            <Input
              id="st-value"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={stockTakeForm.totalValue}
              onChange={(e) => setStockTakeForm({ ...stockTakeForm, totalValue: e.target.value })}
            />
          </div>
          <div className="md:col-span-4">
            <Button type="submit">Record stock take</Button>
          </div>
        </form>

        {sortedStockTakes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stock taking records yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedStockTakes.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-primary/5"
              >
                <div>
                  <p className="font-medium text-foreground">{record.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(record.date), "dd MMM yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="font-medium">{record.quantity.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total value</p>
                    <p className="font-medium">KSh {record.totalValue.toFixed(2)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteStockTake(record.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
              <span className="text-sm font-medium">Total stock value recorded</span>
              <span className="font-bold text-primary">KSh {stockTakeTotalValue.toFixed(2)}</span>
            </div>
          </div>
        )}
      </GlassCard>



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

      {/* Backup & Restore */}
      <GlassCard>
        <div className="flex items-start gap-4 mb-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <DatabaseBackup className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Backup &amp; Restore</h2>
            <p className="text-sm text-muted-foreground">
              Download a full backup of all your data, or re-upload a previously downloaded CSV backup file.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={handleBackup} variant="outline" className="gap-2" disabled={backingUp}>
            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {backingUp ? "Preparing..." : "Download Backup"}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2" disabled={restoring}>
            {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {restoring ? "Restoring..." : "Upload Backup"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="text/csv,.csv,application/json,.json"
            className="hidden"
            onChange={(e) => handleRestoreFile(e.target.files?.[0])}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Uploading a backup replaces the current data on this device with the contents of the file.
        </p>
      </GlassCard>


      {/* Product Movement */}
      <GlassCard>
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Product Movement</h2>
            <p className="text-sm text-muted-foreground">Stock in vs stock out per product</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={movementRange} onValueChange={(v) => setMovementRange(v as "week" | "month" | "all")}>
              <TabsList>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={handleExportMovement} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>


        {productMovement.length > 0 ? (
          <div className="space-y-3">
            {productMovement.map(({ product, stockIn, soldQty, soldRevenue, distributedQty, stockOut, net }) => (
              <div key={product.id} className="rounded-lg bg-primary/5 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category || "Uncategorized"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${net >= 0 ? "text-green-500" : "text-destructive"}`}>
                      Net: {net >= 0 ? "+" : ""}{net.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Current: {product.currentStock.toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-md bg-background/40 p-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowDownCircle className="h-3 w-3 text-green-500" /> Stock In
                    </div>
                    <p className="font-semibold text-foreground">+{stockIn.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-background/40 p-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowUpCircle className="h-3 w-3 text-destructive" /> Stock Out
                    </div>
                    <p className="font-semibold text-foreground">-{stockOut.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-background/40 p-2">
                    <p className="text-xs text-muted-foreground">Sold</p>
                    <p className="font-semibold text-foreground">{soldQty.toFixed(2)}</p>
                    <p className="text-xs text-primary">KSh {soldRevenue.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-background/40 p-2">
                    <p className="text-xs text-muted-foreground">Distributed</p>
                    <p className="font-semibold text-foreground">{distributedQty.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">No product movement in this period</p>
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
