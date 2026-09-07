import { type ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import { AuthProvider, useAuth } from '@/hooks/use-auth';

// Pages
import Login from '@/pages/login';
import SetUsername from '@/pages/set-username';
import Dashboard from '@/pages/dashboard';
import Goals from '@/pages/goals';
import Challenges from '@/pages/challenges';
import HallOfFame from '@/pages/hall-of-fame';
import Mentors from '@/pages/mentors';
import Birthdays from '@/pages/birthdays';
import Lottery from '@/pages/lottery';

const queryClient = new QueryClient();

// TEMPORARY: flip back to true to re-enable the login requirement.
// Turned off while sorting out the Supabase email-sending setup so the rest
// of the app can still be tested/demoed in the meantime.
const REQUIRE_LOGIN = false;

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/goals" component={Goals} />
          <Route path="/challenges" component={Challenges} />
          <Route path="/hall-of-fame" component={HallOfFame} />
          <Route path="/mentors" component={Mentors} />
          <Route path="/birthdays" component={Birthdays} />
          <Route path="/lottery" component={Lottery} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AuthGate() {
  const { session, profile, loading } = useAuth();

  if (!REQUIRE_LOGIN) {
    return <Router />;
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center app-gradient-bg">
        <div className="animate-pulse w-10 h-10 rounded-full bg-primary/30" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (!profile?.username) {
    return <SetUsername />;
  }

  return <Router />;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="engagement-hub-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <ThemeToggle />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AuthGate />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
