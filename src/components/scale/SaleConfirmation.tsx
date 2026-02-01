import { Package, Scale, DollarSign, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Product } from '@/services/db';
import { WeightData } from '@/hooks/useScaleConnection';

interface SaleConfirmationProps {
  stableWeight: WeightData;
  product: Product | null;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function SaleConfirmation({ 
  stableWeight, 
  product, 
  onConfirm, 
  onCancel,
  isProcessing = false 
}: SaleConfirmationProps) {
  const weight = stableWeight.weight ?? 0;
  const unitPrice = product?.sellingPrice ?? 0;
  const totalPrice = weight * unitPrice;

  if (!product) {
    return (
      <GlassCard className="p-6 border-2 border-destructive/50">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <div>
            <h3 className="font-semibold text-destructive">Unknown Product</h3>
            <p className="text-sm text-muted-foreground">
              PLU: {stableWeight.productId || 'Not specified'}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          This product is not in the database. Please add it or use manual entry.
        </p>
        <Button variant="outline" onClick={onCancel} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Dismiss
        </Button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 border-2 border-green-500/50 bg-green-500/5">
      <div className="flex items-center gap-3 mb-6">
        <CheckCircle className="h-6 w-6 text-green-500" />
        <div>
          <h3 className="font-semibold text-lg">Confirm Sale</h3>
          <p className="text-sm text-muted-foreground">Weight is stable - ready to complete transaction</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Product</p>
            <p className="font-medium">{product.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="font-medium">{weight.toFixed(3)} kg</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Unit Price</p>
            <p className="font-medium">KES {unitPrice.toFixed(2)}/kg</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-primary">KES {totalPrice.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          className="flex-1"
          disabled={isProcessing}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          className="flex-1 bg-green-600 hover:bg-green-700"
          disabled={isProcessing}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isProcessing ? 'Processing...' : 'Confirm Sale'}
        </Button>
      </div>
    </GlassCard>
  );
}
