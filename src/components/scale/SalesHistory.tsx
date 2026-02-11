import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { salesDB, Sale } from '@/services/db';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

interface WeekGroup {
  weekLabel: string;
  weekStart: Date;
  days: DayGroup[];
  total: number;
}

interface DayGroup {
  dateLabel: string;
  date: Date;
  sales: Sale[];
  total: number;
}

export function SalesHistory() {
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    salesDB.getAll().then(sales => {
      setAllSales(sales.sort((a, b) => b.date.getTime() - a.date.getTime()));
    });
  }, []);

  const weekGroups = useMemo(() => {
    const groups = new Map<string, { weekStart: Date; weekEnd: Date; sales: Sale[] }>();

    allSales.forEach(sale => {
      const saleDate = new Date(sale.date);
      const ws = startOfWeek(saleDate, { weekStartsOn: 1 });
      const we = endOfWeek(saleDate, { weekStartsOn: 1 });
      const key = format(ws, 'yyyy-MM-dd');

      if (!groups.has(key)) {
        groups.set(key, { weekStart: ws, weekEnd: we, sales: [] });
      }
      groups.get(key)!.sales.push(sale);
    });

    const result: WeekGroup[] = [];
    const sortedKeys = [...groups.keys()].sort().reverse();

    for (const key of sortedKeys) {
      const { weekStart, weekEnd, sales } = groups.get(key)!;
      const weekLabel = `${format(weekStart, 'MMM dd')} – ${format(weekEnd, 'MMM dd, yyyy')}`;

      // Group by day
      const dayMap = new Map<string, Sale[]>();
      sales.forEach(sale => {
        const dayKey = format(new Date(sale.date), 'yyyy-MM-dd');
        if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
        dayMap.get(dayKey)!.push(sale);
      });

      const days: DayGroup[] = [...dayMap.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dayKey, daySales]) => ({
          dateLabel: format(new Date(dayKey), 'EEEE, MMM dd yyyy'),
          date: new Date(dayKey),
          sales: daySales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          total: daySales.reduce((sum, s) => sum + s.totalAmount, 0),
        }));

      result.push({
        weekLabel,
        weekStart,
        days,
        total: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      });
    }

    return result;
  }, [allSales]);

  const toggleWeek = (key: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleDay = (key: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (allSales.length === 0) {
    return (
      <GlassCard className="p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4" />
          Sales History
        </h3>
        <p className="text-center text-muted-foreground py-8">No sales history yet.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4" />
        Sales History
      </h3>

      <div className="space-y-2">
        {weekGroups.map(week => {
          const weekKey = format(week.weekStart, 'yyyy-MM-dd');
          const isWeekOpen = expandedWeeks.has(weekKey);

          return (
            <div key={weekKey} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleWeek(weekKey)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isWeekOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{week.weekLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    ({week.days.reduce((sum, d) => sum + d.sales.length, 0)} sales)
                  </span>
                </div>
                <span className="font-semibold text-primary text-sm">
                  KES {week.total.toLocaleString()}
                </span>
              </button>

              {isWeekOpen && (
                <div className="border-t border-border">
                  {week.days.map(day => {
                    const dayKey = format(day.date, 'yyyy-MM-dd');
                    const isDayOpen = expandedDays.has(dayKey);

                    return (
                      <div key={dayKey}>
                        <button
                          onClick={() => toggleDay(dayKey)}
                          className="w-full flex items-center justify-between px-6 py-2 hover:bg-muted/20 transition-colors text-left border-b border-border/50"
                        >
                          <div className="flex items-center gap-2">
                            {isDayOpen ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-sm">{day.dateLabel}</span>
                            <span className="text-xs text-muted-foreground">
                              ({day.sales.length})
                            </span>
                          </div>
                          <span className="text-sm font-medium text-primary">
                            KES {day.total.toLocaleString()}
                          </span>
                        </button>

                        {isDayOpen && (
                          <div className="bg-muted/10">
                            {day.sales.map(sale => (
                              <div
                                key={sale.id}
                                className="flex items-center justify-between px-10 py-2 text-sm border-b border-border/30"
                              >
                                <div>
                                  <span className="font-medium">{sale.productName}</span>
                                  <span className="text-muted-foreground ml-2">
                                    {sale.quantity.toFixed(3)} kg @ KES {sale.unitPrice}
                                  </span>
                                  {sale.notes && (
                                    <span className="text-xs text-muted-foreground ml-2 italic">
                                      — {sale.notes}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(sale.date), 'h:mm a')}
                                  </span>
                                  <span className="font-semibold">
                                    KES {sale.totalAmount.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}