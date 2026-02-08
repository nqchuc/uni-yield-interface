import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import VaultPage from "./pages/VaultPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import UniYieldPage from "./pages/UniYieldPage";
import NotFound from "./pages/NotFound";
import { UniYieldProvider } from "./lib/uniyield";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<VaultPage />} />
          <Route path="/portfolio" element={<Navigate to="/uniyield" replace />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route
            path="/uniyield"
            element={
              <UniYieldProvider>
                <UniYieldPage />
              </UniYieldProvider>
            }
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
