import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChallengesList } from "@/hooks/use-challenges";
import { useBirthdays } from "@/hooks/use-birthdays";
import { useGoalsFeed, GOAL_TERM_META, type GoalTerm } from "@/hooks/use-goals";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Flame, Target, Trophy, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PointsCard } from "@/components/points-card";

const TERM_BADGE_CLASS: Record<GoalTerm, string> = {
  long: "bg-accent/20 text-accent border-accent/30",
  mid: "bg-secondary/15 text-secondary border-secondary/30",
  short: "bg-primary/15 text-primary border-primary/30",
};

const DASHBOARD_GOAL_PREVIEW_COUNT = 10;

export default function Dashboard() {
  const { profile } = useAuth();
  const { data: goalsFeed = [] } = useGoalsFeed();
  const { data: challenges = [] } = useChallengesList();
  const { data: birthdays = [] } = useBirthdays();

  const recentGoals = goalsFeed.slice(0, DASHBOARD_GOAL_PREVIEW_COUNT);
  const activeChallenges = challenges.filter((c) => c.status === "active");
  const todayBirthdays = birthdays.filter((b) => b.isToday);

  // Falls back to a generic greeting when there's no real logged-in profile
  // (e.g. while login is temporarily disabled for testing).
  const displayName = profile?.username ?? "there";
  const displayPoints = profile?.points ?? 0;
  const displayStreak = profile?.current_streak ?? 0;

  return (
    <PageTransition className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <motion.div variants={slideUp} initial="hidden" animate="show" className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          Welcome back, <span className="text-primary">@{displayName}</span>!
        </h1>
        <p className="text-lg text-muted-foreground">
          You're doing great. You have <strong className="text-foreground">{displayPoints} points</strong>
          {displayStreak > 0 && (
            <> and a <strong className="text-foreground">🔥 {displayStreak}-day streak</strong></>
          )}.
        </p>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">

        {/* Goals - the main idea, so it gets the biggest, most prominent spot */}
        <motion.div variants={slideUp}>
          <Card className="border-primary/20 shadow-md relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> Goals
                </CardTitle>
                <CardDescription>What everyone's working toward, most recent first</CardDescription>
              </div>
              <Link href="/goals" className="shrink-0">
                <Button variant="outline" size="sm" className="group">
                  View more <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentGoals.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center bg-muted/50 rounded-lg">
                  No goals posted yet. Be the first!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recentGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
                    >
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className={`text-white text-xs font-bold ${colorForId(goal.owner_id)}`}>
                          {initialsForUsername(goal.owner?.username ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">@{goal.owner?.username ?? "unknown"}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 ${TERM_BADGE_CLASS[goal.term]}`}>
                            {GOAL_TERM_META[goal.term].label}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm truncate">{goal.title}</p>
                      </div>
                      <div className="shrink-0 text-sm font-bold tabular-nums">{goal.progress}%</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Challenges - second priority */}
        <motion.div variants={slideUp}>
          <Card className="border-secondary/20 shadow-sm relative overflow-hidden bg-gradient-to-br from-secondary/10 via-card to-card">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="w-5 h-5 text-secondary" /> Active Challenges
                </CardTitle>
                <CardDescription>Keep the momentum going</CardDescription>
              </div>
              <Link href="/challenges" className="shrink-0">
                <Button variant="outline" size="sm" className="group">
                  Battle Arena <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {activeChallenges.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                  No active challenges. Want to start one?
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeChallenges.slice(0, 4).map((challenge) => (
                    <div key={challenge.id} className="p-3 bg-muted/50 rounded-xl space-y-2 border border-border/50">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-sm truncate">{challenge.topic}</span>
                        {challenge.reward && <Badge variant="secondary" className="text-[10px] shrink-0">{challenge.reward}</Badge>}
                      </div>
                      <div className="flex items-center justify-between text-sm gap-2">
                        <span className="text-xs text-muted-foreground truncate">@{challenge.creator?.username}</span>
                        <span className="font-medium text-primary shrink-0">{challenge.score_creator} vs {challenge.score_opponent}</span>
                        <span className="text-xs text-muted-foreground truncate">@{challenge.opponent?.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Points - balance, recent activity, gift to others */}
        <motion.div variants={slideUp}>
          <PointsCard />
        </motion.div>

        {/* Hall of Fame + Birthdays - condensed, lowest priority row */}
        <motion.div variants={slideUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-accent/25 to-transparent border-accent/20 shadow-sm hover:-translate-y-1 transition-transform duration-200">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Trophy className="w-4 h-4 text-accent shrink-0" /> Hall of Fame
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">See who's holding the record.</p>
              </div>
              <Link href="/hall-of-fame" className="shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-accent/40 bg-accent/10 text-accent hover:bg-accent/25 hover:text-accent"
                >
                  View
                </Button>
              </Link>
            </CardContent>
          </Card>

          {todayBirthdays.length > 0 ? (
            <Card className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-none shadow-md overflow-hidden relative hover:-translate-y-1 transition-transform duration-200">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjwvc3ZnPg==')] opacity-50" />
              <CardContent className="p-4 flex items-center justify-between gap-3 relative z-10">
                <div className="min-w-0">
                  <h3 className="font-bold flex items-center gap-2 text-sm">
                    <Cake className="w-4 h-4 shrink-0" /> It's @{todayBirthdays[0].username ?? "someone"}'s Birthday!
                  </h3>
                  <p className="text-white/80 text-xs mt-0.5">Send them a message</p>
                </div>
                <Link href="/birthdays" className="shrink-0">
                  <Button size="sm" variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white">
                    Celebrate
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                    <Cake className="w-4 h-4 shrink-0" /> No birthdays today
                  </h3>
                </div>
                <Link href="/birthdays" className="shrink-0">
                  <Button size="sm" variant="outline">View all</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </motion.div>

      </motion.div>
    </PageTransition>
  );
}
