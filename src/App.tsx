import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Navigation from "./components/navigation";
import Dashboard from "./pages/dashboard";
import ScanResults from "./pages/scan-results";
import ErrorPage from "./pages/error-page";
import DeepAnalysis from "./pages/deep-analysis";
import VisualReports from "./pages/visual-reports";
import SpaceCleanup from "./pages/space-cleanup";
import NotFound from "./pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/scan-results" component={ScanResults} />
      <Route path="/error-page" component={ErrorPage} />
      <Route path="/deep-analysis" component={DeepAnalysis} />
      <Route path="/visual-reports" component={VisualReports} />
      <Route path="/space-cleanup" component={SpaceCleanup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main>
            <Router />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
