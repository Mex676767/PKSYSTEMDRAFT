import { useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useAllUsernames } from "@/hooks/use-guinness-records";
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

export function DeletionLogs() {
  const { hasPermission } = useAuth();
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
            — {log.deleted_by_name ?? "Database administrator"} ·{" "}
            {format(new Date(log.deleted_at), "dd MMM yyyy, HH:mm")}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {log.entity_type} · {log.entity_id}
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(log.snapshot, null, 2)}
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
  const users = useAllUsernames();
  const mutation = useManageAwards();
  const [name, setName] = useState(category.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState<WinnerInput[]>(
    [1, 2, 3].map((rank) => ({
      rank,
      user_id: winners.find((w) => w.rank === rank)?.user_id ?? "",
      achievement: winners.find((w) => w.rank === rank)?.achievement ?? "",
    })),
  );
  const duplicates = draft
    .filter((w) => w.user_id)
    .some(
      (w, i, list) =>
        list.findIndex((other) => other.user_id === w.user_id) !== i,
    );
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
              winners: draft.filter((w) => w.user_id),
            },
            { onSuccess: () => setSaved("Monthly winners saved.") },
          );
        }}
      >
        <p className="text-sm font-medium">
          Winners for {format(new Date(month + "T12:00:00"), "MMMM yyyy")}
        </p>
        {draft.map((winner, index) => (
          <div key={winner.rank} className="space-y-2">
            <label
              className="text-xs font-medium"
              htmlFor={`${category.id}-${index}`}
            >
              Place {winner.rank}
            </label>
            <select
              id={`${category.id}-${index}`}
              className="w-full bg-background border rounded-md p-2 text-sm"
              value={winner.user_id}
              onChange={(e) => {
                setSaved("");
                setDraft((rows) =>
                  rows.map((row, i) =>
                    i === index ? { ...row, user_id: e.target.value } : row,
                  ),
                );
              }}
            >
              <option value="">Unassigned</option>
              {users.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  @{user.username}
                </option>
              ))}
            </select>
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
          </div>
        ))}
        {users.error && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(users.error)}
          </p>
        )}
        {duplicates && (
          <p role="alert" className="text-destructive text-sm">
            Choose each winner only once.
          </p>
        )}
        <Button
          disabled={
            mutation.isPending || duplicates || users.isLoading || !!users.error
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
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(
              { type: "category", department, name },
              { onSuccess: () => setName("") },
            );
          }}
        >
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
        </form>
        {mutation.error && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(mutation.error)}
          </p>
        )}
        {!ready && <p role="status" className="text-sm text-muted-foreground">Waiting for category and winner data. If loading failed, apply migration 0017 and reload before editing winners.</p>}
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
