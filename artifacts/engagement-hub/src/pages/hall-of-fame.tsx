import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEmployees } from "@/hooks/use-mock-api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Medal, Trophy, Star } from "lucide-react";

export default function HallOfFame() {
  const { data: employees = [], isLoading } = useEmployees();

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-accent/20" /></div>;

  const topThree = employees.slice(0, 3);
  const rest = employees.slice(3);

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-12">
      <div className="text-center space-y-2">
        <Badge variant="accent" className="mb-2">🏆 Leaderboard</Badge>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Hall of Fame</h1>
        <p className="text-muted-foreground">The legends walking among us.</p>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-2 md:gap-6 pt-10 h-64">
        {/* 2nd Place */}
        {topThree[1] && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center relative w-1/3 max-w-[120px]"
          >
            <div className="absolute -top-12 z-10">
              <Avatar className="w-16 h-16 md:w-20 md:h-20 border-4 border-slate-300 shadow-lg">
                <AvatarFallback className={cn("text-xl text-white font-bold", topThree[1].color)}>{topThree[1].initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-slate-300 text-slate-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm border-2 border-background shadow-sm">2</div>
            </div>
            <div className="w-full h-24 md:h-32 bg-gradient-to-t from-slate-200 to-slate-100 rounded-t-lg border border-b-0 border-slate-300 flex flex-col justify-end items-center pb-4">
              <span className="font-bold text-sm md:text-base truncate w-full text-center px-2">{topThree[1].name.split(' ')[0]}</span>
              <span className="text-xs font-semibold text-slate-600">{topThree[1].points} pts</span>
            </div>
          </motion.div>
        )}

        {/* 1st Place */}
        {topThree[0] && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col items-center relative z-10 w-1/3 max-w-[140px]"
          >
            <div className="absolute -top-16">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400">
                <Trophy className="w-8 h-8 fill-current drop-shadow-md" />
              </div>
              <Avatar className="w-20 h-20 md:w-24 md:h-24 border-4 border-yellow-400 shadow-xl">
                <AvatarFallback className={cn("text-2xl text-white font-bold", topThree[0].color)}>{topThree[0].initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm border-2 border-background shadow-sm">1</div>
            </div>
            <div className="w-full h-32 md:h-40 bg-gradient-to-t from-yellow-200 to-yellow-100 rounded-t-lg border border-b-0 border-yellow-400 flex flex-col justify-end items-center pb-6 shadow-[0_-10px_20px_rgba(250,204,21,0.2)]">
              <span className="font-bold text-base md:text-lg truncate w-full text-center px-2">{topThree[0].name.split(' ')[0]}</span>
              <span className="text-sm font-bold text-yellow-700">{topThree[0].points} pts</span>
            </div>
          </motion.div>
        )}

        {/* 3rd Place */}
        {topThree[2] && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center relative w-1/3 max-w-[120px]"
          >
            <div className="absolute -top-12 z-10">
              <Avatar className="w-16 h-16 md:w-20 md:h-20 border-4 border-amber-600 shadow-lg">
                <AvatarFallback className={cn("text-xl text-white font-bold", topThree[2].color)}>{topThree[2].initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm border-2 border-background shadow-sm">3</div>
            </div>
            <div className="w-full h-20 md:h-24 bg-gradient-to-t from-amber-200/50 to-amber-100/50 rounded-t-lg border border-b-0 border-amber-600/30 flex flex-col justify-end items-center pb-2">
              <span className="font-bold text-sm md:text-base truncate w-full text-center px-2">{topThree[2].name.split(' ')[0]}</span>
              <span className="text-xs font-semibold text-amber-800">{topThree[2].points} pts</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 bg-muted/30 border-b font-semibold text-sm text-muted-foreground flex justify-between">
          <span>Rank</span>
          <span>Score</span>
        </div>
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="divide-y">
          {employees.map((emp, i) => (
            <motion.div variants={slideUp} key={emp.id} className="p-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
              <div className="w-8 text-center font-bold text-muted-foreground">
                {i + 1}
              </div>
              <Avatar className="w-10 h-10 border">
                <AvatarFallback className={cn("text-white font-bold", emp.color)}>{emp.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{emp.name}</div>
                <div className="text-xs text-muted-foreground truncate">{emp.role}</div>
              </div>
              
              <div className="flex gap-1 hidden md:flex">
                {emp.badges.map(b => (
                  <Badge key={b} variant="outline" className="text-[10px] bg-background">
                    <Star className="w-3 h-3 mr-1 text-accent" /> {b}
                  </Badge>
                ))}
              </div>

              <div className="font-bold tabular-nums text-right w-16">
                {emp.points}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </PageTransition>
  );
}