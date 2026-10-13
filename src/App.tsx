import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import Index from "./pages/Index";
import Training from "./pages/Training";
import Products from "./pages/Products";
import Simulate from "./pages/Simulate";
import Business from "./pages/Business";
import Settings from "./pages/Settings";
import AniaSettingsPage from "./pages/AniaSettings";
import Chat from "./pages/Chat";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import Vitrine from "./pages/Vitrine";
import Reviews from "./pages/Reviews";
import NotFound from "./pages/NotFound";
import { SplashScreen } from "./components/SplashScreen";
import { useOfficialIcon } from "./hooks/useOfficialIcon";
import { AdminGate } from "./components/AdminGate";

const queryClient = new QueryClient();

const OfficialIconInjector = () => {
  useOfficialIcon();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner position="top-center" />
        <OfficialIconInjector />
        <SplashScreen>
        <BrowserRouter>
          <Routes>
            {/* Painel administrativo (protegido pela senha do aplicativo) */}
            <Route path="/" element={<AdminGate><Index /></AdminGate>} />
            <Route path="/treinar" element={<AdminGate><Training /></AdminGate>} />
            <Route path="/produtos" element={<AdminGate><Products /></AdminGate>} />
            <Route path="/simular" element={<AdminGate><Simulate /></AdminGate>} />
            <Route path="/negocio" element={<AdminGate><Business /></AdminGate>} />
            <Route path="/ajustes" element={<AdminGate><Settings /></AdminGate>} />
            <Route path="/ania" element={<AdminGate><AniaSettingsPage /></AdminGate>} />
            <Route path="/conversas" element={<AdminGate><Conversations /></AdminGate>} />
            <Route path="/conversas/:id" element={<AdminGate><ConversationDetail /></AdminGate>} />
            <Route path="/avaliacoes" element={<AdminGate><Reviews /></AdminGate>} />
            
            {/* Vitrine pública */}
            <Route path="/vitrine" element={<Vitrine />} />
            <Route path="/loja/:slug" element={<Vitrine />} />
            <Route path="/loja/:slug/chat" element={<Chat />} />
            <Route path="/loja/:slug/chat/:productId" element={<Chat />} />
            
            {/* Chat público */}
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:productId" element={<Chat />} />
            <Route path="/c/:productId" element={<Chat />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </SplashScreen>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
