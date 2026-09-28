import { lazy, Suspense, type ReactNode } from "react";
import { Gift, Gamepad2, Dices, Users } from "lucide-react";
import { Route, Switch, useLocation } from "wouter";
import { AppPresenceProvider } from "@/hooks/use-app-presence";
import { useAuth } from "@/hooks/use-auth";
import { VoiceCallProvider, useVoiceCall } from "@/hooks/use-voice-call";
import { DailyGoalReminder } from "@/components/daily-goal-reminder";
import { ErrorBoundary } from "@/components/error-boundary";
import { LiveDataSync } from "@/components/live-data-sync";
import { Shell } from "@/components/shell";
import { ComingSoon } from "@/pages/coming-soon";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Goals = lazy(() => import("@/pages/goals"));
const Social = lazy(() => import("@/pages/social"));
const Challenges = lazy(() => import("@/pages/challenges"));
const PkDetail = lazy(() => import("@/pages/pk-detail"));
const Messages = lazy(() => import("@/pages/messages"));
const Profile = lazy(() => import("@/pages/profile"));
const Admin = lazy(() => import("@/pages/admin"));
const Rewards = lazy(() => import("@/pages/rewards"));
const Birthdays = lazy(() => import("@/pages/birthdays"));
const Voice = lazy(() => import("@/pages/voice"));
const HallOfFame = lazy(() => import("@/pages/hall-of-fame"));
const GuinnessRecords = lazy(() => import("@/pages/guinness-records"));
const LearningHub = lazy(() => import("@/pages/learning-hub"));
const Gratitude = lazy(() => import("@/pages/gratitude"));
const NotFound = lazy(() => import("@/pages/not-found"));
const FloatingCallBar = lazy(() =>
  import("@/components/floating-call-bar").then((module) => ({ default: module.FloatingCallBar })),
);

function RouteLoading() {
  return (
    <div className="min-h-[45vh] flex items-center justify-center">
      <div className="animate-pulse w-8 h-8 rounded-full bg-primary/30" />
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return (
    <Shell>
      <DailyGoalReminder />
      <RoutedErrorBoundary>
        <Suspense fallback={<RouteLoading />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/goals" component={Goals} />
            <Route path="/social" component={Social} />
            <Route path="/challenges" component={Challenges} />
            <Route path="/challenges/:id" component={PkDetail} />
            <Route path="/messages" component={Messages} />
            <Route path="/hall-of-fame" component={HallOfFame} />
            <Route path="/guinness-records" component={GuinnessRecords} />
            <Route path="/learning" component={LearningHub} />
            <Route path="/gratitude" component={Gratitude} />
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
        </Suspense>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function AppPresenceBoundary({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  return (
    <AppPresenceProvider userId={profile?.is_approved ? profile.id : undefined}>
      {children}
    </AppPresenceProvider>
  );
}

function FloatingCallBarGate() {
  const { channelId } = useVoiceCall();
  if (!channelId) return null;
  return (
    <Suspense fallback={null}>
      <FloatingCallBar />
    </Suspense>
  );
}

export default function AuthenticatedApp() {
  return (
    <VoiceCallProvider>
      <AppPresenceBoundary>
        <LiveDataSync />
        <Router />
        <FloatingCallBarGate />
      </AppPresenceBoundary>
    </VoiceCallProvider>
  );
}
