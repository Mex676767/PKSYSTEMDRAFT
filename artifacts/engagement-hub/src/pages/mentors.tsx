import { useMemo, useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  ArrowRight, BookOpen, GraduationCap, Network, Users, Building2, Plus, Trash2, X,
  Search, ChevronDown, ChevronRight, Maximize2, Minimize2,
} from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useMentorships,
  useDirectory,
  useCreateMentorship,
  useDeleteMentorship,
  useSetDepartment,
  type DirectoryProfile,
} from "@/hooks/use-mentors";
import { cn } from "@/lib/utils";

function PersonChip({ id, username }: { id: string; username: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className={cn("text-white text-[10px] font-bold", colorForId(id))}>
          {initialsForUsername(username ?? "?")}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium truncate">@{username ?? "unknown"}</span>
    </div>
  );
}

export default function Mentors() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_mentors");

  const { data: mentorships = [], isLoading: loadingMentorships } = useMentorships();
  const { data: directory = [], isLoading: loadingDirectory } = useDirectory();

  const isLoading = loadingMentorships || loadingDirectory;

  return (
    <PageTransition className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Mentorship Network</h1>
        <p className="text-lg text-muted-foreground">Learn from the best. Grow together.</p>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>
      ) : (
        <Tabs defaultValue="organization" className="w-full">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="organization"><Network className="w-4 h-4 mr-1.5" /> Organization</TabsTrigger>
              <TabsTrigger value="pairs"><Users className="w-4 h-4 mr-1.5" /> Mentor-Mentee</TabsTrigger>
              <TabsTrigger value="departments"><Building2 className="w-4 h-4 mr-1.5" /> Departments</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="organization" className="pt-6">
            <OrganizationSection mentorships={mentorships} canManage={canManage} directory={directory} />
          </TabsContent>
          <TabsContent value="pairs" className="pt-6">
            <MentorMenteeSection mentorships={mentorships} canManage={canManage} directory={directory} />
          </TabsContent>
          <TabsContent value="departments" className="pt-6">
            <DepartmentSection directory={directory} canManage={canManage} />
          </TabsContent>
        </Tabs>
      )}
    </PageTransition>
  );
}

type MentorshipList = NonNullable<ReturnType<typeof useMentorships>["data"]>;

