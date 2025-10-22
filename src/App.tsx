import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletContextProvider } from "@/contexts/WalletContextProvider";
import Index from "./pages/Index";
import Play from "./pages/Play";
<<<<<<< HEAD
import Earnings from "./pages/Earnings";
=======
>>>>>>> 269b8779299bb2fcd72a0f7537f245cf0ebfedd7
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletContextProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/play" element={<Play />} />
<<<<<<< HEAD
            <Route path="/earnings" element={<Earnings />} />
=======
>>>>>>> 269b8779299bb2fcd72a0f7537f245cf0ebfedd7
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletContextProvider>
  </QueryClientProvider>
);

export default App;
