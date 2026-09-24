import { type ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { ServiceWorkerCleanup } from '@/components/service-worker-cleanup';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Users, Gift, Gamepad2, Dices } from 'lucide-react';
import { Shell } from '@/components/shell';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { VoiceCallProvider } from '@/hooks/use-voice-call';
import { AppPresenceProvider } from '@/hooks/use-app-presence';
import { FloatingCallBar } from '@/components/floating-call-bar';
import { ComingSoon } from '@/pages/coming-soon';

import Login from '@/pages/login';
import Onboarding from '@/pages/onboarding';
import Dashboard from '@/pages/dashboard';
import Goals from '@/pages/goals';
import Social from '@/pages/social';
import Challenges from '@/pages/challenges';
import PkDetail from '@/pages/pk-detail';
import Messages from '@/pages/messages';
import Profile from '@/pages/profile';
import Admin from '@/pages/admin';
import Rewards from '@/pages/rewards';
import Birthdays from '@/pages/birthdays';
import Voice from '@/pages/voice';
import HallOfFame from '@/pages/hall-of-fame';
import GuinnessRecords from '@/pages/guinness-records';

const queryClient = new QueryClient();

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
          <Route path="/challenges/:id" component={PkDetail} />
          <Route path="/messages" component={Messages} />
          <Route path="/hall-of-fame" component={HallOfFame} />
          <Route path="/guinness-records" component={GuinnessRecords} />
          <Route path="/mentors" component={() => <ComingSoon label="Mentors" icon={Users} />} />
          <Route path="/birthdays" component={Birthdays} />
          <Route path="/lottery" component={() => <ComingSoon label="Lucky Draw" icon={Gift} />} />
          <Route path="/profile" component={Profile} />
          <Route path="/rewards" component={Rewards} />
          <Route path="/games" component={() => <ComingSoon label="Games" icon={Gamepad2} />} />
          <Route path="/games/wordle" component={() => <ComingSoon label="Fastest Wordle Guesser" icon={Gamepad2} />} />
          <Route path="/games/desk-setup" component={() => <ComingSoon label="Best WFH Desk Setup" icon={Gamepad2} />} />
          <Route path="/games/quiz" component={() => <ComingSoon label="Brand Knowledge Quiz" icon={Gamepad2} />} />
          <Route path="/betting" component={() => <ComingSoon label="Betting" icon={Dices} />} />
          <Route path="/admin" component={Admin} />
          <Route path="/voice" component={Voice} />
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

function AppPresenceBoundary({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  return <AppPresenceProvider userId={profile?.id}>{children}</AppPresenceProvider>;
}

function isOnboarded(profile: ReturnType<typeof useAuth>['profile']) {
  return !!(
    profile?.username &&
    profile?.birthday &&
    profile?.role &&
    profile?.department
  );
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

  if (!isOnboarded(profile)) {
    return <Onboarding />;
  }

  return <Router />;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="engagement-hub-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <VoiceCallProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <AppPresenceBoundary>
                  <AuthGate />
                  <FloatingCallBar />
                </AppPresenceBoundary>
              </WouterRouter>
              <ServiceWorkerCleanup />
              <Toaster />
            </TooltipProvider>
          </VoiceCallProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
