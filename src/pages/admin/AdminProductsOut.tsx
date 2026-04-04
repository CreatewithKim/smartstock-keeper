import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";

const AdminProductsOut = () => {
  const [items, setItems] = useState<any[]>([]);
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [range]);

  const getDateRange = () => {
    const now = new Date();
    if (range === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (range === 'week') return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
  };

  const loadData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const { data } = await supabase.from('products_out').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()).order('date', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Products Out Monitor</h1>
        <p className="text-muted-foreground">{items.length} records</p>
      </div>

      <div className="flex gap-2">
        {(['today', 'week', 'month'] as const).map(r => (
          <Button key={r} variant={range === r ? "default" : "outline"} size="sm" onClick={() => setRange(r)} className="capitalize">{r === 'week' ? 'Last 7 days' : r === 'month' ? 'Last 30 days' : 'Today'}</Button>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card>
          <CardHeader><CardTitle>Products Out Records</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? <p className="text-muted-foreground text-sm">No records in this period.</p> : (
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">{item.quantity} kg → {item.destination}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(item.date), 'PPp')}</p>
                    </div>
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

export default AdminProductsOut;
