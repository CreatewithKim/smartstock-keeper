import { useState, useEffect, useCallback, useRef } from 'react';
import { Scale, Wifi, WifiOff, Play, Square, Package, DollarSign, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { productDB, Product } from '@/services/db';

interface ScaleReading {
  plu: string;
  productName: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  error?: string;
}

interface ScaleConfig {
  port: string;
  baudRate: number;
  parity: string;
  stopBits: number;
  middlewareUrl: string;
}
const defaultConfig: ScaleConfig = {
  port: 'COM3',
  baudRate: 9600,
  parity: 'none',
  stopBits: 1,
  middlewareUrl: 'ws://localhost:8765'
};

const ScaleIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<ScaleConfig>(defaultConfig);
  const [readings, setReadings] = useState<ScaleReading[]>([]);
  const [currentReading, setCurrentReading] = useState<ScaleReading | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadProducts();
    loadConfig();
    loadReadings();
  }, []);

  const loadProducts = async () => {
    const allProducts = await productDB.getAll();
    setProducts(allProducts);
  };

  const loadConfig = () => {
    const saved = localStorage.getItem('scaleConfig');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  };

  const saveConfig = (newConfig: ScaleConfig) => {
    setConfig(newConfig);
    localStorage.setItem('scaleConfig', JSON.stringify(newConfig));
  };

  const loadReadings = () => {
    const saved = localStorage.getItem('scaleReadings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setReadings(parsed.map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) })));
    }
  };

  const saveReading = (reading: ScaleReading) => {
    const updated = [reading, ...readings].slice(0, 100); // Keep last 100
    setReadings(updated);
    localStorage.setItem('scaleReadings', JSON.stringify(updated));
  };

  const connectToMiddleware = useCallback(() => {
    try {
      wsRef.current = new WebSocket(config.middlewareUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        toast({ title: 'Connected', description: 'Connected to scale middleware' });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          processScaleData(data);
        } catch (e) {
          console.error('Failed to parse scale data:', e);
        }
      };

      wsRef.current.onerror = () => {
        toast({ title: 'Connection Error', description: 'Failed to connect to middleware', variant: 'destructive' });
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setIsRunning(false);
      };
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to initialize WebSocket', variant: 'destructive' });
    }
  }, [config.middlewareUrl]);

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsConnected(false);
    setIsRunning(false);
  };

  const processScaleData = (data: { plu: string; weight: number }) => {
    const product = products.find(p => p.id?.toString() === data.plu || p.name.toLowerCase().includes(data.plu.toLowerCase()));
    
    if (!product) {
      const errorReading: ScaleReading = {
        plu: data.plu,
        productName: 'Unknown',
        weight: data.weight,
        unitPrice: 0,
        totalPrice: 0,
        timestamp: new Date(),
        status: 'error',
        error: `Unknown PLU: ${data.plu}`
      };
      setCurrentReading(errorReading);
      saveReading(errorReading);
      return;
    }

    const totalPrice = Number((data.weight * product.sellingPrice).toFixed(2));
    
    const reading: ScaleReading = {
      plu: data.plu,
      productName: product.name,
      weight: Number(data.weight.toFixed(2)),
      unitPrice: product.sellingPrice,
      totalPrice,
      timestamp: new Date(),
      status: 'success'
    };

    setCurrentReading(reading);
    saveReading(reading);

    // Simulate sending to POS
    simulatePOSSend(reading);
  };

  const simulatePOSSend = (reading: ScaleReading) => {
    console.log(`[POS] Sending total price: KES ${reading.totalPrice.toFixed(2)}`);
    toast({
      title: 'Sent to POS',
      description: `Total: KES ${reading.totalPrice.toFixed(2)} for ${reading.productName}`
    });
  };

  const startReading = () => {
    setIsRunning(true);
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ command: 'start', config }));
    }
  };

  const stopReading = () => {
    setIsRunning(false);
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ command: 'stop' }));
    }
  };

  const clearReadings = () => {
    setReadings([]);
    setCurrentReading(null);
    localStorage.removeItem('scaleReadings');
    toast({ title: 'Cleared', description: 'All readings have been cleared' });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Scale Integration</h1>
              <p className="text-sm text-muted-foreground">ACLAS PS6X Middleware Controller</p>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Connection Controls */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {!isConnected ? (
              <Button onClick={connectToMiddleware} className="gap-2">
                <Wifi className="h-4 w-4" />
                Connect Middleware
              </Button>
            ) : (
              <>
                <Button variant="destructive" onClick={disconnect} className="gap-2">
                  <WifiOff className="h-4 w-4" />
                  Disconnect
                </Button>
                
                {!isRunning ? (
                  <Button onClick={startReading} className="gap-2 bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4" />
                    Start Reading
                  </Button>
                ) : (
                  <Button onClick={stopReading} variant="secondary" className="gap-2">
                    <Square className="h-4 w-4" />
                    Stop Reading
                  </Button>
                )}
              </>
            )}

            <Button variant="outline" onClick={clearReadings} className="ml-auto">
              Clear History
            </Button>
          </div>
        </GlassCard>

        {/* Configuration */}
        <GlassCard className="p-4">
          <h3 className="font-semibold mb-4">Serial Port Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>COM Port</Label>
              <Input
                value={config.port}
                onChange={(e) => saveConfig({ ...config, port: e.target.value })}
                placeholder="COM3"
                disabled={isConnected}
              />
            </div>
            <div className="space-y-2">
              <Label>Baud Rate</Label>
              <Select
                value={config.baudRate.toString()}
                onValueChange={(v) => saveConfig({ ...config, baudRate: parseInt(v) })}
                disabled={isConnected}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4800, 9600, 19200, 38400, 57600, 115200].map(rate => (
                    <SelectItem key={rate} value={rate.toString()}>{rate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parity</Label>
              <Select
                value={config.parity}
                onValueChange={(v) => saveConfig({ ...config, parity: v })}
                disabled={isConnected}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="even">Even</SelectItem>
                  <SelectItem value="odd">Odd</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stop Bits</Label>
              <Select
                value={config.stopBits.toString()}
                onValueChange={(v) => saveConfig({ ...config, stopBits: parseInt(v) })}
                disabled={isConnected}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Middleware URL</Label>
              <Input
                value={config.middlewareUrl}
                onChange={(e) => saveConfig({ ...config, middlewareUrl: e.target.value })}
                placeholder="ws://localhost:8765"
                disabled={isConnected}
              />
            </div>
          </div>
        </GlassCard>

        {/* Current Reading */}
        {currentReading && (
          <GlassCard className={`p-6 border-2 ${currentReading.status === 'success' ? 'border-green-500/50' : 'border-destructive/50'}`}>
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {currentReading.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                  <span className="text-lg font-semibold">Current Reading</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Product</p>
                      <p className="font-medium">{currentReading.productName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Weight</p>
                      <p className="font-medium">{currentReading.weight.toFixed(2)} kg</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Unit Price</p>
                      <p className="font-medium">KES {currentReading.unitPrice.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Price</p>
                      <p className="text-2xl font-bold text-primary">KES {currentReading.totalPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {currentReading.error && (
                  <p className="text-sm text-destructive">{currentReading.error}</p>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {/* Reading History */}
        <GlassCard className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Transaction Log
          </h3>
          
          {readings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No readings yet. Connect and start reading to see transactions.
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
                      <td className="py-2 px-3 text-right">{reading.weight.toFixed(2)} kg</td>
                      <td className="py-2 px-3 text-right">KES {reading.unitPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-medium">KES {reading.totalPrice.toFixed(2)}</td>
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
      </div>
    </Layout>
  );
};

export default ScaleIntegration;
