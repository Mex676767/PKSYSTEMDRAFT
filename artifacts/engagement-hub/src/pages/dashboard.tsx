import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChallenges, useBirthdays } from "@/hooks/use-mock-api";
import { useMyGoals } from "@/hooks/use-goals";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Flame, Target, Trophy, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { profile } = useAuth();
  const { data: goals = [] } = useMyGoals();
  const { data: challenges = [] } = useChallenges();
  const { data: birthdays = [] } = useBirthdays();

  const activeGoals = goals.filter(g => !g.completed);
  const activeChallenges = challenges.filter(c => c.status === 'active');
  const todayBirthdays = birthdays.filter(b => b.isToday);

  // Falls back to a generic greeting when there's no real logged-in profile
  // (e.g. while login is temporarily disabled for testing).
  const displayName = profile?.username ?? "there";
  const displayPoints = profile?.points ?? 0;
  const displayBadges = profile?.badges.length ?? 0;

  return (
    <PageTransition className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <motion.div variants={slideUp} initial="hidden" animate="show" className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          Welcome back, <span className="text-primary">@{displayName}</span>!
        </h1>
        <p className="text-lg text-muted-foreground">
          You're doing great. You have <strong className="text-foreground">{displayPoints} points</strong> and {displayBadges} badges.
        </p>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Goals Summary */}
        <motion.div variants={slideUp} whileHover={{ y: -4 }}>
          <Card className="h-full border-primary/20 shadow-md relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Target className="w-24 h-24 text-primary" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Current Goals
              </CardTitle>
              <CardDescription>{activeGoals.length} goals in progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeGoals.slice(0, 2).map(goal => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="truncate pr-2">{goal.title}</span>
                    <span>{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>
              ))}
              {activeGoals.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                  All caught up! Time to set a new goal.
                </div>
              )}
              <Link href="/goals" className="block mt-4">
                <Button variant="outline" className="w-full group">
                  View all goals <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Challenges Summary */}
        <motion.div variants={slideUp} whileHover={{ y: -4 }}>
          <Card className="h-full border-secondary/20 shadow-md relative overflow-hidden bg-gradient-to-br from-secondary/10 via-card to-card">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Flame className="w-24 h-24 text-secondary" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-secondary" /> Active Challenges
              </CardTitle>
              <CardDescription>Keep the momentum going</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeChallenges.slice(0, 2).map(challenge => (
                <div key={challenge.id} className="p-3 bg-muted/50 rounded-xl space-y-2 border border-border/50">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm truncate">{challenge.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{challenge.reward} pts</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-primary">{challenge.scoreA}</span>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">vs</span>
                    <span className="font-medium text-destructive">{challenge.scoreB}</span>
                  </div>
                </div>
              ))}
              {activeChallenges.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                  No active challenges. Want to start one?
                </div>
              )}
              <Link href="/challenges" className="block mt-4">
                <Button variant="outline" className="w-full group">
                  Battle Arena <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Highlights */}
        <motion.div variants={slideUp} className="flex flex-col gap-6">
          <Card className="flex-1 bg-gradient-to-br from-accent/25 to-transparent border-accent/20 shadow-md hover:-translate-y-1 transition-transform duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-accent-foreground" /> Hall of Fame
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Every category has a champion. See who's holding the record.</p>
              <Link href="/hall-of-fame" className="block">
                <Button variant="secondary" className="w-full shadow-none bg-background hover:bg-background/80">
                  View Record Book
                </Button>
              </Link>
            </CardContent>
          </Card>

          {todayBirthdays.length > 0 && (
            <Card className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-none shadow-lg overflow-hidden relative hover:-translate-y-1 transition-transform duration-200">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjwvc3ZnPg==')] opacity-50" />
              <CardContent className="p-6 flex items-center justify-between relative z-10">
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    <Cake className="w-5 h-5" /> It's {todayBirthdays[0].employee.name.split(' ')[0]}'s Birthday!
                  </h3>
                  <p className="text-white/80 text-sm mt-1">Send them a message</p>
                </div>
                <Link href="/birthdays">
                  <Button size="sm" variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white">
                    Celebrate
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </motion.div>

      </motion.div>
    </PageTransition>
  );
}
