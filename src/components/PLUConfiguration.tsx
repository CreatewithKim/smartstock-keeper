import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, Settings, Zap, Package } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { productDB, Product } from '@/services/db';

export interface PLUMapping {
  plu: string;
  productId: number;
  productName: string;
  unitPrice: number;
}

interface PLUConfigurationProps {
  onMappingsChange?: (mappings: PLUMapping[]) => void;
  lastReceivedPLU?: string | null;
  pluError?: string | null;
  isConnected?: boolean;
}

const PLU_STORAGE_KEY = 'pluMappings';

export const loadPLUMappings = (): PLUMapping[] => {
  const saved = localStorage.getItem(PLU_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }
  return [];
};

export const savePLUMappings = (mappings: PLUMapping[]) => {
  localStorage.setItem(PLU_STORAGE_KEY, JSON.stringify(mappings));
};

export const findProductByPLU = (plu: string, mappings: PLUMapping[]): PLUMapping | undefined => {
  return mappings.find(m => m.plu === plu);
};

export const PLUConfiguration = ({ onMappingsChange, lastReceivedPLU, pluError, isConnected }: PLUConfigurationProps) => {
  const [mappings, setMappings] = useState<PLUMapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newPLU, setNewPLU] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadProducts();
    const savedMappings = loadPLUMappings();
    setMappings(savedMappings);
    onMappingsChange?.(savedMappings);
  }, []);

  // Find the matched product for the last received PLU
  const detectedMapping = lastReceivedPLU ? findProductByPLU(lastReceivedPLU, mappings) : undefined;
  const isPLUDetected = !!lastReceivedPLU;
  const isPLUMatched = !!detectedMapping;

  const loadProducts = async () => {
    const allProducts = await productDB.getAll();
    setProducts(allProducts);
  };

  const addMapping = () => {
    if (!newPLU.trim()) {
      toast({ title: 'Error', description: 'Please enter a PLU code', variant: 'destructive' });
      return;
    }

    if (!selectedProductId) {
      toast({ title: 'Error', description: 'Please select a product', variant: 'destructive' });
      return;
    }

    if (mappings.some(m => m.plu === newPLU.trim())) {
      toast({ title: 'Error', description: 'This PLU is already mapped', variant: 'destructive' });
      return;
    }

    const product = products.find(p => p.id?.toString() === selectedProductId);
    if (!product) {
      toast({ title: 'Error', description: 'Product not found', variant: 'destructive' });
      return;
    }

    const newMapping: PLUMapping = {
      plu: newPLU.trim(),
      productId: product.id!,
      productName: product.name,
      unitPrice: product.sellingPrice
    };

    const updated = [...mappings, newMapping];
    setMappings(updated);
    savePLUMappings(updated);
    onMappingsChange?.(updated);

    setNewPLU('');
    setSelectedProductId('');
    toast({ title: 'Success', description: `PLU ${newPLU} mapped to ${product.name}` });
  };

  const removeMapping = (plu: string) => {
    const updated = mappings.filter(m => m.plu !== plu);
    setMappings(updated);
    savePLUMappings(updated);
    onMappingsChange?.(updated);
    toast({ title: 'Removed', description: `PLU ${plu} mapping removed` });
  };

  const unmappedProducts = products.filter(
    p => !mappings.some(m => m.productId === p.id)
  );

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" />
          PLU Configuration
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{mappings.length} mapped</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {/* PLU Detection Status - Shows real-time PLU detection from scale */}
      <div className={`mb-4 p-4 rounded-lg border-2 transition-all duration-300 ${
        !isConnected 
          ? 'bg-muted/30 border-muted'
          : isPLUDetected
            ? isPLUMatched
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-destructive/10 border-destructive/50'
            : 'bg-primary/5 border-primary/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
            !isConnected
              ? 'bg-muted'
              : isPLUDetected
                ? isPLUMatched
                  ? 'bg-green-500/20'
                  : 'bg-destructive/20'
                : 'bg-primary/20'
          }`}>
            {isPLUDetected ? (
              isPLUMatched ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )
            ) : (
              <Zap className={`h-5 w-5 ${isConnected ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {!isConnected 
                  ? 'Scale Not Connected'
                  : isPLUDetected 
                    ? isPLUMatched 
                      ? 'PLU Matched' 
                      : 'PLU Not Found'
                    : 'Waiting for PLU Selection...'}
              </span>
              {isPLUDetected && (
                <Badge variant={isPLUMatched ? 'default' : 'destructive'} className="text-xs">
                  PLU: {lastReceivedPLU}
                </Badge>
              )}
            </div>
            
            {isPLUDetected && isPLUMatched && detectedMapping && (
              <div className="flex items-center gap-4 mt-1 text-sm">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  {detectedMapping.productName}
                </span>
                <span className="text-muted-foreground">
                  KES {detectedMapping.unitPrice.toFixed(2)}/kg
                </span>
              </div>
            )}
            
            {isPLUDetected && !isPLUMatched && (
              <p className="text-sm text-destructive mt-1">
                PLU "{lastReceivedPLU}" is not configured. Add it below.
              </p>
            )}
            
            {!isConnected && (
              <p className="text-sm text-muted-foreground mt-1">
                Connect to the scale middleware to detect PLU selections.
              </p>
            )}
            
            {isConnected && !isPLUDetected && (
              <p className="text-sm text-muted-foreground">
                Press a product number + PLU button on the scale (e.g., 1 + PLU)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* PLU Error Display */}
      {pluError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">PLU Mismatch Error</p>
            <p className="text-sm text-muted-foreground">{pluError}</p>
            {lastReceivedPLU && (
              <p className="text-sm mt-1">
                Received PLU: <code className="bg-muted px-1 rounded">{lastReceivedPLU}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {isExpanded && (
        <>
          {/* Add New Mapping */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label>PLU Code (from scale)</Label>
              <Input
                value={newPLU}
                onChange={(e) => setNewPLU(e.target.value)}
                placeholder="e.g., 0001"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Map to Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {unmappedProducts.map(product => (
                    <SelectItem key={product.id} value={product.id!.toString()}>
                      {product.name} - KES {product.sellingPrice}
                    </SelectItem>
                  ))}
                  {unmappedProducts.length === 0 && (
                    <SelectItem value="none" disabled>
                      All products mapped
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={addMapping} className="gap-2 w-full md:w-auto">
                <Plus className="h-4 w-4" />
                Add Mapping
              </Button>
            </div>
          </div>

          {/* Current Mappings Table */}
          {mappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No PLU mappings configured. Add mappings to link scale PLUs to your products.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3">PLU Code</th>
                    <th className="text-left py-2 px-3">Product Name</th>
                    <th className="text-right py-2 px-3">Unit Price</th>
                    <th className="text-center py-2 px-3">Status</th>
                    <th className="text-center py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => (
                    <tr key={mapping.plu} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3">
                        <code className="bg-muted px-2 py-0.5 rounded">{mapping.plu}</code>
                      </td>
                      <td className="py-2 px-3">{mapping.productName}</td>
                      <td className="py-2 px-3 text-right">KES {mapping.unitPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="default" className="gap-1 text-xs">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMapping(mapping.plu)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!isExpanded && mappings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mappings.slice(0, 5).map((m) => (
            <Badge key={m.plu} variant="secondary" className="text-xs">
              {m.plu} → {m.productName}
            </Badge>
          ))}
          {mappings.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{mappings.length - 5} more
            </Badge>
          )}
        </div>
      )}
    </GlassCard>
  );
};
