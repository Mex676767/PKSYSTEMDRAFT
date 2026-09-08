import { useState } from "react";
import { format } from "date-fns";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Dices, Plus, X, Trophy, Ban, Coins } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useBets,
  useBetOptions,
  useBetWagers,
  useCreateBet,
  usePlaceWager,
  useResolveBet,
  useCancelBet,
  type Bet,
} from "@/hooks/use-bets";
import { getErrorMessage, cn } from "@/lib/utils";

export default function Betting() {
  const { session } = useAuth();
  const { data: bets = [], isLoading: loadingBets } = useBets();
  const { data: options = [] } = useBetOptions();
  const { data: wagers = [] } = useBetWagers();

  const isLoading = loadingBets;

  return (
    <PageTransition className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
            <Dices className="w-8 h-8 text-primary" /> Betting
          </h1>
          <p className="text-muted-foreground mt-1">Wager points on anything. Winners split the pot.</p>
        </div>
        <NewBetDialog disabled={!session} />
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>
      ) : bets.length === 0 ? (
        <div className="p-12 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground">
          No bets yet. {session ? "Start one!" : "Sign in to bet."}
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
          {bets.map((bet) => (
            <motion.div key={bet.id} variants={slideUp}>
              <BetCard
                bet={bet}
                options={options.filter((o) => o.bet_id === bet.id)}
                wagers={wagers.filter((w) => w.bet_id === bet.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}

function BetCard({
  bet,
  options,
  wagers,
}: {
  bet: Bet;
  options: { id: string; label: string }[];
  wagers: { id: string; option_id: string; user_id: string; amount: number; user: { username: string | null } | null }[];
}) {
  const { session, hasPermission } = useAuth();
  const canResolve = hasPermission("manage_bets");
  const placeWager = usePlaceWager();
  const resolveBet = useResolveBet();
  const cancelBet = useCancelBet();

  const [selectedOption, setSelectedOption] = useState("");
  const [amount, setAmount] = useState(10);
  const [resolvingOption, setResolvingOption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const myWager = wagers.find((w) => w.user_id === session?.user.id);
  const totalPool = wagers.reduce((sum, w) => sum + w.amount, 0);
  const canManageThis = canResolve || bet.creator_id === session?.user.id;
  const isPastClose = bet.closes_at ? new Date(bet.closes_at) < new Date() : false;

  const handleWager = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption || amount <= 0) return;
    setError(null);
    placeWager.mutate(
      { betId: bet.id, optionId: selectedOption, amount },
      { onError: (err) => setError(getErrorMessage(err)) }
    );
  };

  const handleResolve = () => {
    if (!resolvingOption) return;
    if (!window.confirm("Resolve this bet? This can't be undone.")) return;
    resolveBet.mutate({ betId: bet.id, winningOptionId: resolvingOption });
  };

  return (
    <Card className={cn(
      "shadow-sm",
      bet.status === "resolved" && "border-emerald-500/30",
      bet.status === "cancelled" && "opacity-60 border-dashed"
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">{bet.title}</h3>
            <p className="text-xs text-muted-foreground">
              @{bet.creator?.username ?? "unknown"}
              {bet.closes_at && ` · closes ${format(new Date(bet.closes_at), "MMM d, h:mm a")}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {bet.status === "open" && <Badge className="text-[10px] bg-primary hover:bg-primary">Open</Badge>}
            {bet.status === "resolved" && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600"><Trophy className="w-2.5 h-2.5 mr-1" /> Resolved</Badge>}
            {bet.status === "cancelled" && <Badge variant="outline" className="text-[10px]"><Ban className="w-2.5 h-2.5 mr-1" /> Cancelled</Badge>}
          </div>
        </div>

        <div className="space-y-1.5">
          {options.map((opt) => {
            const optTotal = wagers.filter((w) => w.option_id === opt.id).reduce((s, w) => s + w.amount, 0);
            const isWinner = bet.winning_option_id === opt.id;
            const isMine = myWager?.option_id === opt.id;
            return (
              <div
                key={opt.id}
                className={cn(
                  "flex items-center justify-between gap-2 p-2 rounded-lg text-sm",
                  isWinner ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-muted/40",
                  isMine && !isWinner && "border border-primary/30"
                )}
              >
                <span className="flex items-center gap-1.5">
                  {opt.label}
                  {isMine && <Badge variant="outline" className="text-[9px]">Your pick</Badge>}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                  <Coins className="w-3 h-3" /> {optTotal}
                </span>
              </div>
            );
          })}
        </div>

        {bet.status === "open" && totalPool > 0 && (
          <p className="text-[10px] text-muted-foreground text-right">Pool: {totalPool} pts total</p>
        )}

        {bet.status === "open" && session && !myWager && !isPastClose && (
          <form onSubmit={handleWager} className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              required
              className="h-9 flex-1 min-w-[120px] rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Pick an option...</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={placeWager.isPending}>
              {placeWager.isPending ? "..." : "Wager"}
            </Button>
          </form>
        )}
        {myWager && bet.status === "open" && (
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
            You wagered <strong className="text-foreground">{myWager.amount} pts</strong>.
          </p>
        )}
        {isPastClose && bet.status === "open" && !myWager && (
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">Betting closed.</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        {bet.status === "open" && canManageThis && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            {canResolve && (
              <>
                <select
                  value={resolvingOption}
                  onChange={(e) => setResolvingOption(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Pick winner to resolve...</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!resolvingOption || resolveBet.isPending} onClick={handleResolve}>
                  Resolve
                </Button>
              </>
            )}
            <button
              onClick={() => window.confirm("Cancel this bet and refund everyone?") && cancelBet.mutate(bet.id)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel bet
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewBetDialog({ disabled }: { disabled: boolean }) {
  const createBet = useCreateBet();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim() || cleanOptions.length < 2) {
      setError("Add a title and at least 2 options.");
      return;
    }
    setError(null);
    createBet.mutate(
      { title: title.trim(), options: cleanOptions },
      {
        onSuccess: () => {
          setIsOpen(false);
          setTitle("");
          setOptions(["", ""]);
        },
        onError: (err) => setError(getErrorMessage(err)),
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> New Bet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Start a Bet</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">What are we betting on?</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Will we ship on time this sprint?"
              required
              maxLength={200}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Options (write your own — not just yes/no)</label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="text-xs text-primary hover:underline"
            >
              + Add another option
            </button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={createBet.isPending}>
            {createBet.isPending ? "Creating..." : "Create Bet"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
