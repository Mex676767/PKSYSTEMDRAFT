import { useMemo, useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, GraduationCap, Network, Users, Building2, Plus, Trash2, X } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useMentorships,
  useDirectory,
  useCreateMentorship,
  useDeleteMentorship,
  useSetDepartment,
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
            <MentorMenteeSection mentorships={mentorships} canManage={canManage} />
          </TabsContent>
          <TabsContent value="departments" className="pt-6">
            <DepartmentSection directory={directory} canManage={canManage} />
          </TabsContent>
        </Tabs>
      )}
    </PageTransition>
  );
}

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

  return (
    <div className="space-y-4">
      {canManage && <NewPairingButton directory={directory ?? []} />}
      {list.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No connections yet.</div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((m) => (
            <motion.div key={m.id} variants={slideUp}>
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <PersonChip id={m.mentor_id} username={m.mentor?.username} />
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <PersonChip id={m.mentee_id} username={m.mentee?.username} />
                  <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[9px] uppercase shrink-0">
                    {m.status}
                  </Badge>
                  {canManage && <DeletePairingButton id={m.id} />}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function MentorMenteeSection({
  mentorships,
  canManage,
}: {
  mentorships: ReturnType<typeof useMentorships>["data"];
  canManage: boolean;
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

  if (byMentor.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No mentors assigned yet.</div>;
  }

  return (
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
