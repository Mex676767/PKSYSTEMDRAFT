import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useBirthdays, type BirthdayEntry } from "@/hooks/use-birthdays";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Cake, CalendarHeart, Gift, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Confetti } from "@/components/confetti";
import { useToast } from "@/hooks/use-toast";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { useComments } from "@/hooks/use-social";

// Displayed birthday date is month/day only, so any year works for formatting.
function displayDate(birthday: string) {
  const [, month, day] = birthday.split("-").map(Number);
  return new Date(2000, month - 1, day);
}

export default function Birthdays() {
  const { data: birthdays = [], isLoading } = useBirthdays();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showConfetti, setShowConfetti] = useState(false);

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-pink-500/20" /></div>;

  const todayBdays = birthdays.filter((b) => b.isToday);
  const upcomingBdays = birthdays.filter((b) => !b.isToday);

  const handleCelebrate = (name: string) => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    toast({
      title: "Wishes sent!",
      description: `You sent birthday wishes to @${name}.`,
    });
  };

  return (
    <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <Confetti active={showConfetti} />

      <div className="flex items-center gap-3 mb-8">
        <div className="bg-secondary/15 text-secondary p-3 rounded-2xl">
          <CalendarHeart className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Birthdays</h1>
          <p className="text-muted-foreground">Celebrate your teammates' special days.</p>
        </div>
      </div>

      {todayBdays.length > 0 && (
        <div className="space-y-4 mb-12">
          <h2 className="text-xl font-bold flex items-center gap-2 text-secondary">
            <Cake className="w-5 h-5" /> Today
          </h2>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4">
            {todayBdays.map((b) => (
              <motion.div variants={slideUp} key={b.id}>
                <TodayBirthdayCard birthday={b} isMe={b.id === profile?.id} onCelebrate={handleCelebrate} />
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
          {upcomingBdays.map((b) => (
            <motion.div variants={slideUp} whileHover={{ y: -2 }} key={b.id}>
              <Card className="hover:border-secondary/40 hover:shadow-md transition-all bg-gradient-to-br from-secondary/10 to-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-xl w-14 h-14 shrink-0 text-center shadow-sm">
                      <span className="text-xs font-bold uppercase opacity-90">{format(displayDate(b.birthday), "MMM")}</span>
                      <span className="text-lg font-black leading-none">{format(displayDate(b.birthday), "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">@{b.username ?? "unknown"}</p>
                      <p className="text-sm text-muted-foreground truncate">{b.department ?? ""}</p>
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
              No upcoming birthdays on record yet.
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
  birthday: BirthdayEntry;
  isMe: boolean;
  onCelebrate: (username: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const { data: comments = [] } = useComments("birthday", birthday.id);
  const username = birthday.username ?? "unknown";

  return (
    <Card className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-none shadow-lg overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjwvc3ZnPg==')] opacity-30" />
      <CardContent className="p-6 md:p-8 relative z-10 space-y-5">
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <UserAvatar
            user={{ name: username, initials: initialsForUsername(username), color: colorForId(birthday.id) }}
            className="w-24 h-24 text-3xl border-4 border-white/20 shadow-xl"
          />
          <div className="flex-1">
            <p className="text-white/80 font-medium uppercase tracking-widest text-sm mb-1">Happy Birthday</p>
            <h3 className="text-3xl font-bold mb-2">@{username}</h3>
            {birthday.department && <p className="text-white/90">{birthday.department}</p>}
          </div>
          {!isMe && (
            <Button onClick={() => onCelebrate(username)} size="lg" className="bg-white text-pink-600 hover:bg-white/90 rounded-full w-full md:w-auto mt-4 md:mt-0 shadow-xl">
              <Gift className="w-5 h-5 mr-2" /> Send Wishes
            </Button>
          )}
        </div>

        <div className="pt-4 border-t border-white/20 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <ReactionBar targetType="birthday" targetId={birthday.id} onDark />
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
              <CommentSection targetType="birthday" targetId={birthday.id} onDark />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
