import { useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useAllUsernames } from "@/hooks/use-guinness-records";
import { useDirectory } from "@/hooks/use-mentors";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import { personOption } from "@/components/person-option";
import {
  useManageAwards,
  useDeletionLogs,
  type AwardCategory,
  type AwardWinner,
  type WinnerInput,
} from "@/hooks/use-hall-of-fame";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from "./ui/dialog";

// Deletion snapshots store people as bare UUIDs; show who they were. Any
// object with a user_id gets "username" right under its "id", and other
// *_id / *_by person keys get a "<key>_username" next to them.
const PERSON_KEYS = new Set(["holder_id", "owner_id", "author_id", "created_by", "deleted_by", "updated_by", "excluded_by", "reviewed_by"]);

function withUsernames(value: unknown, names: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((v) => withUsernames(v, names));
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const nameFor = (id: unknown) => (typeof id === "string" && names.has(id) ? `@${names.get(id)}` : undefined);
  const out: Record<string, unknown> = {};
  const userName = nameFor(obj.user_id);
  if (userName && !("id" in obj)) out.username = userName;
  for (const [k, v] of Object.entries(obj)) {
    out[k] = withUsernames(v, names);
    if (k === "id" && userName) out.username = userName;
    if (PERSON_KEYS.has(k) && nameFor(v)) out[`${k}_username`] = nameFor(v);
  }
  return out;
}

export function DeletionLogs() {
  const { hasPermission } = useAuth();
  const usernames = useAllUsernames();
  const names = new Map((usernames.data ?? []).map((u) => [u.id, u.username]));
  const logs = useDeletionLogs(
    hasPermission("manage_hof_awards") || hasPermission("manage_hall_of_fame"),
  );
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">Deletion logs</h3>
      <p className="text-xs text-muted-foreground">
        Latest 100 deletions, including previous winner selections replaced
        during edits. Logging begins after the database migration.
      </p>
      {logs.isLoading && <p>Loading logs…</p>}
      {logs.error && (
        <p role="alert" className="text-destructive">
          {getErrorMessage(logs.error)}
        </p>
      )}
      {logs.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No deletions recorded.</p>
      )}
      {logs.data?.map((log) => (
        <details key={log.id} className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer break-words">
            {String(
              log.snapshot.category_name ??
                log.snapshot.name ??
                log.snapshot.achievement ??
                "Winner selection",
            ) || "Winner selection"}{" "}
            · {log.deleted_by_name ?? "Database administrator"} ·{" "}
            {format(new Date(log.deleted_at), "dd MMM yyyy, HH:mm")}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {log.entity_type} · {log.entity_id}
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(withUsernames(log.snapshot, names), null, 2)}
          </pre>
        </details>
      ))}
    </section>
  );
}

export function RecordEditPanel() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit / deletion logs</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guinness Records edit panel</DialogTitle>
          <DialogDescription>
            Use Set record to assign a holder. Open a certificate to delete its
            record.
          </DialogDescription>
        </DialogHeader>
        <DeletionLogs />
      </DialogContent>
    </Dialog>
  );
}

