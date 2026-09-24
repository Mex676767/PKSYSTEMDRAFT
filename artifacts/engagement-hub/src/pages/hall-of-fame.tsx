import { useState } from "react";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/animations";
import { Button } from "@/components/ui/button";
import { DepartmentPodium } from "@/components/hof-podium";
import { AwardEditPanel } from "@/components/hof-edit-panel";
import { useAwardCategories, useAwardWinners } from "@/hooks/use-hall-of-fame";
import { useAuth } from "@/hooks/use-auth";
import { DEPARTMENTS } from "@/lib/roles";
import { getErrorMessage } from "@/lib/utils";

export default function HallOfFame() {
  const { hasPermission } = useAuth();
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const monthKey = format(month, "yyyy-MM-01");
  const categories = useAwardCategories(department);
  const winners = useAwardWinners(monthKey);
  const error = categories.error ?? winners.error;
  return (
    <PageTransition className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-bold mb-2">
            ✦ Celebrate progress
          </p>
          <h1 className="text-3xl md:text-4xl font-bold">Hall of Fame</h1>
          <p className="text-muted-foreground mt-2">
            Team achievements, chosen and celebrated by your administrators.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission("manage_hof_awards") && (
            <AwardEditPanel
              key={`${department}-${monthKey}`}
              department={department}
              month={monthKey}
              categories={categories.data ?? []}
              winners={winners.data ?? []}
              ready={!categories.isLoading && !winners.isLoading && !error}
            />
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => setMonth((m) => startOfMonth(addMonths(m, -1)))}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold">
            {format(month, "MMMM yyyy")}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next month"
            disabled={isSameMonth(month, new Date())}
            onClick={() => setMonth((m) => startOfMonth(addMonths(m, 1)))}
          >
            <ChevronRight />
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Team">
        {DEPARTMENTS.map((team) => (
          <Button
            key={team}
            className="rounded-full"
            variant={team === department ? "default" : "outline"}
            aria-pressed={team === department}
            onClick={() => setDepartment(team)}
          >
            {team}
          </Button>
        ))}
      </div>
      {error ? (
        <div role="alert" className="rounded-xl border p-5 space-y-2">
          <p className="text-destructive">
            Unable to load Hall of Fame: {getErrorMessage(error)}
          </p>
          {hasPermission("manage_hof_awards") && (
            <p className="text-sm">
              If this is the first setup, run migration 0017 in Supabase SQL
              Editor, then reload.
            </p>
          )}
        </div>
      ) : categories.isLoading || winners.isLoading ? (
        <p>Loading awards…</p>
      ) : categories.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No categories for {department} yet.
          {hasPermission("manage_hof_awards")
            ? " Use Edit Hall of Fame to add one."
            : " Check back after your team publishes its awards."}
        </div>
      ) : (
        categories.data?.map((category) => (
          <DepartmentPodium
            key={category.id}
            department={`${department} · ${category.name}`}
            monthLabel={format(month, "MMMM yyyy")}
            entries={(winners.data ?? [])
              .filter((w) => w.category_id === category.id)
              .map((w) => ({
                rank: w.rank,
                user_id: w.user_id,
                achievement: w.achievement,
                username: w.holder?.username ?? null,
                avatar_url: w.holder?.avatar_url ?? null,
                active_border: w.holder?.active_border ?? null,
              }))}
          />
        ))
      )}
    </PageTransition>
  );
}
