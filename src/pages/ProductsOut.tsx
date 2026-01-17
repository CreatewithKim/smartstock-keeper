import { useEffect, useState } from "react";
import { Truck, Plus, Calendar, Pencil, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productDB, productOutDB, Product, ProductOut } from "@/services/db";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function ProductsOut() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsOut, setProductsOut] = useState<ProductOut[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProductOut, setEditingProductOut] = useState<ProductOut | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    productId: "",
    quantity: "",
    destination: "",
    date: new Date(),
    notes: "",
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, productsOutData] = await Promise.all([
        productDB.getAll(),
        productOutDB.getAll(),
      ]);
      setProducts(productsData);
      setProductsOut(productsOutData.sort((a, b) => b.date.getTime() - a.date.getTime()));
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
      destination: "",
      date: new Date(),
      notes: "",
    });
    setSelectedProduct(null);
    setEditingProductOut(null);
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id?.toString() === productId);
    setSelectedProduct(product || null);
    setFormData({ ...formData, productId });
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
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    if (!formData.destination.trim()) {
      toast({
        title: "Error",
        description: "Please enter a destination",
        variant: "destructive",
      });
      return;
    }

    if (!editingProductOut && quantity > selectedProduct.currentStock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${selectedProduct.currentStock.toFixed(2)} units available`,
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingProductOut) {
        await productOutDB.update({
          ...editingProductOut,
          productId: selectedProduct.id!,
          productName: selectedProduct.name,
          quantity,
          destination: formData.destination.trim(),
          date: formData.date,
          notes: formData.notes,
        });
        toast({
          title: "Success",
          description: "Product out record updated successfully",
        });
      } else {
        const productOutData = {
          productId: selectedProduct.id!,
          productName: selectedProduct.name,
          quantity,
          destination: formData.destination.trim(),
          date: formData.date,
          notes: formData.notes,
        };

        await productOutDB.add(productOutData);

        toast({
          title: "Success",
          description: "Product out recorded successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving product out:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save product out",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (productOut: ProductOut) => {
    const product = products.find((p) => p.id === productOut.productId);
    setEditingProductOut(productOut);
    setSelectedProduct(product || null);
    setFormData({
      productId: productOut.productId.toString(),
      quantity: productOut.quantity.toString(),
      destination: productOut.destination,
      date: productOut.date,
      notes: productOut.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await productOutDB.delete(id);
      toast({
        title: "Success",
        description: "Product out record deleted successfully",
      });
      loadData();
    } catch (error: any) {
      console.error("Error deleting product out:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete record",
        variant: "destructive",
      });
    }
  };

  const todayProductsOut = productsOut.filter((p) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return p.date >= today;
  });

  const todayTotal = todayProductsOut.reduce((sum, p) => sum + p.quantity, 0);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading products out...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Products Out</h1>
          <p className="text-muted-foreground">Track products distributed to other locations</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Record Product Out
        </Button>
      </div>

      {/* Today's Summary */}
      <GlassCard className="border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Today's Products Out</p>
            <p className="text-3xl font-bold text-primary">
              {todayTotal.toFixed(2)} units
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {todayProductsOut.length} distribution{todayProductsOut.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Truck className="h-12 w-12 text-primary/30" />
        </div>
      </GlassCard>

      {/* Products Out History */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-4">Distribution History</h2>
        {productsOut.length > 0 ? (
          <div className="space-y-3">
            {productsOut.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-primary/5 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{item.productName}</p>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Qty: {item.quantity.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="h-3 w-3" />
                    <span>{item.destination}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(item.date, "MMM dd, yyyy")}
                  </p>
                  {item.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">{item.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(item.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Truck className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No distributions yet</h3>
            <p className="text-muted-foreground mb-4">Start recording your first product out</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Record Product Out
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProductOut ? "Edit Product Out" : "Record Product Out"}
            </DialogTitle>
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
                      {product.name} (Stock: {product.currentStock.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
              <>
                <div className="rounded-lg bg-primary/10 p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Available Stock:</span>
                    <span className="font-semibold text-foreground">
                      {selectedProduct.currentStock.toFixed(2)} units
                    </span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Enter quantity"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    type="text"
                    placeholder="e.g., Branch B, Partner Shop"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.date && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.date}
                        onSelect={(date) => date && setFormData({ ...formData, date })}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

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
              <Button type="submit" disabled={!selectedProduct}>
                {editingProductOut ? "Update" : "Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
