import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { History, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ReactionBar } from "@/components/social/reaction-bar";
import { CommentSection } from "@/components/social/comment-section";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useHofRecordHistory,
  useSubmitHofRecord,
  useAllUsernames,
  type HofCategory,
  type HofRecord,
} from "@/hooks/use-hall-of-fame";
import { getHofIcon } from "@/lib/icon-map";

export function HofCategoryCard({ category, current }: { category: HofCategory; current: HofRecord | null }) {
  const { session, hasPermission } = useAuth();
  const canManage = hasPermission("manage_hall_of_fame");
  const Icon = getHofIcon(category.icon);
  const submitRecord = useSubmitHofRecord(category.id);
  const { data: users = [] } = useAllUsernames();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [achievement, setAchievement] = useState("");
  const [holderId, setHolderId] = useState(session?.user.id ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const { data: history = [] } = useHofRecordHistory(category.id);
  const pastRecords = history.filter((r) => !r.is_current);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!achievement.trim() || !holderId) return;
    submitRecord.mutate(
      { achievement: achievement.trim(), holderId },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setAchievement("");
        },
      }
    );
  };

  return (
    <Card className="border-accent/20 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-accent/10 via-card to-card overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="bg-accent/20 text-accent-foreground p-2 rounded-xl shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold leading-tight">{category.name}</h3>
              {category.description && (
                <p className="text-xs text-muted-foreground">{category.description}</p>
              )}
            </div>
          </div>
        </div>

        {current ? (
          <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <Avatar className="w-11 h-11 border-2 border-accent shrink-0">
              <AvatarFallback className={`text-white font-bold ${colorForId(current.holder_id)}`}>
                {initialsForUsername(current.holder?.username ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5">Current</Badge>
                <span className="text-sm font-semibold truncate">@{current.holder?.username ?? "unknown"}</span>
              </div>
              <p className="text-sm text-muted-foreground truncate">{current.achievement}</p>
              <p className="text-[10px] text-muted-foreground/70">
                {format(new Date(current.record_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-xl border border-dashed">
            No record yet.
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {canManage && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="shrink-0">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Set record
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set the "{category.name}" record</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Record holder</label>
                    <select
                      value={holderId}
                      onChange={(e) => setHolderId(e.target.value)}
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select someone...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>@{u.username}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Achievement</label>
                    <textarea
                      value={achievement}
                      onChange={(e) => setAchievement(e.target.value)}
                      placeholder="e.g. 127 bugs squashed in one sprint"
                      required
                      maxLength={300}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitRecord.isPending}>
                    {submitRecord.isPending ? "Saving..." : "Set record"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {pastRecords.length > 0 && (
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              History ({pastRecords.length})
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {showHistory && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            {pastRecords.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="w-5 h-5 shrink-0">
                  <AvatarFallback className={`text-white text-[8px] font-bold ${colorForId(r.holder_id)}`}>
                    {initialsForUsername(r.holder?.username ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">@{r.holder?.username ?? "unknown"}</span>
                <span className="truncate">{r.achievement}</span>
                <span className="ml-auto shrink-0">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        )}

        {current && (
          <div className="pt-2 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <ReactionBar targetType="hof_record" targetId={current.id} />
              <button
                onClick={() => setShowComments((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showComments ? "Hide comments" : "Comments"}
              </button>
            </div>
            {showComments && <CommentSection targetType="hof_record" targetId={current.id} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
