import { useMemo, useState } from "react";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Trophy, UserX, Settings } from "lucide-react";
import { PageTransition } from "@/components/animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DepartmentPodium } from "@/components/hof-podium";
import { useMonthlyPodium, useHofExclusions, useSetHofPodiumExclusion } from "@/hooks/use-hall-of-fame";
import { useAllUsernames } from "@/hooks/use-guinness-records";
import { useAuth } from "@/hooks/use-auth";
import { DEPARTMENTS } from "@/lib/roles";

export default function HallOfFame() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_hof_awards");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const { data: podium = [], isLoading } = useMonthlyPodium(monthStart);

  const isCurrentMonth = isSameMonth(monthStart, new Date());

  const byDepartment = useMemo(() => {
    const map = new Map<string, typeof podium>();
    for (const entry of podium) {
      if (!map.has(entry.department)) map.set(entry.department, []);
      map.get(entry.department)!.push(entry);
    }
    for (const list of map.values()) list.sort((a, b) => a.rank - b.rank);
    return map;
  }, [podium]);

  return (
    <PageTransition className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Badge variant="accent" className="mb-2">✦ Celebrate progress</Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Hall of Fame</h1>
          <p className="text-muted-foreground mt-1">Monthly achievements, celebrated by department.</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && <ManageExclusionsDialog />}
          <div className="flex items-center gap-2 bg-muted/50 rounded-full p-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={() => setMonthStart((m) => startOfMonth(addMonths(m, -1)))}
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[9rem] text-center">{format(monthStart, "MMMM yyyy")}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full disabled:opacity-30"
              onClick={() => setMonthStart((m) => startOfMonth(addMonths(m, 1)))}
              disabled={isCurrentMonth}
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Department">
        {DEPARTMENTS.map(dept => <Button key={dept} variant={department === dept ? "default" : "outline"} aria-pressed={department === dept} onClick={() => setDepartment(dept)} className="rounded-full">{dept}</Button>)}
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading monthly achievements…</div>
      ) : (
        <DepartmentPodium department={department} monthLabel={format(monthStart, "MMMM yyyy")} entries={byDepartment.get(department) ?? []} />
      )}
      {!isLoading && podium.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
          <Trophy className="w-4 h-4" /> No one earned points company-wide in {format(monthStart, "MMMM yyyy")}.
        </div>
      )}
    </PageTransition>
  );
}

function ManageExclusionsDialog() {
  const { data: users = [] } = useAllUsernames();
  const { data: excluded = [] } = useHofExclusions();
  const setExclusion = useSetHofPodiumExclusion();
  const excludedIds = new Set(excluded.map((e) => e.user_id));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9">
          <Settings className="w-3.5 h-3.5 mr-1.5" /> Exclusions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserX className="w-4 h-4" /> Podium Exclusions</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Excluded people never appear on the monthly podium (e.g. managers who shouldn't compete against their own team).
        </p>
        <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
          {users.map((u) => {
            const isExcluded = excludedIds.has(u.id);
            return (
              <div key={u.id} className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted/50">
                <span className="truncate">@{u.username}</span>
                <Button
                  size="sm"
                  variant={isExcluded ? "destructive" : "outline"}
                  className="h-7 text-xs shrink-0"
                  disabled={setExclusion.isPending}
                  onClick={() => setExclusion.mutate({ userId: u.id, excluded: !isExcluded })}
                >
                  {isExcluded ? "Excluded" : "Exclude"}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

