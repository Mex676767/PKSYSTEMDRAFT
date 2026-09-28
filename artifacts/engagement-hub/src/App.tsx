import { lazy, Suspense } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ServiceWorkerCleanup } from '@/components/service-worker-cleanup';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Router as WouterRouter } from 'wouter';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import AuthenticatedApp from '@/components/authenticated-app';
import Login from '@/pages/login';

const Onboarding = lazy(() => import('@/pages/onboarding'));
const ApprovalPending = lazy(() => import('@/pages/approval-pending'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});

const REQUIRE_LOGIN = true;

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
    return <AuthenticatedApp />;
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

  if (profile && !profile.is_approved) {
    return <Suspense fallback={<AppLoading />}><ApprovalPending /></Suspense>;
  }

  if (!isOnboarded(profile)) {
    return <Suspense fallback={<AppLoading />}><Onboarding /></Suspense>;
  }

  return <AuthenticatedApp />;
}

function AppLoading() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center app-gradient-bg">
      <div className="animate-pulse w-10 h-10 rounded-full bg-primary/30" />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="engagement-hub-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AuthGate />
            </WouterRouter>
            <ServiceWorkerCleanup />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
