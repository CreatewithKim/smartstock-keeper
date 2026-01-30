import { useState, useEffect, useCallback, useRef } from 'react';
import { Scale, Wifi, WifiOff, Play, Square, Package, DollarSign, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { productDB, Product } from '@/services/db';
import { PLUConfiguration, PLUMapping, loadPLUMappings, findProductByPLU } from '@/components/PLUConfiguration';

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

const RECONNECT_INTERVAL = 3000; // 3 seconds

const ScaleIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<ScaleConfig>(defaultConfig);
  const [readings, setReadings] = useState<ScaleReading[]>([]);
  const [currentReading, setCurrentReading] = useState<ScaleReading | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shouldReconnect, setShouldReconnect] = useState(false);
  const [pluMappings, setPLUMappings] = useState<PLUMapping[]>([]);
  const [pluError, setPluError] = useState<string | null>(null);
  const [lastReceivedPLU, setLastReceivedPLU] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProducts();
    loadConfig();
    loadReadings();
    setPLUMappings(loadPLUMappings());
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
      setReadings(parsed.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
        weight: r.weight ?? 0,
        unitPrice: r.unitPrice ?? 0,
        totalPrice: r.totalPrice ?? 0
      })));
    }
  };

  const saveReading = (reading: ScaleReading) => {
    const updated = [reading, ...readings].slice(0, 100); // Keep last 100
    setReadings(updated);
    localStorage.setItem('scaleReadings', JSON.stringify(updated));
  };

  const connectToMiddleware = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log('Connecting to scale middleware...');
    setShouldReconnect(true);

    try {
      wsRef.current = new WebSocket(config.middlewareUrl);
      
      wsRef.current.onopen = () => {
        console.log('✅ Scale middleware connected');
        setIsConnected(true);
        toast({ title: 'Connected', description: 'Scale middleware connected successfully' });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Scale data:', data);
          
          // Map middleware data format to our expected format
          processScaleData({
            plu: data.product_id || data.plu,
            weight: data.weight ?? 0
          });
          
          console.log('Product:', data.product_id);
          console.log('Weight:', data.weight, 'kg');
          console.log('Total:', 'KES ' + data.total_price);
        } catch (e) {
          console.error('Failed to parse scale data:', e);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Scale connection error:', error);
        setIsConnected(false);
        toast({ title: 'Connection Error', description: 'Failed to connect to middleware', variant: 'destructive' });
      };

      wsRef.current.onclose = () => {
        console.log('Scale disconnected. Reconnecting...');
        setIsConnected(false);
        setIsRunning(false);
        
        // Auto-reconnect if we should still be connected
        if (shouldReconnect) {
          toast({ title: 'Disconnected', description: 'Attempting to reconnect...', variant: 'destructive' });
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnect) {
              connectToMiddleware();
            }
          }, RECONNECT_INTERVAL);
        }
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket:', e);
      toast({ title: 'Error', description: 'Failed to initialize WebSocket', variant: 'destructive' });
      
      // Try to reconnect on error
      if (shouldReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (shouldReconnect) {
            connectToMiddleware();
          }
        }, RECONNECT_INTERVAL);
      }
    }
  }, [config.middlewareUrl, shouldReconnect]);

  const disconnect = () => {
    console.log('Disconnecting from scale middleware...');
    setShouldReconnect(false);
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsRunning(false);
    toast({ title: 'Disconnected', description: 'Scale middleware disconnected' });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setShouldReconnect(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const processScaleData = (data: { plu: string; weight: number }) => {
    setLastReceivedPLU(data.plu);
    
    // First, try to find product via PLU mapping
    const pluMapping = findProductByPLU(data.plu, pluMappings);
    
    // Fallback: try to find by product ID or name if no PLU mapping exists
    const product = pluMapping 
      ? products.find(p => p.id === pluMapping.productId)
      : products.find(p => p.id?.toString() === data.plu || p.name.toLowerCase().includes(data.plu.toLowerCase()));
    
    if (!pluMapping && !product) {
      const errorMessage = `PLU "${data.plu}" is not configured in the system. Please add this PLU mapping in the PLU Configuration section.`;
      setPluError(errorMessage);
      
      const errorReading: ScaleReading = {
        plu: data.plu,
        productName: 'Unknown',
        weight: data.weight,
        unitPrice: 0,
        totalPrice: 0,
        timestamp: new Date(),
        status: 'error',
        error: errorMessage
      };
      setCurrentReading(errorReading);
      saveReading(errorReading);
      
      toast({ 
        title: 'PLU Not Found', 
        description: `Scale sent PLU "${data.plu}" which is not mapped to any product.`,
        variant: 'destructive'
      });
      return;
    }

    // Clear any previous PLU error
    setPluError(null);

    const unitPrice = pluMapping?.unitPrice ?? product?.sellingPrice ?? 0;
    const productName = pluMapping?.productName ?? product?.name ?? 'Unknown';
    const totalPrice = Number((data.weight * unitPrice).toFixed(2));
    
    const reading: ScaleReading = {
      plu: data.plu,
      productName,
      weight: Number(data.weight.toFixed(2)),
      unitPrice,
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
    const total = reading.totalPrice ?? 0;
    console.log(`[POS] Sending total price: KES ${total.toFixed(2)}`);
    toast({
      title: 'Sent to POS',
      description: `Total: KES ${total.toFixed(2)} for ${reading.productName}`
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

        {/* PLU Configuration */}
        <PLUConfiguration
          onMappingsChange={setPLUMappings}
          lastReceivedPLU={lastReceivedPLU}
          pluError={pluError}
        />

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
                      <p className="font-medium">{(currentReading.weight ?? 0).toFixed(2)} kg</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Unit Price</p>
                      <p className="font-medium">KES {(currentReading.unitPrice ?? 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Price</p>
                      <p className="text-2xl font-bold text-primary">KES {(currentReading.totalPrice ?? 0).toFixed(2)}</p>
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
                      <td className="py-2 px-3 text-right">{(reading.weight ?? 0).toFixed(2)} kg</td>
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
      </div>
    </Layout>
  );
};

export default ScaleIntegration;
