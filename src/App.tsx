import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useCloudSync } from "./hooks/useCloudSync";
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
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const CloudSyncBoot = () => {
  useCloudSync();
  return null;
};

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CloudSyncBoot />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Protected><Dashboard /></Protected>} />
              <Route path="/products" element={<Protected><Products /></Protected>} />
              <Route path="/products-out" element={<Protected><ProductsOut /></Protected>} />
              <Route path="/sales" element={<Protected><Sales /></Protected>} />
              <Route path="/avenues" element={<Protected><Avenues /></Protected>} />
              <Route path="/expenses" element={<Protected><Expenses /></Protected>} />
              <Route path="/scale" element={<Protected><ScaleIntegration /></Protected>} />
              <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
              <Route path="/reports" element={<Protected><Reports /></Protected>} />
              <Route path="/settings" element={<Protected><Settings /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
