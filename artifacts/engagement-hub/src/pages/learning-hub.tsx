import { useMemo, useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  Plus,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { PageTransition } from "@/components/animations";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useCreateLearningRequest,
  useCreateLearningResource,
  useCreateLearningShare,
  useDeleteLearningRequest,
  useDeleteLearningResource,
  useDeleteLearningShare,
  useLearningRequests,
  useLearningResources,
  useLearningShares,
  useReviewLearningRequest,
  type LearningRequest,
} from "@/hooks/use-learning";
import { cn } from "@/lib/utils";

function safeUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function PersonLine({ id, person, label }: { id: string; person: { username: string | null; avatar_url: string | null; active_border: string | null; active_accessory?: string | null; department?: string | null } | null; label?: string }) {
  const name = person?.username ?? "Unknown";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <UserAvatar
        user={{ name, initials: initialsForUsername(name), color: colorForId(id) }}
        photoUrl={person?.avatar_url}
        border={person?.active_border}
        accessory={person?.active_accessory}
        className="h-8 w-8 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">@{name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{label ?? person?.department ?? "Team member"}</p>
      </div>
    </div>
  );
}

export default function LearningHub() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("manage_learning");

  return (
    <PageTransition className="mx-auto max-w-6xl space-y-7 p-4 md:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-500/15 via-card to-cyan-500/10 p-6 md:p-8">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge className="mb-3 border-violet-400/30 bg-violet-500/15 text-violet-700 hover:bg-violet-500/15 dark:text-violet-200">
              <Sparkles className="mr-1 h-3 w-3" /> Learn together
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Learning Hub</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Find useful resources, ask the company to sponsor something you want to learn, and share what worked for you.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-2xl border bg-background/60 px-3 py-3"><BookOpen className="mx-auto mb-1 h-5 w-5 text-primary" />Library</div>
            <div className="rounded-2xl border bg-background/60 px-3 py-3"><GraduationCap className="mx-auto mb-1 h-5 w-5 text-cyan-500" />Requests</div>
            <div className="rounded-2xl border bg-background/60 px-3 py-3"><Lightbulb className="mx-auto mb-1 h-5 w-5 text-amber-500" />Sharing</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="library" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl p-1 md:w-auto md:inline-grid">
          <TabsTrigger value="library" className="rounded-xl py-2.5">Library</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl py-2.5">Things to learn</TabsTrigger>
          <TabsTrigger value="sharing" className="rounded-xl py-2.5">Sharing</TabsTrigger>
        </TabsList>
        <TabsContent value="library"><Library canManage={canManage} /></TabsContent>
        <TabsContent value="requests"><LearningRequests canManage={canManage} /></TabsContent>
        <TabsContent value="sharing"><LearningSharing canManage={canManage} /></TabsContent>
      </Tabs>
    </PageTransition>
  );
}

