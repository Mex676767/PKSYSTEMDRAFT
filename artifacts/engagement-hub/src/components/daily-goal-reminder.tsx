import { useEffect, useState } from "react";
import { Target } from "lucide-react";
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
import { useMyGoals } from "@/hooks/use-goals";

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DailyGoalReminder() {
  const { profile } = useAuth();
  const { data: goals, isSuccess } = useMyGoals();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile?.is_approved || !isSuccess || goals.length > 0) return;

    const key = `daily-goal-reminder:${profile.id}`;
    const today = localDateKey();
    if (window.localStorage.getItem(key) === today) return;

    // Visiting Goals already counts as responding to today's reminder.
    window.localStorage.setItem(key, today);
    if (location !== "/goals") setOpen(true);
  }, [goals, isSuccess, location, profile?.id, profile?.is_approved]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md border-primary/25">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">What are you working toward?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            You have not added a goal yet. Add one so your progress stays visible and your team can support you.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>Remind me tomorrow</Button>
          <Button onClick={() => { setOpen(false); navigate("/goals"); }}>Add my goal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
