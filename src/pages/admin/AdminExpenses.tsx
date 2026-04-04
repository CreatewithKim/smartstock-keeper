import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AdminExpenses = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadExpenses(); }, [range]);

  const getDateRange = () => {
    const now = new Date();
    if (range === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (range === 'week') return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
  };

  const loadExpenses = async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const { data } = await supabase.from('expenses').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()).order('date', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Expenses Monitor</h1>
        <p className="text-muted-foreground">Total: KES {totalAmount.toLocaleString()} from {expenses.length} expenses</p>
      </div>

      <div className="flex gap-2">
        {(['today', 'week', 'month'] as const).map(r => (
          <Button key={r} variant={range === r ? "default" : "outline"} size="sm" onClick={() => setRange(r)} className="capitalize">{r === 'week' ? 'Last 7 days' : r === 'month' ? 'Last 30 days' : 'Today'}</Button>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card>
          <CardHeader><CardTitle>Expense Records</CardTitle></CardHeader>
          <CardContent>
            {expenses.length === 0 ? <p className="text-muted-foreground text-sm">No expenses in this period.</p> : (
              <div className="space-y-3">
                {expenses.map((expense: any) => (
                  <div key={expense.id} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(expense.date), 'PPp')}</p>
                      {expense.notes && <p className="text-xs text-muted-foreground">{expense.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-destructive">KES {Number(expense.amount).toLocaleString()}</p>
                      <Badge variant="outline" className="text-xs">{expense.category}</Badge>
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

export default AdminExpenses;
