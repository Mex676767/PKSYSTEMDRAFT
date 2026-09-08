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
import Social from '@/pages/social';
import Challenges from '@/pages/challenges';
import HallOfFame from '@/pages/hall-of-fame';
import Mentors from '@/pages/mentors';
import Birthdays from '@/pages/birthdays';
import Lottery from '@/pages/lottery';
import Profile from '@/pages/profile';
import Games from '@/pages/games';
import WordleGame from '@/pages/wordle-game';
import DeskSetup from '@/pages/desk-setup';

const queryClient = new QueryClient();

// Re-enabled now that password-based test accounts exist as a workaround for
// the still-unresolved Supabase magic-link email delivery (see Login page's
// "sign in with a password instead" option).
const REQUIRE_LOGIN = true;

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/goals" component={Goals} />
          <Route path="/social" component={Social} />
          <Route path="/challenges" component={Challenges} />
          <Route path="/hall-of-fame" component={HallOfFame} />
          <Route path="/mentors" component={Mentors} />
          <Route path="/birthdays" component={Birthdays} />
          <Route path="/lottery" component={Lottery} />
          <Route path="/profile" component={Profile} />
          <Route path="/games" component={Games} />
          <Route path="/games/wordle" component={WordleGame} />
          <Route path="/games/desk-setup" component={DeskSetup} />
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
