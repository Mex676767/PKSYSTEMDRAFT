import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../src/hooks/use-auth";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { TabVisibilityPause } from "../src/components/tab-visibility-pause";
import Profile from "../src/pages/profile";
import "../src/index.css";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider><TooltipProvider>
      <div className="px-4 py-3 text-center text-xs text-muted-foreground border-b border-border">Local profile preview · sample account</div>
      <TabVisibilityPause /><Profile />
    </TooltipProvider></AuthProvider>
  </QueryClientProvider>,
);
