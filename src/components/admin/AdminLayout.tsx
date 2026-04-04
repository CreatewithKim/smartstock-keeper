import { ReactNode, useState } from "react";
import { LayoutDashboard, Package, ShoppingCart, TrendingDown, Wallet, Receipt, LogOut, Menu, AlertTriangle } from "lucide-react";
import { NavLink } from "../NavLink";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AdminLayoutProps {
  children: ReactNode;
}

const adminNavItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/admin" },
  { icon: Package, label: "Products", path: "/admin/products" },
  { icon: ShoppingCart, label: "Sales", path: "/admin/sales" },
  { icon: Wallet, label: "Stock Intakes", path: "/admin/intakes" },
  { icon: TrendingDown, label: "Products Out", path: "/admin/products-out" },
  { icon: Receipt, label: "Expenses", path: "/admin/expenses" },
  { icon: AlertTriangle, label: "Alerts", path: "/admin/alerts" },
];

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="container flex h-full items-center justify-between px-4">
          <h1 className="text-xl font-bold text-primary">SmartStock Admin</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <div className="flex min-h-screen w-full pt-16 lg:pt-0">
        <aside className={cn(
          "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-border bg-card transition-transform duration-300 lg:top-0 lg:h-screen lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="space-y-6 p-6">
            <div className="hidden lg:block">
              <h1 className="text-2xl font-bold text-primary">SmartStock</h1>
              <p className="text-sm text-destructive font-medium">Admin Panel</p>
            </div>

            <nav className="space-y-2">
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-foreground/70 transition-all hover:bg-primary/10 hover:text-primary"
                  activeClassName="bg-primary/20 text-primary font-semibold"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-64">
          <div className="container mx-auto px-4 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
