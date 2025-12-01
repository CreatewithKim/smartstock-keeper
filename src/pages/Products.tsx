import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, Package as PackageIcon, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productDB, stockIntakeDB, Product } from "@/services/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Products() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStockIntakeDialogOpen, setIsStockIntakeDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockIntakeProduct, setStockIntakeProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    costPrice: "",
    sellingPrice: "",
    currentStock: "",
    initialStock: "",
    lowStockThreshold: "",
  });

  const [stockIntakeData, setStockIntakeData] = useState({
    quantity: "",
    notes: "",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await productDB.getAll();
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      costPrice: "",
      sellingPrice: "",
      currentStock: "",
      initialStock: "",
      lowStockThreshold: "",
    });
    setEditingProduct(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      currentStock: product.currentStock.toString(),
      initialStock: product.initialStock.toString(),
      lowStockThreshold: product.lowStockThreshold.toString(),
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const productData = {
        name: formData.name,
        category: formData.category,
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        currentStock: parseFloat(formData.currentStock),
        initialStock: parseFloat(formData.initialStock),
        lowStockThreshold: parseFloat(formData.lowStockThreshold),
        createdAt: editingProduct?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      if (editingProduct) {
        await productDB.update({ ...productData, id: editingProduct.id });
        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        await productDB.add(productData);
        toast({
          title: "Success",
          description: "Product added successfully",
        });
      }

      setIsAddDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct?.id) return;

    try {
      await productDB.delete(deleteProduct.id);
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      setDeleteProduct(null);
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  const handleOpenStockIntake = (product: Product) => {
    setStockIntakeProduct(product);
    setStockIntakeData({ quantity: "", notes: "" });
    setIsStockIntakeDialogOpen(true);
  };

  const handleStockIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockIntakeProduct?.id) return;

    try {
      const quantity = parseFloat(stockIntakeData.quantity);
      
      await stockIntakeDB.add({
        productId: stockIntakeProduct.id,
        productName: stockIntakeProduct.name,
        quantity,
        date: new Date(),
        notes: stockIntakeData.notes,
      });

      toast({
        title: "Success",
        description: `Added ${quantity} units to ${stockIntakeProduct.name}`,
      });

      setIsStockIntakeDialogOpen(false);
      setStockIntakeProduct(null);
      setStockIntakeData({ quantity: "", notes: "" });
      loadProducts();
    } catch (error) {
      console.error("Error adding stock:", error);
      toast({
        title: "Error",
        description: "Failed to add stock",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Products</h1>
          <p className="text-muted-foreground">Manage your inventory products</p>
        </div>
        <Button onClick={handleOpenAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <GlassCard>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </GlassCard>

      {filteredProducts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <GlassCard key={product.id} hover>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenStockIntake(product)}
                      title="Add Stock"
                    >
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditDialog(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteProduct(product)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Stock</p>
                    <p className="font-semibold text-foreground">{product.currentStock}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Selling Price</p>
                    <p className="font-semibold text-primary">KSh {product.sellingPrice}</p>
                  </div>
                </div>

                {product.currentStock <= product.lowStockThreshold && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Low stock alert!
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard>
          <div className="text-center py-12">
            <PackageIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Get started by adding your first product"}
            </p>
            {!searchQuery && (
              <Button onClick={handleOpenAddDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="costPrice">Cost Price (KSh)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sellingPrice">Selling Price (KSh)</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="initialStock">Initial Stock</Label>
                <Input
                  id="initialStock"
                  type="number"
                  value={formData.initialStock}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      initialStock: e.target.value,
                      currentStock: editingProduct ? formData.currentStock : e.target.value,
                    });
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="currentStock">Current Stock</Label>
                <Input
                  id="currentStock"
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingProduct ? "Update" : "Add"} Product
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock Intake Dialog */}
      <Dialog open={isStockIntakeDialogOpen} onOpenChange={setIsStockIntakeDialogOpen}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stock - {stockIntakeProduct?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStockIntakeSubmit} className="space-y-4">
            <div className="rounded-lg bg-primary/10 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Stock:</span>
                <span className="font-semibold text-foreground">
                  {stockIntakeProduct?.currentStock} units
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="intakeQuantity">Quantity to Add</Label>
              <Input
                id="intakeQuantity"
                type="number"
                step="0.01"
                min="0.01"
                value={stockIntakeData.quantity}
                onChange={(e) => setStockIntakeData({ ...stockIntakeData, quantity: e.target.value })}
                required
              />
            </div>

            {stockIntakeData.quantity && stockIntakeProduct && (
              <div className="rounded-lg bg-primary/20 p-4">
                <p className="text-sm text-muted-foreground mb-1">New Stock Level</p>
                <p className="text-2xl font-bold text-primary">
                  {(parseFloat(stockIntakeProduct.currentStock.toString()) + parseFloat(stockIntakeData.quantity)).toFixed(2)} units
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="intakeNotes">Notes (Optional)</Label>
              <Textarea
                id="intakeNotes"
                placeholder="Supplier, batch number, etc..."
                value={stockIntakeData.notes}
                onChange={(e) => setStockIntakeData({ ...stockIntakeData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsStockIntakeDialogOpen(false);
                  setStockIntakeProduct(null);
                  setStockIntakeData({ quantity: "", notes: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                Add Stock
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
