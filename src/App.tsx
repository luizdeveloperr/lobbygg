import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import AddServer from "./pages/AddServer";
import EditServer from "./pages/EditServer";
import MyServers from "./pages/MyServers";
import AdminDashboard from "./pages/AdminDashboard";
import ServerDetail from "./pages/ServerDetail";
import SlugRedirect from "./pages/SlugRedirect";
import NotFound from "./pages/NotFound";
import MaintenanceGuard from "./components/MaintenanceGuard";
import { AdminRoute } from "./components/AdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <MaintenanceGuard>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/add" element={<AddServer />} />
              <Route path="/my-servers" element={<MyServers />} />
              <Route 
                path="/admin" 
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                } 
              />
              <Route path="/my-servers/edit/:id" element={<EditServer />} />
              <Route path="/server/:id" element={<ServerDetail />} />
              <Route path="/c/:slug" element={<SlugRedirect />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MaintenanceGuard>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
