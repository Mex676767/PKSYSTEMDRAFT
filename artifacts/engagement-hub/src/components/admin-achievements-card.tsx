import { useState } from "react";
import { Trophy, Plus, Pencil, Trash2, X, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/searchable-select";
import { personOption } from "@/components/person-option";
import {
  useAchievementHolders,
  useAchievements,
  useDeleteAchievement,
  useSaveAchievement,
  useSetAchievement,
  type Achievement,
} from "@/hooks/use-achievements";
import { getErrorMessage } from "@/lib/utils";

/** Admin: create achievements and give / take them away. They never give points. */
export function AdminAchievementsCard() {
  const { achievements, managed } = useAchievements();
  const { data: people = [] } = useAchievementHolders(managed);
  const setAchievement = useSetAchievement();
  const remove = useDeleteAchievement();
  const [editing, setEditing] = useState<Partial<Achievement> | null>(null);
  const [giveTo, setGiveTo] = useState<Record<string, string>>({});

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Achievements</h2>
            <p className="text-xs text-muted-foreground">
              Shown as titles on profiles. Built-in ones still unlock automatically. None of them give points; points only
              come from missions and admin adjustments.
            </p>
          </div>
          {managed && (
            <Button size="sm" className="shrink-0" onClick={() => setEditing({ label: "", description: "" })}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          )}
        </div>

        {!managed ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
            Run migration <code>0029_achievements</code> in Supabase to manage achievements here.
          </p>
        ) : (
          <div className="space-y-2">
            {(setAchievement.error || remove.error) && (
              <p className="text-xs text-destructive">{getErrorMessage(setAchievement.error ?? remove.error)}</p>
            )}
            {achievements.map((a) => {
              const holders = people.filter((p) => p.unlocked_titles?.includes(a.key));
              const candidates = people.filter((p) => !p.unlocked_titles?.includes(a.key));
              return (
                <details key={a.key} className="rounded-xl border border-border group">
                  <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none">
                    <span className="flex-1 min-w-0">
                      <span className="text-sm font-semibold">{a.label}</span>
                      {a.builtin && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Built-in</span>}
                      {a.description && <span className="block text-xs text-muted-foreground truncate">{a.description}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{holders.length} {holders.length === 1 ? "person" : "people"}</span>
                    <button type="button" onClick={(e) => { e.preventDefault(); setEditing(a); }} className="p-1.5 rounded-md hover:bg-muted" title="Edit"><Pencil className="w-4 h-4" /></button>
                    {!a.builtin && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${a.label}"? It's removed from everyone who has it.`)) remove.mutate(a.key); }}
                        className="p-1.5 rounded-md hover:bg-muted text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </summary>
                  <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                    <div className="flex gap-2">
                      <SearchableSelect
                        value={giveTo[a.key] ?? ""}
                        onValueChange={(v) => setGiveTo((g) => ({ ...g, [a.key]: v }))}
                        options={candidates.map(personOption)}
                        placeholder="Give to..."
                        searchPlaceholder="Search people..."
                        emptyText="Everyone has it already"
                        aria-label={`Give ${a.label} to`}
                      />
                      <Button
                        size="sm"
                        className="h-10 shrink-0"
                        disabled={!giveTo[a.key] || setAchievement.isPending}
                        onClick={() =>
                          setAchievement.mutate(
                            { userId: giveTo[a.key], key: a.key, hasIt: true },
                            { onSuccess: () => setGiveTo((g) => ({ ...g, [a.key]: "" })) }
                          )
                        }
                      >
                        <Gift className="w-3.5 h-3.5 mr-1" /> Give
                      </Button>
                    </div>
                    {holders.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nobody has this yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {holders.map((p) => (
                          <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                            @{p.username}
                            <button
                              type="button"
                              title={`Take away from @${p.username}`}
                              disabled={setAchievement.isPending}
                              onClick={() => { if (confirm(`Take "${a.label}" away from @${p.username}?`)) setAchievement.mutate({ userId: p.id, key: a.key, hasIt: false }); }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
        {editing && <AchievementDialog value={editing} onClose={() => setEditing(null)} />}
      </CardContent>
    </Card>
  );
}

function AchievementDialog({ value, onClose }: { value: Partial<Achievement>; onClose: () => void }) {
  const save = useSaveAchievement();
  const [label, setLabel] = useState(value.label ?? "");
  const [description, setDescription] = useState(value.description ?? "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{value.key ? "Edit achievement" : "New achievement"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ach-label">Name</Label>
            <Input id="ach-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="e.g. Team Spirit" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ach-desc">What it's for <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="ach-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="e.g. Always jumps in to help" />
          </div>
          {save.error && <p className="text-xs text-destructive">{getErrorMessage(save.error)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!label.trim() || save.isPending}
            onClick={() => save.mutate({ key: value.key, label, description }, { onSuccess: onClose })}
          >
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
