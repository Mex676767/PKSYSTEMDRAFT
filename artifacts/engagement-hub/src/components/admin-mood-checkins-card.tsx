import { useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { localMoodDateKey, MOOD_OPTIONS, useDailyMoodCheckIns, type Mood } from "@/hooks/use-mood-checkins";

const MOOD_EMOJI: Record<Mood, string> = {
  Low: "😞",
  "Not great": "😕",
  Okay: "😐",
  Good: "🙂",
  Great: "😁",
};

export function AdminMoodCheckInsCard() {
  const [date, setDate] = useState(localMoodDateKey);
  const { data, isLoading, isError } = useDailyMoodCheckIns(date);
  const checkIns = data?.checkins ?? [];
  const counts = MOOD_OPTIONS.map((mood) => ({ mood, count: checkIns.filter((checkIn) => checkIn.mood === mood).length }));
  const approvedUsers = data?.eligible_users ?? 0;
  const dateLabel = date === localMoodDateKey() ? "Today" : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "long" });

  return (
    <Card className="border-primary/20">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Heart className="h-5 w-5 text-primary" /> Daily mood check-ins</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mood responses from your team, by day.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Choose a day</span>
            <input type="date" value={date} max={localMoodDateKey()} onChange={(event) => setDate(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{dateLabel}</Badge>
          <span className="text-sm text-muted-foreground">{checkIns.length} of {approvedUsers} team members checked in</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {counts.map(({ mood, count }) => (
            <div key={mood} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <span className="text-xl" aria-hidden="true">{MOOD_EMOJI[mood]}</span>
              <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{mood}</p><p className="font-semibold">{count}</p></div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading check-ins...</div>
        ) : isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Could not load mood check-ins. Make sure the latest database migration is applied.</p>
        ) : checkIns.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {checkIns.map((checkIn) => {
              const displayName = checkIn.username ? `@${checkIn.username}` : checkIn.email ?? "Former team member";
              return (
                <div key={checkIn.user_id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                  <span className="truncate text-sm font-medium">{displayName}</span>
                  <span className="shrink-0 text-sm">{MOOD_EMOJI[checkIn.mood]} {checkIn.mood}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">No one has checked in {dateLabel.toLowerCase()} yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
