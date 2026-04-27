import { Clock } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface ScaleReading {
  plu: string;
  productName: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  error?: string;
}

interface TransactionLogProps {
  readings: ScaleReading[];
  onClear: () => void;
}

export function TransactionLog({ readings, onClear }: TransactionLogProps) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Transaction Log
        </h3>
        {readings.length > 0 && (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear History
          </Button>
        )}
      </div>
      
      {readings.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No transactions yet. Scale readings will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3">Time</th>
                <th className="text-left py-2 px-3">PLU</th>
                <th className="text-left py-2 px-3">Product</th>
                <th className="text-right py-2 px-3">Weight</th>
                <th className="text-right py-2 px-3">Unit Price</th>
                <th className="text-right py-2 px-3">Total</th>
                <th className="text-center py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading, index) => (
                <tr key={index} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-3 text-muted-foreground">
                    {reading.timestamp.toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3">{reading.plu}</td>
                  <td className="py-2 px-3">{reading.productName}</td>
                  <td className="py-2 px-3 text-right">{(reading.weight ?? 0).toFixed(3)} kg</td>
                  <td className="py-2 px-3 text-right">KES {(reading.unitPrice ?? 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-medium">KES {(reading.totalPrice ?? 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant={reading.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {reading.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
