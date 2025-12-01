import { useEffect, useState } from "react";
import { ShoppingCart, Calendar } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productDB, salesDB, Product, Sale } from "@/services/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

export default function Sales() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    productId: "",
    quantity: "",
    notes: "",
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, salesData] = await Promise.all([
        productDB.getAll(),
        salesDB.getAll(),
      ]);
      setProducts(productsData);
      setSales(salesData.sort((a, b) => b.date.getTime() - a.date.getTime()));
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      productId: "",
      quantity: "",
      notes: "",
    });
    setSelectedProduct(null);
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id?.toString() === productId);
    setSelectedProduct(product || null);
    setFormData({ ...formData, productId });
  };

  const calculateTotal = () => {
    if (!selectedProduct || !formData.quantity) return 0;
    return parseFloat(formData.quantity) * selectedProduct.sellingPrice;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseFloat(formData.quantity);

    if (quantity > selectedProduct.currentStock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${selectedProduct.currentStock} units available`,
        variant: "destructive",
      });
      return;
    }

    try {
      const saleData = {
        productId: selectedProduct.id!,
        productName: selectedProduct.name,
        quantity,
        unitPrice: selectedProduct.sellingPrice,
        totalAmount: calculateTotal(),
        date: new Date(),
        notes: formData.notes,
      };

      await salesDB.add(saleData);

      toast({
        title: "Success",
        description: "Sale recorded successfully",
      });

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Error recording sale:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record sale",
        variant: "destructive",
      });
    }
  };

  const todaySales = sales.filter((s) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return s.date >= today;
  });

  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading sales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Sales</h1>
          <p className="text-muted-foreground">Record and track your daily sales</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          Record Sale
        </Button>
      </div>

      {/* Today's Summary */}
      <GlassCard className="border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Today's Total Sales</p>
            <p className="text-3xl font-bold text-primary">
              KSh {todayTotal.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {todaySales.length} transaction{todaySales.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Calendar className="h-12 w-12 text-primary/30" />
        </div>
      </GlassCard>

      {/* Sales History */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-4">Sales History</h2>
        {sales.length > 0 ? (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg bg-primary/5 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{sale.productName}</p>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Qty: {sale.quantity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(sale.date, "MMM dd, yyyy 'at' h:mm a")}
                  </p>
                  {sale.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">{sale.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    KSh {sale.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @ KSh {sale.unitPrice} each
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No sales yet</h3>
            <p className="text-muted-foreground mb-4">Start recording your first sale</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Record Sale
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Record Sale Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>Record New Sale</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="product">Select Product</Label>
              <Select value={formData.productId} onValueChange={handleProductSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id!.toString()}>
                      {product.name} (Stock: {product.currentStock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
              <>
                <div className="rounded-lg bg-primary/10 p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Selling Price:</span>
                    <span className="font-semibold text-foreground">
                      KSh {selectedProduct.sellingPrice}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Available Stock:</span>
                    <span className="font-semibold text-foreground">
                      {selectedProduct.currentStock} units
                    </span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity Sold</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedProduct.currentStock}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>

                {formData.quantity && (
                  <div className="rounded-lg bg-primary/20 p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                    <p className="text-2xl font-bold text-primary">
                      KSh {calculateTotal().toLocaleString()}
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedProduct || !formData.quantity}>
                Record Sale
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
