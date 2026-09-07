import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBirthdays, useCurrentUser } from "@/hooks/use-mock-api";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { motion } from "framer-motion";
import { Cake, CalendarHeart, Gift, Send, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Confetti } from "@/components/confetti";
import { useToast } from "@/hooks/use-toast";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { useComments } from "@/hooks/use-social";

export default function Birthdays() {
  const { data: birthdays = [], isLoading } = useBirthdays();
  const { data: me } = useCurrentUser();
  const { toast } = useToast();
  const [showConfetti, setShowConfetti] = useState(false);

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-pink-500/20" /></div>;

  const todayBdays = birthdays.filter(b => b.isToday);
  const upcomingBdays = birthdays.filter(b => !b.isToday && !isPast(new Date(b.date)));

  const handleCelebrate = (name: string) => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    toast({
      title: "Wishes sent!",
      description: `You sent birthday wishes to ${name}.`,
    });
  };

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <Confetti active={showConfetti} />
      
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-pink-100 text-pink-600 p-3 rounded-2xl">
          <CalendarHeart className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Birthdays</h1>
          <p className="text-muted-foreground">Celebrate your teammates' special days.</p>
        </div>
      </div>

      {todayBdays.length > 0 && (
        <div className="space-y-4 mb-12">
          <h2 className="text-xl font-bold flex items-center gap-2 text-pink-600">
            <Cake className="w-5 h-5" /> Today
          </h2>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4">
            {todayBdays.map(b => (
              <motion.div variants={slideUp} key={b.id}>
                <TodayBirthdayCard birthday={b} isMe={b.employee.id === me?.id} onCelebrate={handleCelebrate} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
           Upcoming
        </h2>
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingBdays.map(b => (
            <motion.div variants={slideUp} whileHover={{ y: -2 }} key={b.id}>
              <Card className="hover:border-pink-300 hover:shadow-md transition-all bg-gradient-to-br from-pink-50 to-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-xl w-14 h-14 shrink-0 text-center shadow-sm">
                      <span className="text-xs font-bold uppercase opacity-90">{format(new Date(b.date), 'MMM')}</span>
                      <span className="text-lg font-black leading-none">{format(new Date(b.date), 'd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{b.employee.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{b.employee.department}</p>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-border/50">
                    <ReactionBar targetType="birthday" targetId={b.id} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {upcomingBdays.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No upcoming birthdays this month.
            </div>
          )}
        </motion.div>
      </div>

    </PageTransition>
  );
}

function TodayBirthdayCard({
  birthday,
  isMe,
  onCelebrate,
}: {
  birthday: { id: string; employee: { id: string; name: string; role: string; color: string; initials: string } };
  isMe: boolean;
  onCelebrate: (name: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const { data: comments = [] } = useComments("birthday", birthday.id);
  const { employee } = birthday;

  return (
    <Card className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-none shadow-lg overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjwvc3ZnPg==')] opacity-30" />
      <CardContent className="p-6 md:p-8 relative z-10 space-y-5">
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <Avatar className="w-24 h-24 border-4 border-white/20 shadow-xl">
            <AvatarFallback className={cn("text-3xl text-white font-bold", employee.color)}>{employee.initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-white/80 font-medium uppercase tracking-widest text-sm mb-1">Happy Birthday</p>
            <h3 className="text-3xl font-bold mb-2">{employee.name}</h3>
            <p className="text-white/90">{employee.role}</p>
          </div>
          {!isMe && (
            <Button onClick={() => onCelebrate(employee.name)} size="lg" className="bg-white text-pink-600 hover:bg-white/90 rounded-full w-full md:w-auto mt-4 md:mt-0 shadow-xl">
              <Gift className="w-5 h-5 mr-2" /> Send Wishes
            </Button>
          )}
        </div>

        <div className="pt-4 border-t border-white/20 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <ReactionBar targetType="birthday" targetId={birthday.id} />
            <button
              onClick={() => setShowComments((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comment"}
              {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {showComments && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <CommentSection targetType="birthday" targetId={birthday.id} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}