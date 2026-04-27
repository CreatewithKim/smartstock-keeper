import { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { salesDB, excessSalesDB } from "@/services/db";
import { Smartphone, Wallet, Banknote, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface AvenueRecord {
  mpesa: number;
  pochiLaBiashara: number;
  cash: number;
  date: string;
}

const AVENUES_STORAGE_KEY = "smartstock-avenues";

export default function Avenues() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [dailySalesTotal, setDailySalesTotal] = useState(0);
  const [dailyExcessTotal, setDailyExcessTotal] = useState(0);
  
  const [mpesa, setMpesa] = useState("");
  const [pochiLaBiashara, setPochiLaBiashara] = useState("");
  const [cash, setCash] = useState("");
  
  const [savedRecords, setSavedRecords] = useState<AvenueRecord[]>([]);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Get today's sales total
      const salesTotal = await salesDB.getDailySalesTotal();
      const excessTotal = await excessSalesDB.getDailyExcessTotal();
      
      setDailySalesTotal(salesTotal);
      setDailyExcessTotal(excessTotal);
      
      // Load saved avenue records from localStorage
      const storedRecords = localStorage.getItem(AVENUES_STORAGE_KEY);
      if (storedRecords) {
        const records: AvenueRecord[] = JSON.parse(storedRecords);
        setSavedRecords(records);
        
        // Load today's record if exists
        const todayRecord = records.find(r => r.date === today);
        if (todayRecord) {
          setMpesa(todayRecord.mpesa.toFixed(2));
          setPochiLaBiashara(todayRecord.pochiLaBiashara.toFixed(2));
          setCash(todayRecord.cash.toFixed(2));
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalFromSales = dailySalesTotal + dailyExcessTotal;
  
  const mpesaAmount = parseFloat(mpesa) || 0;
  const pochiAmount = parseFloat(pochiLaBiashara) || 0;
  const cashAmount = parseFloat(cash) || 0;
  const avenuesTotal = mpesaAmount + pochiAmount + cashAmount;
  
  const difference = Math.abs(totalFromSales - avenuesTotal);
  const isBalanced = difference < 0.01; // Allow for small floating point differences

  const handleSave = () => {
    if (!isBalanced && avenuesTotal > 0) {
      toast({
        title: "Warning",
        description: `Avenue totals don't match sales. Difference: KSh ${difference.toFixed(2)}`,
        variant: "destructive",
      });
    }

    const newRecord: AvenueRecord = {
      mpesa: mpesaAmount,
      pochiLaBiashara: pochiAmount,
      cash: cashAmount,
      date: today,
    };

    // Update or add today's record
    const updatedRecords = savedRecords.filter(r => r.date !== today);
    updatedRecords.push(newRecord);
    
    // Keep only last 30 days
    updatedRecords.sort((a, b) => b.date.localeCompare(a.date));
    const trimmedRecords = updatedRecords.slice(0, 30);
    
    localStorage.setItem(AVENUES_STORAGE_KEY, JSON.stringify(trimmedRecords));
    setSavedRecords(trimmedRecords);

    toast({
      title: "Saved",
      description: "Avenue records saved successfully",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Avenues</h1>
        <p className="text-muted-foreground">
          Record daily payments from different channels
        </p>
      </div>

      {/* Today's Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">M-Pesa</p>
              <p className="text-xl font-bold">KSh {mpesaAmount.toFixed(2)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-500/20 p-2">
              <Wallet className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pochi la Biashara</p>
              <p className="text-xl font-bold">KSh {pochiAmount.toFixed(2)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-500/20 p-2">
              <Banknote className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash</p>
              <p className="text-xl font-bold">KSh {cashAmount.toFixed(2)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className={`p-4 ${isBalanced && avenuesTotal > 0 ? 'border-green-500/50' : avenuesTotal > 0 ? 'border-destructive/50' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${isBalanced && avenuesTotal > 0 ? 'bg-green-500/20' : 'bg-muted'}`}>
              {isBalanced && avenuesTotal > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className={`h-5 w-5 ${avenuesTotal > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avenue Total</p>
              <p className="text-xl font-bold">KSh {avenuesTotal.toFixed(2)}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Validation Status */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold mb-4">Today's Reconciliation</h2>
        
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Product Sales</p>
            <p className="text-2xl font-bold">KSh {dailySalesTotal.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Excess Sales</p>
            <p className="text-2xl font-bold">KSh {dailyExcessTotal.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Expected</p>
            <p className="text-2xl font-bold text-primary">KSh {totalFromSales.toFixed(2)}</p>
          </div>
        </div>

        {avenuesTotal > 0 && !isBalanced && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>
              Avenue totals (KSh {avenuesTotal.toFixed(2)}) don't match sales total (KSh {totalFromSales.toFixed(2)}). 
              Difference: <strong>KSh {difference.toFixed(2)}</strong>
            </p>
          </div>
        )}

        {avenuesTotal > 0 && isBalanced && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <p>Avenue totals match the day's sales. All balanced!</p>
          </div>
        )}
      </GlassCard>

      {/* Input Form */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold mb-4">Record Payments - {format(new Date(), "MMMM d, yyyy")}</h2>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="mpesa" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              M-Pesa (KSh)
            </Label>
            <Input
              id="mpesa"
              type="number"
              step="0.01"
              min="0"
              value={mpesa}
              onChange={(e) => setMpesa(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pochi" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Pochi la Biashara (KSh)
            </Label>
            <Input
              id="pochi"
              type="number"
              step="0.01"
              min="0"
              value={pochiLaBiashara}
              onChange={(e) => setPochiLaBiashara(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Cash (KSh)
            </Label>
            <Input
              id="cash"
              type="number"
              step="0.01"
              min="0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} size="lg">
            Save Records
          </Button>
        </div>
      </GlassCard>

      {/* Recent Records */}
      {savedRecords.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Records</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">M-Pesa</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Pochi la Biashara</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Cash</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {savedRecords.slice(0, 7).map((record) => (
                  <tr key={record.date} className="border-b border-border/50">
                    <td className="py-2 px-3 text-sm">
                      {format(new Date(record.date), "MMM d, yyyy")}
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      KSh {record.mpesa.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      KSh {record.pochiLaBiashara.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      KSh {record.cash.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-medium">
                      KSh {(record.mpesa + record.pochiLaBiashara + record.cash).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
