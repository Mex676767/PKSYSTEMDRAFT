import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMentors } from "@/hooks/use-mock-api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Mentors() {
  const { data: mentors = [], isLoading } = useMentors();
  const [filter, setFilter] = useState<'all' | 'active' | 'graduated'>('active');

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;

  const filtered = mentors.filter(m => filter === 'all' || m.status === filter);

  return (
    <PageTransition className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Mentorship Network</h1>
        <p className="text-lg text-muted-foreground">Learn from the best. Grow together.</p>
      </div>

      <div className="flex justify-center gap-2">
        <Button variant={filter === 'active' ? 'default' : 'outline'} onClick={() => setFilter('active')} className="rounded-full">Active Pairs</Button>
        <Button variant={filter === 'graduated' ? 'default' : 'outline'} onClick={() => setFilter('graduated')} className="rounded-full">Alumni</Button>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {filtered.map(pairing => (
          <motion.div variants={slideUp} key={pairing.id}>
            <Card className={cn(
              "h-full hover:-translate-y-1 transition-transform duration-300 shadow-sm hover:shadow-md border-t-4 bg-gradient-to-b to-card",
              pairing.status === 'active' ? "border-t-primary from-primary/10" : "border-t-secondary from-secondary/10"
            )}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <Badge variant={pairing.status === 'active' ? 'default' : 'secondary'} className={cn("text-[10px] uppercase", pairing.status === 'active' ? "bg-emerald-500 hover:bg-emerald-600" : "")}>
                    {pairing.status}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">{pairing.department}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  {/* Mentor */}
                  <div className="flex flex-col items-center flex-1 text-center">
                    <Avatar className="w-14 h-14 border-2 border-primary/20 mb-2">
                      <AvatarFallback className={cn("text-white font-bold", pairing.mentor.color)}>{pairing.mentor.initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-sm leading-tight">{pairing.mentor.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Mentor</span>
                  </div>

                  {/* Connector */}
                  <div className="px-2 text-muted-foreground/30 flex flex-col items-center">
                    <ArrowRight className="w-5 h-5 mb-1" />
                    {pairing.status === 'graduated' && <GraduationCap className="w-4 h-4 text-secondary" />}
                  </div>

                  {/* Mentee */}
                  <div className="flex flex-col items-center flex-1 text-center">
                    <Avatar className="w-14 h-14 border-2 border-border mb-2">
                      <AvatarFallback className={cn("text-white font-bold", pairing.mentee.color)}>{pairing.mentee.initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-sm leading-tight">{pairing.mentee.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Mentee</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No pairings found for this filter.
        </div>
      )}
    </PageTransition>
  );
}