import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UnitProvider } from "@/contexts/UnitContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Prospeccao from "@/pages/Prospeccao";
import CrmLeads from "@/pages/CrmLeads";
import Endotoxina from "@/pages/Endotoxina";
import Enriquecimento from "@/pages/Enriquecimento";
import Relatorios from "@/pages/Relatorios";
import Certificacao from "@/pages/Certificacao";
import Configuracoes from "@/pages/Configuracoes";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UnitProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/prospeccao" element={<Prospeccao />} />
              <Route path="/crm" element={<CrmLeads />} />
              <Route path="/endotoxina" element={<Endotoxina />} />
              <Route path="/enriquecimento" element={<Enriquecimento />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/certificacao" element={<Certificacao />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </UnitProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
