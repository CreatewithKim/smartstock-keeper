import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminRoute } from "./components/admin/AdminRoute";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductsOut from "./pages/ProductsOut";
import Sales from "./pages/Sales";
import Avenues from "./pages/Avenues";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import ScaleIntegration from "./pages/ScaleIntegration";
import Analytics from "./pages/Analytics";
import Expenses from "./pages/Expenses";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminSales from "./pages/admin/AdminSales";
import AdminIntakes from "./pages/admin/AdminIntakes";
import AdminProductsOut from "./pages/admin/AdminProductsOut";
import AdminExpenses from "./pages/admin/AdminExpenses";
import AdminAlerts from "./pages/admin/AdminAlerts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Main App Routes */}
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/products" element={<Layout><Products /></Layout>} />
            <Route path="/products-out" element={<Layout><ProductsOut /></Layout>} />
            <Route path="/sales" element={<Layout><Sales /></Layout>} />
            <Route path="/avenues" element={<Layout><Avenues /></Layout>} />
            <Route path="/reports" element={<Layout><Reports /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="/scale" element={<Layout><ScaleIntegration /></Layout>} />
            <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
            <Route path="/expenses" element={<Layout><Expenses /></Layout>} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminLayout><AdminOverview /></AdminLayout></AdminRoute>} />
            <Route path="/admin/products" element={<AdminRoute><AdminLayout><AdminProducts /></AdminLayout></AdminRoute>} />
            <Route path="/admin/sales" element={<AdminRoute><AdminLayout><AdminSales /></AdminLayout></AdminRoute>} />
            <Route path="/admin/intakes" element={<AdminRoute><AdminLayout><AdminIntakes /></AdminLayout></AdminRoute>} />
            <Route path="/admin/products-out" element={<AdminRoute><AdminLayout><AdminProductsOut /></AdminLayout></AdminRoute>} />
            <Route path="/admin/expenses" element={<AdminRoute><AdminLayout><AdminExpenses /></AdminLayout></AdminRoute>} />
            <Route path="/admin/alerts" element={<AdminRoute><AdminLayout><AdminAlerts /></AdminLayout></AdminRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
