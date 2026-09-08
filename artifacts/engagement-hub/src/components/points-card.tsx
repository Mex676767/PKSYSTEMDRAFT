import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Coins, Gift } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { usePointHistory, useGiftableProfiles, useGiftPoints } from "@/hooks/use-points";
import { getErrorMessage } from "@/lib/utils";

export function PointsCard() {
  const { session, profile } = useAuth();
  const { data: history = [] } = usePointHistory();
  const { data: giftable = [] } = useGiftableProfiles();
  const giftPoints = useGiftPoints();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || amount <= 0) return;
    setError(null);
    giftPoints.mutate(
      { recipientId, amount, note: note.trim() },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setAmount(10);
          setNote("");
          setRecipientId("");
        },
        onError: (err) => setError(getErrorMessage(err)),
      }
    );
  };

  return (
    <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/10 via-card to-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="w-5 h-5 text-primary" /> Points
          </CardTitle>
          <CardDescription>
            Your balance: <strong className="text-foreground">{profile?.points ?? 0} pts</strong>
          </CardDescription>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={!session} className="shrink-0">
              <Gift className="w-4 h-4 mr-1.5" /> Gift points
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gift Points</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select someone...</option>
                  {giftable.map((p) => (
                    <option key={p.id} value={p.id}>@{p.username}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <input
                  type="number"
                  min={1}
                  max={profile?.points ?? 0}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-xs text-muted-foreground">You have {profile?.points ?? 0} pts to give.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Thanks for the help!"
                  maxLength={100}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={giftPoints.isPending}>
                {giftPoints.isPending ? "Sending..." : "Send Points"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3 text-center bg-muted/50 rounded-lg">
            No point activity yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground truncate">{tx.reason}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={tx.amount >= 0 ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
                    {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
