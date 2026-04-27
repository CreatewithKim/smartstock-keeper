import { useState, useEffect, useCallback } from 'react';
import { Scale, Wifi, WifiOff, Package, AlertTriangle, CheckCircle, Usb } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { productDB, Product, salesDB } from '@/services/db';
import { useScaleConnection } from '@/hooks/useScaleConnection';
import { ScaleStatusIndicator } from '@/components/scale/ScaleStatusIndicator';
import { LiveWeightDisplay } from '@/components/scale/LiveWeightDisplay';
import { TransactionLog, ScaleReading } from '@/components/scale/TransactionLog';
import { SalesHistory } from '@/components/scale/SalesHistory';

const ScaleIntegration = () => {
  const {
    scaleState,
    isConnected,
    isStable,
    currentWeight,
    stableWeight,
    config,
    lastError,
    connect,
    disconnect,
    resetForNextSale
  } = useScaleConnection();

  const [products, setProducts] = useState<Product[]>([]);
  const [readings, setReadings] = useState<ScaleReading[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [manualWeight, setManualWeight] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadProducts();
    loadReadings();
  }, []);

  // Auto-resolve product when stable weight received with PLU
  useEffect(() => {
    if (stableWeight?.productId) {
      const product = products.find(
        p => p.id?.toString() === stableWeight.productId || 
             p.name.toLowerCase().includes(stableWeight.productId!.toLowerCase())
      );
      if (product) setSelectedProduct(product);
    }
  }, [stableWeight, products]);

  const loadProducts = async () => {
    const allProducts = await productDB.getAll();
    setProducts(allProducts);
  };

  const loadReadings = () => {
    const saved = localStorage.getItem('scaleReadings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setReadings(parsed.map((r: ScaleReading) => ({
        ...r,
        timestamp: new Date(r.timestamp),
        weight: r.weight ?? 0,
        unitPrice: r.unitPrice ?? 0,
        totalPrice: r.totalPrice ?? 0
      })));
    }
  };

  const saveReading = (reading: ScaleReading) => {
    const updated = [reading, ...readings].slice(0, 100);
    setReadings(updated);
    localStorage.setItem('scaleReadings', JSON.stringify(updated));
  };

  const handleConfirmSale = useCallback(async () => {
    if (!stableWeight || !selectedProduct) return;

    setIsProcessing(true);
    
    try {
      const weight = stableWeight.weight;
      const totalPrice = Number((weight * selectedProduct.sellingPrice).toFixed(2));

      await salesDB.add({
        productId: selectedProduct.id!,
        productName: selectedProduct.name,
        quantity: weight,
        unitPrice: selectedProduct.sellingPrice,
        totalAmount: totalPrice,
        date: new Date(),
        notes: `Scale sale - Weight: ${weight.toFixed(3)} kg`
      });

      const reading: ScaleReading = {
        plu: stableWeight.productId || selectedProduct.id?.toString() || '',
        productName: selectedProduct.name,
        weight,
        unitPrice: selectedProduct.sellingPrice,
        totalPrice,
        timestamp: new Date(),
        status: 'success'
      };
      saveReading(reading);

      toast({
        title: 'Sale Completed',
        description: `KES ${totalPrice.toFixed(2)} - ${selectedProduct.name}`
      });

      resetForNextSale();
      setSelectedProduct(null);
    } catch (error) {
      console.error('Sale error:', error);
      toast({
        title: 'Sale Failed',
        description: error instanceof Error ? error.message : 'Failed to process sale',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [stableWeight, selectedProduct, resetForNextSale, readings]);

  const handleManualSale = useCallback(async () => {
    if (!selectedProduct || !manualWeight) return;

    const weight = parseFloat(manualWeight);
    if (isNaN(weight) || weight <= 0) {
      toast({ title: 'Invalid Weight', description: 'Please enter a valid weight', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    
    try {
      const totalPrice = Number((weight * selectedProduct.sellingPrice).toFixed(2));

      await salesDB.add({
        productId: selectedProduct.id!,
        productName: selectedProduct.name,
        quantity: weight,
        unitPrice: selectedProduct.sellingPrice,
        totalAmount: totalPrice,
        date: new Date(),
        notes: `Manual entry - Weight: ${weight.toFixed(3)} kg`
      });

      const reading: ScaleReading = {
        plu: selectedProduct.id?.toString() || '',
        productName: selectedProduct.name,
        weight,
        unitPrice: selectedProduct.sellingPrice,
        totalPrice,
        timestamp: new Date(),
        status: 'success'
      };
      saveReading(reading);

      toast({
        title: 'Sale Completed',
        description: `KES ${totalPrice.toFixed(2)} - ${selectedProduct.name}`
      });

      setManualWeight('');
      setSelectedProduct(null);
    } catch (error) {
      console.error('Manual sale error:', error);
      toast({
        title: 'Sale Failed',
        description: error instanceof Error ? error.message : 'Failed to process sale',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedProduct, manualWeight, readings]);

  const clearReadings = () => {
    setReadings([]);
    localStorage.removeItem('scaleReadings');
    toast({ title: 'Cleared', description: 'All readings have been cleared' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Scale Integration</h1>
            <p className="text-sm text-muted-foreground">ACLAS PS6X Serial Connection</p>
          </div>
        </div>
        <ScaleStatusIndicator scaleState={scaleState} />
      </div>

      {/* Connection Controls */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {!isConnected ? (
            <Button onClick={connect} className="gap-2">
              <Usb className="h-4 w-4" />
              Connect Scale
            </Button>
          ) : (
            <Button variant="destructive" onClick={disconnect} className="gap-2">
              <WifiOff className="h-4 w-4" />
              Disconnect
            </Button>
          )}
          
          <p className="text-sm text-muted-foreground">
            Serial: <code className="bg-muted px-2 py-1 rounded">{config.baudRate} baud, parity: {config.parity}, stop: {config.stopBits}</code>
          </p>
        </div>
      </GlassCard>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Live Weight + Complete Sale */}
        <div className="space-y-6">
          <LiveWeightDisplay
            scaleState={scaleState}
            currentWeight={currentWeight}
            stableWeight={stableWeight}
            lastError={lastError}
            onCompleteSale={handleConfirmSale}
            completeSaleDisabled={!selectedProduct || isProcessing}
            isProcessing={isProcessing}
          />
        </div>

        {/* Right Column - Product Selection / Manual Entry */}
        <div className="space-y-6">
          <GlassCard className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" />
              {isConnected ? 'Product Selection' : 'Manual Entry'}
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Product</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const product = products.find(p => p.id === parseInt(e.target.value));
                    setSelectedProduct(product || null);
                  }}
                >
                  <option value="">-- Select Product --</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - KES {product.sellingPrice}/kg
                    </option>
                  ))}
                </select>
              </div>

              {/* Show price summary when product selected and weight available */}
              {selectedProduct && isStable && stableWeight && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Unit Price:</span>
                    <span>KES {selectedProduct.sellingPrice.toFixed(2)}/kg</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Weight:</span>
                    <span>{stableWeight.weight.toFixed(3)} kg</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span className="text-primary">
                      KES {(stableWeight.weight * selectedProduct.sellingPrice).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {!isConnected && (
                <>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={manualWeight}
                      onChange={(e) => setManualWeight(e.target.value)}
                      placeholder="Enter weight in kg"
                    />
                  </div>

                  {selectedProduct && manualWeight && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Unit Price:</span>
                        <span>KES {selectedProduct.sellingPrice.toFixed(2)}/kg</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total:</span>
                        <span className="text-primary">
                          KES {(parseFloat(manualWeight || '0') * selectedProduct.sellingPrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleManualSale}
                    disabled={!selectedProduct || !manualWeight || isProcessing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isProcessing ? 'Processing...' : 'Complete Manual Sale'}
                  </Button>
                </>
              )}

              {isConnected && !isStable && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Place item on scale. Weight will lock automatically when stable.
                </p>
              )}
            </div>
          </GlassCard>

          {/* Connection Status Info */}
          {!isConnected && (
            <GlassCard className="p-4 border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Scale Not Connected</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manual weight entry is available. Click "Connect Scale" to open a serial port to the ACLAS PS6X.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Configure serial port settings in Settings → Scale Configuration
                  </p>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Today's Transaction Log */}
      <TransactionLog readings={readings} onClear={clearReadings} />

      {/* Full Sales History */}
      <SalesHistory />
    </div>
  );
};

export default ScaleIntegration;
