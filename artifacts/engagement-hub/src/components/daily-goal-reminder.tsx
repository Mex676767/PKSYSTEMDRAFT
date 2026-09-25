import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BellRing, CheckCircle2, Sparkles, Target } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useHasAnyGoal } from "@/hooks/use-goals";

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DailyGoalReminder() {
  const { profile } = useAuth();
  const { data: hasGoal, isSuccess, isFetching, refetch } = useHasAnyGoal();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [confirmPostpone, setConfirmPostpone] = useState(false);

  const reminderKey = profile ? `daily-goal-reminder:${profile.id}` : null;

  const finishForToday = () => {
    if (reminderKey) window.localStorage.setItem(reminderKey, localDateKey());
    setConfirmPostpone(false);
    setOpen(false);
  };

  useEffect(() => {
    if (!profile?.is_approved || !isSuccess) return;

    if (hasGoal) {
      setOpen(false);
      setConfirmPostpone(false);
      return;
    }

    const key = `daily-goal-reminder:${profile.id}`;
    const today = localDateKey();
    if (window.localStorage.getItem(key) === today) return;

    if (location !== "/goals") setOpen(true);
  }, [hasGoal, isSuccess, location, profile?.id, profile?.is_approved]);

  const goToGoals = () => {
    finishForToday();
    navigate("/goals");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => next && setOpen(true)}>
      <DialogContent
        className="sm:max-w-md overflow-hidden border-primary/30 bg-card/95 p-0 shadow-[0_24px_80px_-24px_hsl(var(--primary)/0.6)] [&>button.absolute]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="relative overflow-hidden px-6 pb-5 pt-8 text-center">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/20 to-transparent" />
          <div className="absolute -left-8 top-5 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <div className="absolute -right-8 top-3 h-28 w-28 rounded-full bg-orange-400/15 blur-2xl" />

          <DialogHeader className="relative items-center text-center sm:text-center">
            <div className="mb-1 flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3 w-3" /> Daily goal check-in
            </div>
            <div className="my-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-orange-400 text-primary-foreground shadow-lg shadow-primary/25">
              {confirmPostpone ? <BellRing className="h-8 w-8" /> : <Target className="h-8 w-8" />}
            </div>
            <DialogTitle className="text-2xl leading-tight">
              {confirmPostpone ? "Remind you tomorrow?" : "What are you working toward?"}
            </DialogTitle>
            <DialogDescription className="max-w-sm leading-relaxed">
              {confirmPostpone
                ? "This is your second confirmation. The reminder will pause for today and return tomorrow if you still have no goal."
                : "We could not find a goal on your profile. Add one so your progress stays visible and your team can support you."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="border-t border-border/60 bg-muted/20 p-5">
          {confirmPostpone ? (
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button variant="outline" onClick={() => setConfirmPostpone(false)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Go back
              </Button>
              <Button variant="secondary" onClick={finishForToday}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Yes, remind me tomorrow
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-3">
              <Button className="h-11 w-full text-sm font-semibold" onClick={goToGoals}>
                Add my goal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex flex-col-reverse items-center justify-between gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {isFetching ? "Checking..." : "I already added one — check again"}
                </button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmPostpone(true)}>
                  Remind me tomorrow
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
