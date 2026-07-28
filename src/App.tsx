import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Wrapped = ({ children }: { children: React.ReactNode }) => (
  <Layout>{children}</Layout>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Wrapped><Dashboard /></Wrapped>} />
            <Route path="/products" element={<Wrapped><Products /></Wrapped>} />
            <Route path="/products-out" element={<Wrapped><ProductsOut /></Wrapped>} />
            <Route path="/sales" element={<Wrapped><Sales /></Wrapped>} />
            <Route path="/avenues" element={<Wrapped><Avenues /></Wrapped>} />
            <Route path="/expenses" element={<Wrapped><Expenses /></Wrapped>} />
            <Route path="/scale" element={<Wrapped><ScaleIntegration /></Wrapped>} />
            <Route path="/analytics" element={<Wrapped><Analytics /></Wrapped>} />
            <Route path="/reports" element={<Wrapped><Reports /></Wrapped>} />
            <Route path="/settings" element={<Wrapped><Settings /></Wrapped>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