function Library({ canManage }: { canManage: boolean }) {
  const { data: resources = [], isLoading, error } = useLearningResources();
  const create = useCreateLearningResource();
  const remove = useDeleteLearningResource();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? resources.filter((resource) => `${resource.title} ${resource.category} ${resource.description}`.toLowerCase().includes(query))
      : resources;
  }, [resources, search]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !category.trim()) return;
    create.mutate({ title, category, description, url }, {
      onSuccess: () => {
        setTitle(""); setCategory("General"); setDescription(""); setUrl(""); setShowForm(false);
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Company library</h2>
          <p className="text-sm text-muted-foreground">Guides, courses, videos and references worth keeping.</p>
        </div>
        {canManage && <Button onClick={() => setShowForm((value) => !value)}><Plus className="mr-2 h-4 w-4" />Add resource</Button>}
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" maxLength={140} required />
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" maxLength={60} required />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" type="url" className="md:col-span-2" />
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why is this useful?" maxLength={2000} className="md:col-span-2 min-h-24" />
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>{create.isPending ? "Adding..." : "Add to library"}</Button>
              </div>
              {create.isError && <p className="md:col-span-2 text-sm text-destructive">Could not add this resource. Check that the database migration is installed and that you have permission.</p>}
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the library..." className="pl-9" />
      </div>

      {error ? <SetupMessage /> : isLoading ? <LoadingCards /> : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="The library is empty" body={canManage ? "Add the first useful resource for the team." : "A learning manager will add resources here soon."} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((resource) => {
            const href = safeUrl(resource.url);
            return (
              <Card key={resource.id} className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="secondary">{resource.category}</Badge>
                    {canManage && (
                      <button
                        onClick={() => window.confirm(`Remove “${resource.title}” from the library?`) && remove.mutate(resource.id)}
                        className="rounded-lg p-1.5 text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label="Delete resource"
                      ><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold leading-snug">{resource.title}</h3>
                    {resource.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{resource.description}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-3">
                    <PersonLine id={resource.created_by} person={resource.author} label={`Added ${formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })}`} />
                    {href && <Button asChild size="sm" variant="outline"><a href={href} target="_blank" rel="noreferrer">Open <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LearningRequests({ canManage }: { canManage: boolean }) {
  const { session } = useAuth();
  const { data: requests = [], isLoading, error } = useLearningRequests();
  const create = useCreateLearningRequest();
  const review = useReviewLearningRequest();
  const remove = useDeleteLearningRequest();
  const [showForm, setShowForm] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseUrl, setCourseUrl] = useState("");
  const [reason, setReason] = useState("");
  const [benefit, setBenefit] = useState("");
  const [cost, setCost] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!courseName.trim() || !reason.trim() || !benefit.trim()) return;
    create.mutate({
      courseName,
      courseUrl,
      reason,
      benefit,
      estimatedCost: cost.trim() ? Number(cost) : null,
    }, {
      onSuccess: () => {
        setCourseName(""); setCourseUrl(""); setReason(""); setBenefit(""); setCost(""); setShowForm(false);
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Things we wish to learn</h2>
          <p className="text-sm text-muted-foreground">Share a course or skill you want to learn. The company can review it for sponsorship.</p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}><Plus className="mr-2 h-4 w-4" />Add my request</Button>
      </div>

      {showForm && (
        <Card className="border-cyan-500/30">
          <CardContent className="p-5">
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
              <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Course or skill name" maxLength={160} required />
              <Input value={courseUrl} onChange={(e) => setCourseUrl(e.target.value)} placeholder="Course link (optional)" type="url" />
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you want to learn this?" maxLength={2000} required className="min-h-24" />
              <Textarea value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="How could this help you, your team, or the company?" maxLength={2000} required className="min-h-24" />
              <Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Estimated cost in RM (optional)" type="number" min="0" step="0.01" />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>{create.isPending ? "Sending..." : "Share request"}</Button>
              </div>
              {create.isError && <p className="md:col-span-2 text-sm text-destructive">Could not submit the request. The new database migration may still need to be applied.</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {error ? <SetupMessage /> : isLoading ? <LoadingCards /> : requests.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No learning wishes yet" body="Be the first to tell the team what you would like to learn." />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <LearningRequestCard
              key={request.id}
              request={request}
              canManage={canManage}
              isOwn={request.user_id === session?.user.id}
              busy={review.isPending || remove.isPending}
              onReview={(status) => review.mutate({ id: request.id, status })}
              onDelete={() => remove.mutate(request.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LearningRequestCard({ request, canManage, isOwn, busy, onReview, onDelete }: {
  request: LearningRequest;
  canManage: boolean;
  isOwn: boolean;
  busy: boolean;
  onReview: (status: "sponsored" | "declined") => void;
  onDelete: () => void;
}) {
  const href = safeUrl(request.course_url);
  const statusStyle = request.status === "sponsored"
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
    : request.status === "declined"
      ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return (
    <Card className={cn("overflow-hidden", request.status === "sponsored" && "border-emerald-500/30")}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-0 capitalize hover:bg-current/15", statusStyle)}>{request.status}</Badge>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold">{request.course_name}</h3>
              {request.estimated_cost != null && <p className="text-sm font-medium text-primary">Estimated RM {Number(request.estimated_cost).toFixed(2)}</p>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-muted/40 p-3"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Why I want this</p><p className="text-sm whitespace-pre-wrap">{request.reason}</p></div>
              <div className="rounded-xl bg-muted/40 p-3"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">How it helps</p><p className="text-sm whitespace-pre-wrap">{request.benefit}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PersonLine id={request.user_id} person={request.requester} />
              {href && <Button asChild size="sm" variant="outline"><a href={href} target="_blank" rel="noreferrer">View course <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 md:w-36 md:flex-col">
            {canManage && request.status === "pending" && (
              <>
                <Button size="sm" onClick={() => onReview("sponsored")} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500"><CheckCircle2 className="mr-1.5 h-4 w-4" />Sponsor</Button>
                <Button size="sm" variant="outline" onClick={() => onReview("declined")} disabled={busy}><XCircle className="mr-1.5 h-4 w-4" />Decline</Button>
              </>
            )}
            {(canManage || (isOwn && request.status === "pending")) && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => window.confirm("Remove this learning request?") && onDelete()} disabled={busy}><Trash2 className="mr-1.5 h-4 w-4" />Remove</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LearningSharing({ canManage }: { canManage: boolean }) {
  const { session } = useAuth();
  const { data: shares = [], isLoading, error } = useLearningShares();
  const create = useCreateLearningShare();
  const remove = useDeleteLearningShare();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [learned, setLearned] = useState("");
  const [benefit, setBenefit] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !learned.trim() || !benefit.trim()) return;
    create.mutate({ title, learned, benefit, resourceUrl }, {
      onSuccess: () => { setTitle(""); setLearned(""); setBenefit(""); setResourceUrl(""); setShowForm(false); },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-bold">Share what you learned</h2><p className="text-sm text-muted-foreground">A small lesson can save someone else hours.</p></div>
        <Button onClick={() => setShowForm((value) => !value)}><Plus className="mr-2 h-4 w-4" />Share something</Button>
      </div>

      {showForm && (
        <Card className="border-amber-500/30"><CardContent className="p-5">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What did you learn?" maxLength={160} required className="md:col-span-2" />
            <Textarea value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="Explain the useful part in your own words" maxLength={3000} required className="min-h-28" />
            <Textarea value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="How did this help you, or how could it help others?" maxLength={2000} required className="min-h-28" />
            <Input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="Helpful link (optional)" type="url" />
            <div className="flex items-center justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? "Sharing..." : "Share with team"}</Button></div>
            {create.isError && <p className="md:col-span-2 text-sm text-destructive">Could not share this yet. The database migration may still need to be applied.</p>}
          </form>
        </CardContent></Card>
      )}

      {error ? <SetupMessage /> : isLoading ? <LoadingCards /> : shares.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No shared lessons yet" body="Share one useful thing you learned recently." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shares.map((share) => {
            const href = safeUrl(share.resource_url);
            const canDelete = canManage || share.user_id === session?.user.id;
            return (
              <Card key={share.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg leading-snug">{share.title}</CardTitle>
                    {canDelete && <button onClick={() => window.confirm("Remove this shared lesson?") && remove.mutate(share.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete shared lesson"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">What I learned</p><p className="text-sm leading-relaxed whitespace-pre-wrap">{share.learned}</p></div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">Why it helps</p><p className="text-sm leading-relaxed whitespace-pre-wrap">{share.benefit}</p></div>
                  <div className="flex items-center justify-between gap-3 border-t pt-3">
                    <PersonLine id={share.user_id} person={share.author} label={`Shared ${formatDistanceToNow(new Date(share.created_at), { addSuffix: true })}`} />
                    {href && <Button asChild size="sm" variant="outline"><a href={href} target="_blank" rel="noreferrer">Link <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SetupMessage() {
  return <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-5 text-sm text-amber-800 dark:text-amber-200">Learning Hub data is not ready yet. Apply migration <strong>0052_learning_hub_and_gratitude.sql</strong> to this organisation’s Supabase project.</CardContent></Card>;
}

function LoadingCards() {
  return <div className="grid gap-4 md:grid-cols-2"><div className="h-40 animate-pulse rounded-2xl bg-muted" /><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof BookOpen; title: string; body: string }) {
  return <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary"><Icon className="h-7 w-7" /></div><h3 className="font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p></CardContent></Card>;
}
