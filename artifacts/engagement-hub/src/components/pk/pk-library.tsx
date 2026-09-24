import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { BookOpen, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { SearchableSelect } from "@/components/searchable-select";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useOrgStructure } from "@/hooks/use-org-structure";
import { usePlaybookLibrary } from "@/hooks/use-pk";
import { PK_SCORING_LABEL, PK_TYPE_LABEL, type PkType } from "@/lib/pk";

/** Every settled PK's winner playbook, searchable, so wins can be copied. */
export function PkLibrary() {
  const { data: entries = [], isLoading } = usePlaybookLibrary();
  const { departments } = useOrgStructure();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [type, setType] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (dept && e.challenge?.department !== dept) return false;
      if (type && e.challenge?.pk_type !== type) return false;
      if (!q) return true;
      return [e.challenge?.topic, e.challenge?.metric, e.author?.username, e.what_extra, e.what_worked, e.how_to_copy]
        .some((t) => t?.toLowerCase().includes(q));
    });
  }, [entries, query, dept, type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search metric, person or tactic..."
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" aria-label="Search playbooks" />
        </label>
        <div className="w-48">
          <SearchableSelect value={dept} onValueChange={setDept} aria-label="Department" searchPlaceholder="Search departments..."
            options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]} />
        </div>
        <div className="w-36">
          <SearchableSelect value={type} onValueChange={setType} searchable={false} aria-label="Type"
            options={[{ value: "", label: "All types" }, ...(Object.keys(PK_TYPE_LABEL) as PkType[]).map((t) => ({ value: t, label: PK_TYPE_LABEL[t] }))]} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground text-sm">
          {entries.length === 0 ? "No playbooks yet. Every settled PK adds the winner's playbook here." : "No playbooks match."}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((e) => {
            const name = e.author?.username ?? "unknown";
            const c = e.challenge;
            return (
              <Card key={e.challenge_id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <UserAvatar user={{ name, initials: initialsForUsername(name), color: colorForId(e.author_id ?? name) }}
                      photoUrl={e.author?.avatar_url} border={e.author?.active_border} accessory={e.author?.active_accessory} className="w-9 h-9 text-[10px] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/challenges/${e.challenge_id}`} className="font-semibold hover:underline">{c?.topic}</Link>
                      <p className="text-xs text-muted-foreground">
                        @{name} won · {[c?.metric, c?.department, c?.pk_type && PK_TYPE_LABEL[c.pk_type], c?.format === "self_declaration" ? "Self-declaration" : c?.scoring && PK_SCORING_LABEL[c.scoring]].filter(Boolean).join(" · ")}
                        {c?.settled_at && ` · ${format(new Date(c.settled_at), "MMM d, yyyy")}`}
                      </p>
                    </div>
                  </div>
                  <dl className="space-y-2 text-sm">
                    {[["What they did extra", e.what_extra], ["What worked best", e.what_worked], ["How to copy it", e.how_to_copy]].map(([q, a]) => (
                      <div key={q}>
                        <dt className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="w-3 h-3" /> {q}</dt>
                        <dd className="whitespace-pre-wrap">{a}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
