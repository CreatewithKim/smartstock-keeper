import { useEffect, useState } from "react";
import { ShoppingCart, Calendar, Plus, Pencil, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productDB, salesDB, excessSalesDB, Product, Sale, ExcessSale } from "@/services/db";
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
  const [excessSales, setExcessSales] = useState<ExcessSale[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExcessDialogOpen, setIsExcessDialogOpen] = useState(false);
  const [editingExcess, setEditingExcess] = useState<ExcessSale | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    productId: "",
    totalAmount: "",
    notes: "",
  });

  const [excessFormData, setExcessFormData] = useState({
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, salesData, excessSalesData] = await Promise.all([
        productDB.getAll(),
        salesDB.getAll(),
        excessSalesDB.getAll(),
      ]);
      setProducts(productsData);
      setSales(salesData.sort((a, b) => b.date.getTime() - a.date.getTime()));
      setExcessSales(excessSalesData.sort((a, b) => b.date.getTime() - a.date.getTime()));
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
      totalAmount: "",
      notes: "",
    });
    setSelectedProduct(null);
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id?.toString() === productId);
    setSelectedProduct(product || null);
    setFormData({ ...formData, productId });
  };

  const calculateQuantity = () => {
    if (!selectedProduct || !formData.totalAmount) return 0;
    return parseFloat(formData.totalAmount) / selectedProduct.sellingPrice;
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

    const totalAmount = parseFloat(formData.totalAmount);
    const quantity = calculateQuantity();

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
        totalAmount,
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

  const handleExcessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(excessFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingExcess) {
        await excessSalesDB.update({
          ...editingExcess,
          amount,
          date: new Date(excessFormData.date),
          notes: excessFormData.notes,
        });
        toast({
          title: "Success",
          description: "Excess sale updated successfully",
        });
      } else {
        const excessSaleData = {
          amount,
          date: new Date(excessFormData.date),
          notes: excessFormData.notes,
        };
        await excessSalesDB.add(excessSaleData);
        toast({
          title: "Success",
          description: "Excess sale recorded successfully",
        });
      }

      setIsExcessDialogOpen(false);
      setEditingExcess(null);
      setExcessFormData({
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
      loadData();
    } catch (error: any) {
      console.error("Error saving excess sale:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save excess sale",
        variant: "destructive",
      });
    }
  };

  const handleEditExcess = (excessSale: ExcessSale) => {
    setEditingExcess(excessSale);
    setExcessFormData({
      amount: excessSale.amount.toString(),
      date: format(excessSale.date, "yyyy-MM-dd"),
      notes: excessSale.notes || "",
    });
    setIsExcessDialogOpen(true);
  };

  const handleDeleteExcess = async (id: number) => {
    try {
      await excessSalesDB.delete(id);
      toast({
        title: "Success",
        description: "Excess sale deleted successfully",
      });
      loadData();
    } catch (error: any) {
      console.error("Error deleting excess sale:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete excess sale",
        variant: "destructive",
      });
    }
  };

  const todaySales = sales.filter((s) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return s.date >= today;
  });

  const todayExcessSales = excessSales.filter((s) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return s.date >= today;
  });

  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const todayExcessTotal = todayExcessSales.reduce((sum, sale) => sum + sale.amount, 0);

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
        <div className="flex gap-2">
          <Button onClick={() => setIsExcessDialogOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Record Excess
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Record Sale
          </Button>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Today's Product Sales</p>
              <p className="text-3xl font-bold text-primary">
                KSh {todayTotal.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {todaySales.length} transaction{todaySales.length !== 1 ? "s" : ""}
              </p>
            </div>
            <ShoppingCart className="h-12 w-12 text-primary/30" />
          </div>
        </GlassCard>

        <GlassCard className="border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Today's Excess Sales</p>
              <p className="text-3xl font-bold text-amber-500">
                KSh {todayExcessTotal.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {todayExcessSales.length} record{todayExcessSales.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Plus className="h-12 w-12 text-amber-500/30" />
          </div>
        </GlassCard>
      </div>

      {/* Today's Sales */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-4">Today's Sales</h2>
        {todaySales.length > 0 ? (
          <div className="space-y-3">
            {todaySales.map((sale) => (
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

      {/* Today's Excess Sales */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-4">Today's Excess Sales</h2>
        {todayExcessSales.length > 0 ? (
          <div className="space-y-3">
            {todayExcessSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg bg-amber-500/5 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">Excess Sale</p>
                    <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
                      Uncategorized
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(sale.date, "MMM dd, yyyy")}
                  </p>
                  {sale.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">{sale.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-500">
                      KSh {sale.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleEditExcess(sale)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteExcess(sale.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No excess sales</h3>
            <p className="text-muted-foreground">Record uncategorized sales here</p>
          </div>
        )}
      </GlassCard>
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
                  <Label htmlFor="totalAmount">Total Amount Sold (KSh)</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Enter total sales amount"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    required
                  />
                </div>

                {formData.totalAmount && (
                  <div className="rounded-lg bg-primary/20 p-4">
                    <p className="text-sm text-muted-foreground mb-1">Calculated Quantity</p>
                    <p className="text-2xl font-bold text-primary">
                      {calculateQuantity().toFixed(2)} units
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      @ KSh {selectedProduct.sellingPrice} per unit
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
              <Button type="submit" disabled={!selectedProduct || !formData.totalAmount}>
                Record Sale
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record/Edit Excess Sale Dialog */}
      <Dialog open={isExcessDialogOpen} onOpenChange={(open) => {
        setIsExcessDialogOpen(open);
        if (!open) {
          setEditingExcess(null);
          setExcessFormData({
            amount: "",
            date: format(new Date(), "yyyy-MM-dd"),
            notes: "",
          });
        }
      }}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExcess ? "Edit Excess Sale" : "Record Excess Sale"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExcessSubmit} className="space-y-4">
            <div>
              <Label htmlFor="excessAmount">Amount (KSh)</Label>
              <Input
                id="excessAmount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter excess sale amount"
                value={excessFormData.amount}
                onChange={(e) => setExcessFormData({ ...excessFormData, amount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="excessDate">Date</Label>
              <Input
                id="excessDate"
                type="date"
                value={excessFormData.date}
                onChange={(e) => setExcessFormData({ ...excessFormData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="excessNotes">Notes (Optional)</Label>
              <Textarea
                id="excessNotes"
                placeholder="Describe the excess sale..."
                value={excessFormData.notes}
                onChange={(e) => setExcessFormData({ ...excessFormData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsExcessDialogOpen(false);
                  setEditingExcess(null);
                  setExcessFormData({
                    amount: "",
                    date: format(new Date(), "yyyy-MM-dd"),
                    notes: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!excessFormData.amount}>
                {editingExcess ? "Update" : "Record Excess"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