function OrganizationSection({
  mentorships,
  canManage,
  directory,
}: {
  mentorships: ReturnType<typeof useMentorships>["data"];
  canManage: boolean;
  directory: ReturnType<typeof useDirectory>["data"];
}) {
  const list = mentorships ?? [];
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { roots, childrenOf } = useMemo(() => {
    const childrenOf = new Map<string, MentorshipList>();
    const menteeIds = new Set<string>();
    for (const m of list) {
      menteeIds.add(m.mentee_id);
      if (!childrenOf.has(m.mentor_id)) childrenOf.set(m.mentor_id, []);
      childrenOf.get(m.mentor_id)!.push(m);
    }
    // A "root" is a mentor who isn't themselves anyone's mentee -- the top
    // of a chain. Dedupe since one mentor can appear across several rows.
    const seen = new Set<string>();
    const roots: { id: string; username: string | null | undefined }[] = [];
    for (const m of list) {
      if (!menteeIds.has(m.mentor_id) && !seen.has(m.mentor_id)) {
        seen.add(m.mentor_id);
        roots.push({ id: m.mentor_id, username: m.mentor?.username });
      }
    }
    return { roots, childrenOf };
  }, [list]);

  // Search filters the tree down to matching people plus their ancestor
  // chain (so you can still see who they report up to), auto-expanding
  // every branch along the way -- this is the main "easier to navigate"
  // fix for a tree that can otherwise get deep fast.
  const { matchIds, forceExpandIds } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchIds = new Set<string>();
    const forceExpandIds = new Set<string>();
    if (!q) return { matchIds, forceExpandIds };

    const usernameById = new Map<string, string | null | undefined>();
    for (const m of list) {
      usernameById.set(m.mentor_id, m.mentor?.username);
      usernameById.set(m.mentee_id, m.mentee?.username);
    }
    for (const [id, uname] of usernameById) {
      if ((uname ?? "").toLowerCase().includes(q)) matchIds.add(id);
    }

    function walk(personId: string, ancestors: string[], seen: Set<string>): boolean {
      if (seen.has(personId)) return false;
      seen.add(personId);
      let selfOrDescendantMatches = matchIds.has(personId);
      for (const m of childrenOf.get(personId) ?? []) {
        if (walk(m.mentee_id, [...ancestors, personId], seen)) selfOrDescendantMatches = true;
      }
      if (selfOrDescendantMatches) {
        forceExpandIds.add(personId);
        for (const a of ancestors) forceExpandIds.add(a);
      }
      return selfOrDescendantMatches;
    }
    for (const r of roots) walk(r.id, [], new Set());
    return { matchIds, forceExpandIds };
  }, [search, list, childrenOf, roots]);

  const hasSearch = search.trim().length > 0;
  const collapsibleIds = useMemo(() => Array.from(childrenOf.keys()), [childrenOf]);

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find someone in the tree..."
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        {collapsibleIds.length > 0 && (
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setCollapsed(new Set())}>
              <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Expand all
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setCollapsed(new Set(collapsibleIds))}>
              <Minimize2 className="w-3.5 h-3.5 mr-1.5" /> Collapse all
            </Button>
          </div>
        )}
      </div>

      {roots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No connections yet.{canManage && " Start one from the Mentor-Mentee tab."}
        </div>
      ) : hasSearch && forceExpandIds.size === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No one matches "{search}".</div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6 min-w-max">
            {roots.map((root) => (
              <motion.div key={root.id} variants={slideUp}>
                <TreeNode
                  personId={root.id}
                  username={root.username}
                  childrenOf={childrenOf}
                  canManage={canManage}
                  visited={new Set()}
                  collapsed={collapsed}
                  onToggleCollapse={toggleCollapse}
                  matchIds={matchIds}
                  forceExpandIds={forceExpandIds}
                  hasSearch={hasSearch}
                  directory={directory ?? []}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function TreeNode({
  personId,
  username,
  childrenOf,
  canManage,
  visited,
  mentorshipId,
  status,
  collapsed,
  onToggleCollapse,
  matchIds,
  forceExpandIds,
  hasSearch,
  directory,
}: {
  personId: string;
  username: string | null | undefined;
  childrenOf: Map<string, MentorshipList>;
  canManage: boolean;
  visited: Set<string>;
  mentorshipId?: string;
  status?: string;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  matchIds: Set<string>;
  forceExpandIds: Set<string>;
  hasSearch: boolean;
  directory: DirectoryProfile[];
}) {
  if (visited.has(personId)) return null; // guard against a bad cyclical pairing
  const isMatch = matchIds.has(personId);
  // While searching, hide branches that contain no match at all.
  if (hasSearch && !forceExpandIds.has(personId) && !isMatch) return null;

  const nextVisited = new Set(visited).add(personId);
  const children = childrenOf.get(personId) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = hasSearch ? true : !collapsed.has(personId);

  return (
    <div className="flex flex-col items-start">
      <div
        className={cn(
          "flex items-center gap-1.5 bg-card border rounded-lg px-3 py-2 shadow-sm",
          isMatch && hasSearch ? "border-primary ring-1 ring-primary/50" : "border-border"
        )}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggleCollapse(personId)}
            title={isExpanded ? "Collapse" : "Expand"}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
        <PersonChip id={personId} username={username} />
        {status && (
          <Badge variant={status === "active" ? "default" : "secondary"} className="text-[9px] uppercase shrink-0">
            {status}
          </Badge>
        )}
        {canManage && <AddMenteeButton mentorId={personId} directory={directory} />}
        {mentorshipId && canManage && <DeletePairingButton id={mentorshipId} />}
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-6 pl-6 border-l-2 border-dashed border-border mt-3 space-y-3">
          {children.map((m) => (
            <TreeNode
              key={m.id}
              personId={m.mentee_id}
              username={m.mentee?.username}
              childrenOf={childrenOf}
              canManage={canManage}
              visited={nextVisited}
              mentorshipId={m.id}
              status={m.status}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              matchIds={matchIds}
              forceExpandIds={forceExpandIds}
              hasSearch={hasSearch}
              directory={directory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// One-click "add a mentee under this specific person" -- the mentor is
// already implied by which node you clicked, so this only needs to ask for
// the mentee, unlike the full New Pairing dialog (which picks both).
function AddMenteeButton({ mentorId, directory }: { mentorId: string; directory: DirectoryProfile[] }) {
  const createMentorship = useCreateMentorship();
  const [isOpen, setIsOpen] = useState(false);
  const [menteeId, setMenteeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = directory.filter((p) => p.id !== mentorId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menteeId) return;
    setError(null);
    createMentorship.mutate(
      { mentorId, menteeId },
      {
        onSuccess: () => {
          setIsOpen(false);
          setMenteeId("");
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" title="Add a mentee under this person" className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a Mentee</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mentee</label>
            <select value={menteeId} onChange={(e) => setMenteeId(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select...</option>
              {options.map((p) => <option key={p.id} value={p.id}>@{p.username}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={createMentorship.isPending}>
            {createMentorship.isPending ? "Adding..." : "Add Mentee"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MentorMenteeSection({
  mentorships,
  canManage,
  directory,
}: {
  mentorships: ReturnType<typeof useMentorships>["data"];
  canManage: boolean;
  directory: ReturnType<typeof useDirectory>["data"];
}) {
  const list = mentorships ?? [];

  const byMentor = useMemo(() => {
    const map = new Map<string, { username: string | null | undefined; mentees: typeof list }>();
    for (const m of list) {
      if (!map.has(m.mentor_id)) {
        map.set(m.mentor_id, { username: m.mentor?.username, mentees: [] });
      }
      map.get(m.mentor_id)!.mentees.push(m);
    }
    return Array.from(map.entries());
  }, [list]);

  return (
    <div className="space-y-4">
      {canManage && <NewPairingButton directory={directory ?? []} />}
      {byMentor.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No mentors assigned yet.</div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
          {byMentor.map(([mentorId, { username, mentees }]) => (
            <motion.div key={mentorId} variants={slideUp}>
              <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <PersonChip id={mentorId} username={username} />
                    <Badge variant="outline" className="text-[9px] ml-auto shrink-0">
                      {mentees.length} mentee{mentees.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="pl-6 space-y-2">
                    {mentees.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg p-2">
                        <PersonChip id={m.mentee_id} username={m.mentee?.username} />
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[9px] uppercase">
                            {m.status}
                          </Badge>
                          {canManage && <DeletePairingButton id={m.id} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function DepartmentSection({
  directory,
  canManage,
}: {
  directory: ReturnType<typeof useDirectory>["data"];
  canManage: boolean;
}) {
  const list = directory ?? [];
  const setDepartment = useSetDepartment();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deptInput, setDeptInput] = useState("");

  const byDept = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const p of list) {
      const key = p.department?.trim() || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)));
  }, [list]);

  const startEdit = (p: DirectoryProfileLike) => {
    setEditingId(p.id);
    setDeptInput(p.department ?? "");
  };

  const saveEdit = (id: string) => {
    setDepartment.mutate({ userId: id, department: deptInput.trim() || null });
    setEditingId(null);
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      {byDept.map(([dept, people]) => (
        <motion.div key={dept} variants={slideUp}>
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> {dept} <Badge variant="outline" className="text-[9px]">{people.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {people.map((p) => (
              <Card key={p.id} className="shadow-sm">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <PersonChip id={p.id} username={p.username} />
                  {canManage && (
                    editingId === p.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          autoFocus
                          value={deptInput}
                          onChange={(e) => setDeptInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(p.id)}
                          placeholder="Department"
                          className="w-24 h-7 text-xs rounded border border-input bg-background px-2"
                        />
                        <button onClick={() => saveEdit(p.id)} className="text-emerald-600"><ArrowRight className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(p)} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 underline">
                        Edit
                      </button>
                    )
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

type DirectoryProfileLike = { id: string; username: string; department: string | null };

function NewPairingButton({ directory }: { directory: DirectoryProfileLike[] }) {
  const createMentorship = useCreateMentorship();
  const [isOpen, setIsOpen] = useState(false);
  const [mentorId, setMentorId] = useState("");
  const [menteeId, setMenteeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorId || !menteeId) return;
    if (mentorId === menteeId) {
      setError("Mentor and mentee can't be the same person.");
      return;
    }
    setError(null);
    createMentorship.mutate(
      { mentorId, menteeId },
      {
        onSuccess: () => {
          setIsOpen(false);
          setMentorId("");
          setMenteeId("");
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
      }
    );
  };

  return (
    <div className="flex justify-center">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> New Pairing</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New Mentor Pairing</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mentor</label>
              <select value={mentorId} onChange={(e) => setMentorId(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select...</option>
                {directory.map((p) => <option key={p.id} value={p.id}>@{p.username}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mentee</label>
              <select value={menteeId} onChange={(e) => setMenteeId(e.target.value)} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select...</option>
                {directory.map((p) => <option key={p.id} value={p.id}>@{p.username}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={createMentorship.isPending}>
              {createMentorship.isPending ? "Creating..." : "Create Pairing"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeletePairingButton({ id }: { id: string }) {
  const deleteMentorship = useDeleteMentorship();
  return (
    <button
      onClick={() => window.confirm("Remove this pairing?") && deleteMentorship.mutate(id)}
      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
