import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";

const AdminSales = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSales(); }, [range]);

  const getDateRange = () => {
    const now = new Date();
    if (range === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (range === 'week') return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
  };

  const loadSales = async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const { data } = await supabase.from('sales').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()).order('date', { ascending: false });
    setSales(data || []);
    setLoading(false);
  };

  const totalAmount = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sales Monitor</h1>
        <p className="text-muted-foreground">Total: KES {totalAmount.toLocaleString()} from {sales.length} sales</p>
      </div>

      <div className="flex gap-2">
        {(['today', 'week', 'month'] as const).map(r => (
          <Button key={r} variant={range === r ? "default" : "outline"} size="sm" onClick={() => setRange(r)} className="capitalize">{r === 'week' ? 'Last 7 days' : r === 'month' ? 'Last 30 days' : 'Today'}</Button>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card>
          <CardHeader><CardTitle>Sales Transactions</CardTitle></CardHeader>
          <CardContent>
            {sales.length === 0 ? <p className="text-muted-foreground text-sm">No sales in this period.</p> : (
              <div className="space-y-3">
                {sales.map((sale: any) => (
                  <div key={sale.id} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <div>
                      <p className="font-medium">{sale.product_name}</p>
                      <p className="text-sm text-muted-foreground">{sale.quantity} units @ KES {Number(sale.unit_price).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(sale.date), 'PPp')}</p>
                    </div>
                    <p className="font-bold text-primary">KES {Number(sale.total_amount).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminSales;