function CategoryEditor({
  category,
  month,
  winners,
}: {
  category: AwardCategory;
  month: string;
  winners: AwardWinner[];
}) {
  const people = useDirectory();
  const directory = people.data ?? [];
  const mutation = useManageAwards();
  const [name, setName] = useState(category.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState("");
  const awardType = category.award_type ?? "individual";
  const [draft, setDraft] = useState<{ rank: number; winner_ids: string[]; achievement: string; team_member_ids: string[] }[]>(
    [1, 2, 3].map((rank) => ({
      rank,
      winner_ids: winners.filter((w) => w.rank === rank).map((w) => w.user_id),
      achievement: winners.find((w) => w.rank === rank)?.achievement ?? "",
      team_member_ids: winners.find((w) => w.rank === rank)?.team_member_ids ?? [],
    })),
  );
  // Each department's Hall of Fame only picks from that department. Anyone
  // already saved as a winner stays listed (flagged) even if they've since
  // moved department, so an existing pick never silently disappears.
  const inDepartment = directory.filter((p) => p.username && p.department === category.department);
  const winnerOptions = (index: number): SelectOption[] => {
    const takenElsewhere = new Set(
      draft.filter((_, i) => i !== index).flatMap((w) => [...w.winner_ids, ...w.team_member_ids]).filter(Boolean),
    );
    const currentIds = draft[index].winner_ids;
    const extraIds = currentIds.filter((id) => !inDepartment.some((p) => p.id === id));
    const extra = directory
      .filter((person) => extraIds.includes(person.id))
      .map((person) => ({ ...personOption(person), description: `Already selected · not in ${category.department}` }));
    return [
      ...extra,
      ...inDepartment.map((p) => ({
        ...personOption(p),
        disabled: currentIds.includes(p.id) || takenElsewhere.has(p.id) || (awardType === "team" && currentIds.length > 0),
        description: currentIds.includes(p.id)
          ? (awardType === "team" ? "Podium lead" : "Already tied at this place")
          : takenElsewhere.has(p.id)
            ? "Already assigned to another place"
            : p.role ?? undefined,
      })),
    ];
  };
  const teamMemberOptions = (index: number): SelectOption[] => {
    const current = draft[index];
    const takenElsewhere = new Set(
      draft.flatMap((w, i) => i === index ? [...w.winner_ids] : [...w.winner_ids, ...w.team_member_ids]).filter(Boolean),
    );
    const savedOutsideDepartment = new Set(current.team_member_ids.filter((id) => !inDepartment.some((person) => person.id === id)));
    const extra = directory
      .filter((person) => savedOutsideDepartment.has(person.id))
      .map((person) => ({
        ...personOption(person),
        disabled: true,
        description: `Already listed${person.department ? ` · now in ${person.department}` : ""}`,
      }));
    return [
      ...extra,
      ...inDepartment.map((person) => {
        const alreadySelected = current.team_member_ids.includes(person.id);
        const alreadyAssigned = takenElsewhere.has(person.id);
        return {
          ...personOption(person),
          disabled: alreadySelected || alreadyAssigned || current.winner_ids.length === 0,
          description: alreadySelected
            ? "Already added to this podium"
            : alreadyAssigned
              ? "Already assigned to another place"
              : person.role ?? "Team member",
        };
      }),
    ];
  };
  const assignedIds = draft.flatMap((winner) => [...winner.winner_ids, ...winner.team_member_ids]).filter(Boolean);
  const duplicates = new Set(assignedIds).size !== assignedIds.length;
  const winnerInputs: WinnerInput[] = draft.flatMap((slot) => slot.winner_ids.map((user_id, index) => ({
    rank: slot.rank,
    user_id,
    achievement: slot.achievement,
    team_member_ids: awardType === "team" && index === 0 ? slot.team_member_ids : [],
  })));
  return (
    <section className="border rounded-xl p-4 space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved("");
          mutation.mutate(
            {
              type: "category",
              id: category.id,
              department: category.department,
              name,
              award_type: awardType,
            },
            { onSuccess: () => setSaved("Category updated.") },
          );
        }}
      >
        <Input
          aria-label="Category name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button disabled={mutation.isPending || !name.trim()} variant="outline">
          Rename
        </Button>
      </form>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (duplicates) return;
          setSaved("");
          mutation.mutate(
            {
              type: "winners",
              id: category.id,
              month,
              winners: winnerInputs,
            },
            { onSuccess: () => setSaved("Monthly winners saved.") },
          );
        }}
      >
        <p className="text-sm font-medium">
          {awardType === "team" ? "Team podium leads" : "Individual winners"} for {format(new Date(month + "T12:00:00"), "MMMM yyyy")}
        </p>
        {draft.map((winner, index) => (
          <div key={winner.rank} className="space-y-3 rounded-lg border border-border/70 p-3">
            <label
              className="text-xs font-medium"
              htmlFor={`${category.id}-${index}`}
            >
              Place {winner.rank}
            </label>
            <p className="text-xs text-muted-foreground">
              {awardType === "team" ? "Choose one ATL/TL or team lead for this place." : "Add one or more people; everyone here shares this place."}
            </p>
            <SearchableSelect
              id={`${category.id}-${index}`}
              value=""
              onValueChange={(v) => {
                setSaved("");
                setDraft((rows) =>
                  rows.map((row, i) =>
                    i === index && !row.winner_ids.includes(v)
                      ? { ...row, winner_ids: [...row.winner_ids, v], team_member_ids: awardType === "team" ? row.team_member_ids.filter((id) => id !== v) : row.team_member_ids }
                      : row,
                  ),
                );
              }}
              options={winnerOptions(index)}
              placeholder={awardType === "team" ? (winner.winner_ids.length ? "Lead selected" : "Choose a team lead…") : "Add a tied winner…"}
              searchPlaceholder={`Search ${category.department}...`}
              emptyText={`No one in ${category.department} matches`}
              disabled={people.isLoading || !!people.error || (awardType === "team" && winner.winner_ids.length > 0)}
              aria-label={`${awardType === "team" ? "Lead" : "Winner"} for place ${winner.rank}`}
            />
            {!!winner.winner_ids.length && (
              <ul className="flex flex-wrap gap-2" aria-label={`${awardType === "team" ? "Lead" : "Winners"} for place ${winner.rank}`}>
                {winner.winner_ids.map((winnerId) => {
                  const person = directory.find((candidate) => candidate.id === winnerId);
                  return (
                    <li key={winnerId} className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1.5 text-xs">
                      <span className="font-medium">@{person?.username ?? "Former member"}</span>
                      {awardType === "team" && <span className="text-muted-foreground">{person?.role || "ATL/TL"}</span>}
                      <button
                        type="button"
                        className="rounded-full px-1.5 py-0.5 text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remove ${person?.username ?? "winner"}`}
                        onClick={() => {
                          setSaved("");
                          setDraft((rows) => rows.map((row, i) => i === index
                            ? { ...row, winner_ids: row.winner_ids.filter((id) => id !== winnerId), team_member_ids: row.winner_ids.length <= 1 ? [] : row.team_member_ids }
                            : row));
                        }}
                      >×</button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Input
              aria-label={`Place ${winner.rank} score or achievement`}
              placeholder="Score or achievement (optional)"
              maxLength={150}
              value={winner.achievement}
              onChange={(e) =>
                setDraft((rows) =>
                  rows.map((row, i) =>
                    i === index ? { ...row, achievement: e.target.value } : row,
                  ),
                )
              }
            />
            {awardType === "team" && <div className="space-y-2">
              <label className="text-xs font-medium" htmlFor={`${category.id}-${index}-team`}>Team members (optional)</label>
              <p className="text-xs text-muted-foreground">Teammates appear beneath the lead on the podium.</p>
              {winner.team_member_ids.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={`Team members for place ${winner.rank}`}>
                  {winner.team_member_ids.map((memberId) => {
                    const member = directory.find((person) => person.id === memberId);
                    return (
                      <li key={memberId} className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1.5 text-xs">
                        <span className="font-medium">@{member?.username ?? "Former member"}</span>
                        <span className="text-muted-foreground">Team member</span>
                        <button
                          type="button"
                          className="rounded-full px-1.5 py-0.5 text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Remove ${member?.username ?? "team member"}`}
                          onClick={() => {
                            setSaved("");
                            setDraft((rows) => rows.map((row, i) => i === index
                              ? { ...row, team_member_ids: row.team_member_ids.filter((id) => id !== memberId) }
                              : row));
                          }}
                        >×</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <SearchableSelect
                id={`${category.id}-${index}-team`}
                value=""
                onValueChange={(memberId) => {
                  setSaved("");
                  setDraft((rows) => rows.map((row, i) => i === index && !row.team_member_ids.includes(memberId)
                    ? { ...row, team_member_ids: [...row.team_member_ids, memberId] }
                    : row));
                }}
                options={teamMemberOptions(index)}
                placeholder={winner.winner_ids.length ? "Add a team member…" : "Choose a lead first"}
                searchPlaceholder={`Search ${category.department}...`}
                emptyText={`No one in ${category.department} matches`}
                disabled={!winner.winner_ids.length || people.isLoading || !!people.error}
                aria-label={`Add team member to place ${winner.rank}`}
              />
            </div>}
          </div>
        ))}
        {people.error && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(people.error)}
          </p>
        )}
        {duplicates && (
          <p role="alert" className="text-destructive text-sm">
            Choose each winner only once.
          </p>
        )}
        <Button
          disabled={
            mutation.isPending || duplicates || people.isLoading || !!people.error
          }
        >
          {mutation.isPending ? "Saving…" : "Save monthly winners"}
        </Button>
      </form>
      {confirmDelete ? (
        <div className="space-y-2">
          <p className="text-sm">
            Delete this category and all its monthly winners? Their details will
            remain in deletion logs.
          </p>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>{" "}
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ type: "delete", id: category.id })}
          >
            Confirm delete
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          Delete category
        </Button>
      )}
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(mutation.error)}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm">
          {saved}
        </p>
      )}
    </section>
  );
}

export function AwardEditPanel({
  department,
  month,
  categories,
  winners,
  ready = true,
}: {
  department: string;
  month: string;
  categories: AwardCategory[];
  winners: AwardWinner[];
  ready?: boolean;
}) {
  const [name, setName] = useState("");
  const [newAwardType, setNewAwardType] = useState<"individual" | "team">("individual");
  const mutation = useManageAwards();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Hall of Fame</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {department} Hall of Fame</DialogTitle>
          <DialogDescription>
            Create categories and select monthly winners. Eligibility and
            rankings are your choice.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(
              { type: "category", department, name, award_type: newAwardType },
              { onSuccess: () => setName("") },
            );
          }}
        >
          <div className="flex gap-2">
            <Input
              aria-label="New category name"
              required
              maxLength={100}
              placeholder="New category, e.g. Best Teamwork"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button disabled={mutation.isPending || !name.trim()}>
              Add category
            </Button>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">Award format</legend>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={newAwardType === "individual" ? "default" : "outline"} aria-pressed={newAwardType === "individual"} onClick={() => setNewAwardType("individual")}>Individual</Button>
              <Button type="button" size="sm" variant={newAwardType === "team" ? "default" : "outline"} aria-pressed={newAwardType === "team"} onClick={() => setNewAwardType("team")}>Team</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Individual places can have tied winners. Team places have one lead with members shown underneath.
            </p>
          </fieldset>
        </form>
        {mutation.error && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(mutation.error)}
          </p>
        )}
        {!ready && <p role="status" className="text-sm text-muted-foreground">Waiting for category and winner data. If this continues, the DigitalOcean database setup may still be in progress.</p>}
        {ready && categories.map((category) => (
          <CategoryEditor
            key={`${category.id}-${month}`}
            category={category}
            month={month}
            winners={winners.filter((w) => w.category_id === category.id)}
          />
        ))}
        <DeletionLogs />
      </DialogContent>
    </Dialog>
  );
}
