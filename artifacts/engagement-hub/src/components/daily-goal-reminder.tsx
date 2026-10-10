import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BellRing, CheckCircle2, Heart, Sparkles, Target } from "lucide-react";
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
import { GOAL_TERM_META, useGoalTermCoverage } from "@/hooks/use-goals";

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasMoodCheckInToday(profileId: string) {
  try {
    const saved = window.localStorage.getItem(`daily-mood-checkin:${profileId}`);
    return saved ? JSON.parse(saved).date === localDateKey() : false;
  } catch {
    return false;
  }
}

export function DailyGoalReminder() {
  const { profile } = useAuth();
  const { data: coverage, isSuccess } = useGoalTermCoverage();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [confirmPostpone, setConfirmPostpone] = useState(false);

  const reminderKey = profile ? `daily-goal-reminder:${profile.id}` : null;

  const finishForToday = () => {
    if (reminderKey) window.localStorage.setItem(reminderKey, localDateKey());
    setConfirmPostpone(false);
    setOpen(false);
    if (profile && !hasMoodCheckInToday(profile.id)) setMoodOpen(true);
  };

  const saveMood = () => {
    if (!profile || !selectedMood) return;
    window.localStorage.setItem(`daily-mood-checkin:${profile.id}`, JSON.stringify({ date: localDateKey(), mood: selectedMood }));
    setMoodOpen(false);
  };

  useEffect(() => {
    if (!profile?.is_approved || !isSuccess) return;

    if (coverage?.complete) {
      setOpen(false);
      setConfirmPostpone(false);
      if (!hasMoodCheckInToday(profile.id)) setMoodOpen(true);
      return;
    }

    const key = `daily-goal-reminder:${profile.id}`;
    const today = localDateKey();
    if (window.localStorage.getItem(key) === today) {
      if (!hasMoodCheckInToday(profile.id)) setMoodOpen(true);
      return;
    }

    if (location !== "/goals") setOpen(true);
  }, [coverage?.complete, isSuccess, location, profile?.id, profile?.is_approved]);

  const missingLabels = coverage?.missing.map((term) => GOAL_TERM_META[term].label) ?? [];
  const missingText = missingLabels.length === 0
    ? ""
    : missingLabels.length === 1
      ? missingLabels[0]
      : `${missingLabels.slice(0, -1).join(", ")} and ${missingLabels.at(-1)}`;

  const goToGoals = () => {
    finishForToday();
    navigate("/goals");
  };

  return (
    <>
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
              {confirmPostpone ? "Remind you tomorrow?" : "Complete your goal plan"}
            </DialogTitle>
            <DialogDescription className="max-w-sm leading-relaxed">
              {confirmPostpone
                ? "This is your second confirmation. The reminder will pause for today and return tomorrow if all three goal terms are not complete."
                : `Add your ${missingText} goal${missingLabels.length === 1 ? "" : "s"}. Personal or career goals both count.`}
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
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setConfirmPostpone(true)}>
                Remind me tomorrow
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={moodOpen && !open} onOpenChange={(next) => next && setMoodOpen(true)}>
      <DialogContent className="sm:max-w-md overflow-hidden border-primary/30 bg-card/95 p-0 shadow-[0_24px_80px_-24px_hsl(var(--primary)/0.45)] [&>button.absolute]:hidden" onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
        <div className="relative overflow-hidden px-6 pb-5 pt-8 text-center">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/20 to-transparent" />
          <DialogHeader className="relative items-center text-center sm:text-center">
            <div className="mb-1 flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary"><Heart className="h-3 w-3" /> Daily check-in</div>
            <div className="my-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-primary-foreground shadow-lg shadow-primary/25"><Heart className="h-8 w-8" /></div>
            <DialogTitle className="text-2xl leading-tight">How is your mood today?</DialogTitle>
            <DialogDescription>Take a moment to check in with yourself.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 border-t border-border/60 bg-muted/20 p-5">
          <div className="grid grid-cols-5 gap-2">
            {[{ emoji: "😞", label: "Low" }, { emoji: "😕", label: "Not great" }, { emoji: "😐", label: "Okay" }, { emoji: "🙂", label: "Good" }, { emoji: "😁", label: "Great" }].map(({ emoji, label }) => (
              <button key={label} type="button" aria-pressed={selectedMood === label} onClick={() => setSelectedMood(label)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors hover:bg-accent ${selectedMood === label ? "border-primary bg-primary/10" : "border-border/60 bg-background/70"}`}>
                <span className="text-2xl" aria-hidden="true">{emoji}</span><span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>
          <Button className="h-11 w-full text-sm font-semibold" disabled={!selectedMood} onClick={saveMood}>Save check-in <CheckCircle2 className="ml-2 h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
