import { useEffect, useMemo, useState } from "react";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { PageTransition } from "@/components/animations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DepartmentPodium } from "@/components/hof-podium";
import { AwardEditPanel } from "@/components/hof-edit-panel";
import {
  useAwardCategories,
  useAwardWinners,
  useHofDepartmentVisibility,
  useSetHofDepartmentVisibility,
} from "@/hooks/use-hall-of-fame";
import { useAuth } from "@/hooks/use-auth";

import { getErrorMessage } from "@/lib/utils";
import { useOrgStructure } from "@/hooks/use-org-structure";

export default function HallOfFame() {
  const { departments } = useOrgStructure();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_hof_awards");
  const visibility = useHofDepartmentVisibility();
  const setVisibility = useSetHofDepartmentVisibility();
  const hiddenDepartments = useMemo(
    () => new Set((visibility.data?.departments ?? []).filter((item) => !item.show_in_hall_of_fame).map((item) => item.name)),
    [visibility.data?.departments],
  );
  const visibleDepartments = useMemo(
    () => departments.filter((name) => !hiddenDepartments.has(name)),
    [departments, hiddenDepartments],
  );
  const [department, setDepartment] = useState<string>(departments[0] ?? "");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const monthKey = format(month, "yyyy-MM-01");
  const categories = useAwardCategories(department);
  const winners = useAwardWinners(monthKey);
  const error = categories.error ?? winners.error ?? visibility.error;

  useEffect(() => {
    if (!visibleDepartments.includes(department)) {
      setDepartment(visibleDepartments[0] ?? "");
    }
  }, [department, visibleDepartments]);
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
          {canManage && (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Eye className="w-4 h-4 mr-2" /> Department visibility
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Hall of Fame departments</DialogTitle>
                    <DialogDescription>
                      Choose which departments appear in the Hall of Fame. Hidden departments keep their awards and can be restored anytime.
                    </DialogDescription>
                  </DialogHeader>
                  {!visibility.isLoading && !visibility.data?.configured && (
                    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                      Run migration 0050 in Supabase to enable these controls.
                    </p>
                  )}
                  <div className="space-y-2">
                    {departments.map((team) => {
                      const visible = !hiddenDepartments.has(team);
                      return (
                        <div key={team} className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
                          <div>
                            <p className="font-medium">{team}</p>
                            <p className="text-xs text-muted-foreground">{visible ? "Shown" : "Hidden"}</p>
                          </div>
                          <Switch
                            checked={visible}
                            aria-label={`Show ${team} in Hall of Fame`}
                            disabled={visibility.isLoading || !visibility.data?.configured || setVisibility.isPending}
                            onCheckedChange={(checked) => setVisibility.mutate({ department: team, visible: checked })}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {setVisibility.error && (
                    <p role="alert" className="text-sm text-destructive">Unable to update visibility: {getErrorMessage(setVisibility.error)}</p>
                  )}
                </DialogContent>
              </Dialog>
              {department && (
                <AwardEditPanel
                  key={`${department}-${monthKey}`}
                  department={department}
                  month={monthKey}
                  categories={categories.data ?? []}
                  winners={winners.data ?? []}
                  ready={!categories.isLoading && !winners.isLoading && !error}
                />
              )}
            </>
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
        {visibleDepartments.map((team) => (
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
          {canManage && (
            <p className="text-sm">
              If this is the first setup, run migration 0017 in Supabase SQL
              Editor, then reload.
            </p>
          )}
        </div>
      ) : visibleDepartments.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No departments are currently shown in the Hall of Fame.
          {canManage ? " Use Department visibility to restore one." : " Check back later."}
        </div>
      ) : categories.isLoading || winners.isLoading ? (
        <p>Loading awards…</p>
      ) : categories.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No categories for {department} yet.
          {canManage
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
                active_accessory: w.holder?.active_accessory ?? null,
              }))}
          />
        ))
      )}
    </PageTransition>
  );
}
