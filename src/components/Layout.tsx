import { ReactNode, useState } from "react";
import { Package, LayoutDashboard, ShoppingCart, FileText, Settings, Menu, Wallet, Truck, Scale } from "lucide-react";
import { NavLink } from "./NavLink";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { PWAStatus } from "./PWAStatus";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: Truck, label: "Products Out", path: "/products-out" },
  { icon: ShoppingCart, label: "Sales", path: "/sales" },
  { icon: Wallet, label: "Avenues", path: "/avenues" },
  { icon: Scale, label: "Scale", path: "/scale" },
  { icon: FileText, label: "Reports", path: "/reports" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export const Layout = ({ children }: LayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full">
      {/* Mobile Header */}
      <header className="glass-strong fixed top-0 left-0 right-0 z-50 h-16 lg:hidden">
        <div className="container flex h-full items-center justify-between px-4">
          <h1 className="text-xl font-bold text-primary">SmartStock</h1>
          <div className="flex items-center gap-2">
            <PWAStatus />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex min-h-screen w-full pt-16 lg:pt-0">
        {/* Sidebar */}
        <aside
          className={cn(
            "glass-strong fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 overflow-y-auto transition-transform duration-300 lg:top-0 lg:h-screen lg:translate-x-0",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="space-y-6 p-6">
            <div className="hidden lg:block">
              <h1 className="text-2xl font-bold text-primary">SmartStock</h1>
              <p className="text-sm text-muted-foreground">Inventory Tracker</p>
              <div className="mt-3">
                <PWAStatus />
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
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
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          <div className="container mx-auto px-4 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
