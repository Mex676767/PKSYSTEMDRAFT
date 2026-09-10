import { type ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/notification-bell';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Trophy, Users, Cake, Gift, Gamepad2, Dices } from 'lucide-react';
import { Shell } from '@/components/shell';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ComingSoon } from '@/pages/coming-soon';

// Pages
import Login from '@/pages/login';
import SetUsername from '@/pages/set-username';
import Dashboard from '@/pages/dashboard';
import Goals from '@/pages/goals';
import Social from '@/pages/social';
import Challenges from '@/pages/challenges';
import Profile from '@/pages/profile';
import Admin from '@/pages/admin';

// Launch scope is Social/Goals/Challenges only (see src/lib/feature-flags.ts)
// -- everything below stays visible in the nav but renders ComingSoon
// instead. Not imported as real page components at all right now, so
// re-enabling one later is just: import it back and swap it in below.

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
          <Route path="/hall-of-fame" component={() => <ComingSoon label="Hall of Fame" icon={Trophy} />} />
          <Route path="/mentors" component={() => <ComingSoon label="Mentors" icon={Users} />} />
          <Route path="/birthdays" component={() => <ComingSoon label="Birthdays" icon={Cake} />} />
          <Route path="/lottery" component={() => <ComingSoon label="Lucky Draw" icon={Gift} />} />
          <Route path="/profile" component={Profile} />
          <Route path="/games" component={() => <ComingSoon label="Games" icon={Gamepad2} />} />
          <Route path="/games/wordle" component={() => <ComingSoon label="Fastest Wordle Guesser" icon={Gamepad2} />} />
          <Route path="/games/desk-setup" component={() => <ComingSoon label="Best WFH Desk Setup" icon={Gamepad2} />} />
          <Route path="/games/quiz" component={() => <ComingSoon label="Brand Knowledge Quiz" icon={Gamepad2} />} />
          <Route path="/betting" component={() => <ComingSoon label="Betting" icon={Dices} />} />
          <Route path="/admin" component={Admin} />
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
            <NotificationBell />
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
