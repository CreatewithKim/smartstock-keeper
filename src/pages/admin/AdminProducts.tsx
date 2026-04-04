import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const AdminProducts = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setLoading(false);
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Products Monitor</h1>
        <p className="text-muted-foreground">{products.length} products tracked</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((product: any) => {
          const isLow = product.current_stock <= product.low_stock_threshold;
          return (
            <Card key={product.id} className={isLow ? "border-destructive/50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <Badge variant={isLow ? "destructive" : "secondary"}>{product.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Stock</span>
                  <span className={`font-semibold ${isLow ? 'text-destructive' : ''}`}>{Number(product.current_stock).toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Selling Price</span>
                  <span className="font-semibold">KES {Number(product.selling_price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial Stock</span>
                  <span>{Number(product.initial_stock).toFixed(1)} kg</span>
                </div>
                {isLow && <p className="text-xs text-destructive font-medium">⚠ Below low stock threshold ({Number(product.low_stock_threshold)} kg)</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted-foreground">No products found.</p>}
    </div>
  );
};

export default AdminProducts;
