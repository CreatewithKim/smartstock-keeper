import { useEffect, useState, useMemo } from "react";
import { productDB, salesDB, stockIntakeDB, productOutDB, excessSalesDB, Product, Sale, StockIntake, ProductOut, ExcessSale } from "@/services/db";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, Package, ShoppingCart, Truck, DollarSign, BarChart3, ArrowUpDown } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfWeek, eachDayOfInterval, isSameDay } from "date-fns";

export default function Analytics() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [intakes, setIntakes] = useState<StockIntake[]>([]);
  const [productsOut, setProductsOut] = useState<ProductOut[]>([]);
  const [excessSales, setExcessSales] = useState<ExcessSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [p, s, i, o, e] = await Promise.all([
        productDB.getAll(),
        salesDB.getAll(),
        stockIntakeDB.getAll(),
        productOutDB.getAll(),
        excessSalesDB.getAll(),
      ]);
      setProducts(p);
      setSales(s);
      setIntakes(i);
      setProductsOut(o);
      setExcessSales(e);
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Key Metrics ──
  const totalRevenue = useMemo(() => sales.reduce((s, x) => s + x.totalAmount, 0), [sales]);
  const totalIntakeQty = useMemo(() => intakes.reduce((s, x) => s + x.quantity, 0), [intakes]);
  const totalSoldQty = useMemo(() => sales.reduce((s, x) => s + x.quantity, 0), [sales]);
  const totalOutQty = useMemo(() => productsOut.reduce((s, x) => s + x.quantity, 0), [productsOut]);
  const totalExcess = useMemo(() => excessSales.reduce((s, x) => s + x.amount, 0), [excessSales]);
  const stockValue = useMemo(() => products.reduce((s, p) => s + p.currentStock * p.sellingPrice, 0) - totalExcess, [products, totalExcess]);

  // ── Daily Sales Trend (last 14 days) ──
  const dailySalesData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
    return days.map(day => {
      const daySales = sales.filter(s => isSameDay(new Date(s.date), day));
      const dayIntakes = intakes.filter(i => isSameDay(new Date(i.date), day));
      const dayOut = productsOut.filter(o => isSameDay(new Date(o.date), day));
      return {
        date: format(day, "MMM dd"),
        sales: daySales.reduce((sum, s) => sum + s.totalAmount, 0),
        intakeQty: dayIntakes.reduce((sum, i) => sum + i.quantity, 0),
        soldQty: daySales.reduce((sum, s) => sum + s.quantity, 0),
        outQty: dayOut.reduce((sum, o) => sum + o.quantity, 0),
      };
    });
  }, [sales, intakes, productsOut]);

  // ── Top Selling Products ──
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    sales.forEach(s => {
      const existing = map.get(s.productName) || { name: s.productName, qty: 0, revenue: 0 };
      existing.qty += s.quantity;
      existing.revenue += s.totalAmount;
      map.set(s.productName, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [sales]);

  // ── Stock Distribution by Category ──
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      map.set(p.category, (map.get(p.category) || 0) + p.currentStock * p.sellingPrice);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [products]);

  // ── Stock Movement (In vs Out) ──
  const stockMovementData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
    return days.map(day => {
      const dayIn = intakes.filter(i => isSameDay(new Date(i.date), day)).reduce((s, i) => s + i.quantity, 0);
      const daySold = sales.filter(s => isSameDay(new Date(s.date), day)).reduce((s, x) => s + x.quantity, 0);
      const dayOut = productsOut.filter(o => isSameDay(new Date(o.date), day)).reduce((s, o) => s + o.quantity, 0);
      return {
        date: format(day, "MMM dd"),
        stockIn: dayIn,
        stockOut: daySold + dayOut,
      };
    });
  }, [intakes, sales, productsOut]);

  // ── Destination breakdown ──
  const destinationData = useMemo(() => {
    const map = new Map<string, number>();
    productsOut.forEach(o => {
      map.set(o.destination, (map.get(o.destination) || 0) + o.quantity);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [productsOut]);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(142 71% 45%)",
    "hsl(38 92% 50%)",
    "hsl(280 65% 60%)",
    "hsl(200 70% 50%)",
    "hsl(350 65% 55%)",
    "hsl(170 60% 45%)",
  ];

  const chartConfig = {
    sales: { label: "Revenue (KSh)", color: "hsl(var(--primary))" },
    soldQty: { label: "Sold (Kg)", color: "hsl(var(--primary))" },
    intakeQty: { label: "Intake (Kg)", color: "hsl(142 71% 45%)" },
    outQty: { label: "Out (Kg)", color: "hsl(38 92% 50%)" },
    stockIn: { label: "Stock In", color: "hsl(142 71% 45%)" },
    stockOut: { label: "Stock Out", color: "hsl(var(--destructive))" },
    revenue: { label: "Revenue", color: "hsl(var(--primary))" },
    qty: { label: "Quantity", color: "hsl(var(--primary))" },
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">Track how your stock moves and key business metrics.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Revenue" value={`KSh ${totalRevenue.toLocaleString()}`} icon={DollarSign} />
        <StatCard title="Stock Value" value={`KSh ${stockValue.toLocaleString()}`} icon={Package} />
        <StatCard title="Units Sold" value={`${totalSoldQty.toFixed(1)} Kg`} icon={ShoppingCart} />
        <StatCard title="Stock Intake" value={`${totalIntakeQty.toFixed(1)} Kg`} icon={TrendingUp} />
        <StatCard title="Products Out" value={`${totalOutQty.toFixed(1)} Kg`} icon={Truck} />
        <StatCard title="Excess Sales" value={`KSh ${totalExcess.toLocaleString()}`} icon={TrendingDown} />
      </div>

      {/* Charts in Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
          <TabsTrigger value="movement">Stock Movement</TabsTrigger>
          <TabsTrigger value="top-products">Top Products</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="destinations">Destinations</TabsTrigger>
        </TabsList>

        {/* Revenue Trend */}
        <TabsContent value="revenue">
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Daily Revenue — Last 14 Days</h3>
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <AreaChart data={dailySalesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} name="Revenue (KSh)" />
              </AreaChart>
            </ChartContainer>
          </GlassCard>
        </TabsContent>

        {/* Stock Movement */}
        <TabsContent value="movement">
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Stock In vs Out — Last 14 Days</h3>
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <BarChart data={stockMovementData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="stockIn" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} name="Stock In" />
                <Bar dataKey="stockOut" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Stock Out" />
              </BarChart>
            </ChartContainer>
          </GlassCard>
        </TabsContent>

        {/* Top Products */}
        <TabsContent value="top-products">
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Top Selling Products by Revenue</h3>
            {topProducts.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} className="fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Revenue (KSh)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No sales data yet</p>
            )}
          </GlassCard>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories">
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Stock Value by Category</h3>
            {categoryData.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ChartContainer config={chartConfig} className="h-[300px] w-full max-w-[300px]">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={50}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="space-y-2 flex-1">
                  {categoryData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center justify-between gap-4 rounded-lg bg-muted/30 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-medium">{cat.name}</span>
                      </div>
                      <span className="text-sm font-semibold">KSh {cat.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">No product data yet</p>
            )}
          </GlassCard>
        </TabsContent>

        {/* Destinations */}
        <TabsContent value="destinations">
          <GlassCard>
            <h3 className="text-lg font-semibold mb-4">Products Out by Destination</h3>
            {destinationData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <BarChart data={destinationData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} name="Quantity (Kg)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No products out data yet</p>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>

      {/* Stock Health Summary */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpDown className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Stock Turnover Summary</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Avg. Daily Sales</p>
            <p className="text-2xl font-bold text-foreground">
              KSh {dailySalesData.length > 0 ? Math.round(dailySalesData.reduce((s, d) => s + d.sales, 0) / dailySalesData.length).toLocaleString() : 0}
            </p>
          </div>
          <div className="rounded-xl bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Avg. Daily Stock In</p>
            <p className="text-2xl font-bold text-foreground">
              {dailySalesData.length > 0 ? (dailySalesData.reduce((s, d) => s + d.intakeQty, 0) / dailySalesData.length).toFixed(1) : 0} Kg
            </p>
          </div>
          <div className="rounded-xl bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Products Tracked</p>
            <p className="text-2xl font-bold text-foreground">{products.length}</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
