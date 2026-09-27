import { useMemo, useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Award, Crown, Megaphone, Sparkles, Star, Trash2, Trophy } from "lucide-react";
import { PageTransition } from "@/components/animations";
import { SearchableSelect } from "@/components/searchable-select";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useDeleteGratitude, useGratitudeLetters, useSendGratitude } from "@/hooks/use-gratitude";
import { useDirectory } from "@/hooks/use-mentors";

export default function Gratitude() {
  const { session, isAdmin } = useAuth();
  const { data: directory = [] } = useDirectory();
  const { data: shoutouts = [], isLoading, error } = useGratitudeLetters();
  const send = useSendGratitude();
  const remove = useDeleteGratitude();
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const people = useMemo(
    () => directory
      .filter((person) => person.id !== session?.user.id)
      .map((person) => ({
        value: person.id,
        label: `@${person.username}${person.department ? ` · ${person.department}` : ""}`,
      })),
    [directory, session?.user.id],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!recipientId || !message.trim()) return;
    send.mutate({ recipientId, message }, {
      onSuccess: () => {
        setRecipientId("");
        setMessage("");
        setSent(true);
        window.setTimeout(() => setSent(false), 4000);
      },
    });
  };

  return (
    <PageTransition className="mx-auto max-w-6xl space-y-7 p-4 md:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-violet-600/20 via-card to-amber-400/15 p-6 md:p-8">
        <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <Sparkles className="absolute right-8 top-7 h-6 w-6 text-amber-300/70" />
        <div className="relative flex items-center gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400 text-white shadow-lg shadow-fuchsia-500/20">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <Badge className="mb-2 border-amber-300/35 bg-amber-400/15 text-amber-700 hover:bg-amber-400/15 dark:text-amber-200"><Crown className="mr-1 h-3 w-3" />Celebrate great work</Badge>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">MVP Shoutouts</h1>
            <p className="mt-1 text-muted-foreground">Put a teammate in the spotlight when they step up, help out, or absolutely crush it.</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-violet-500/25">
        <CardContent className="p-0">
          <div className="border-b bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-amber-400/10 px-5 py-4">
            <h2 className="flex items-center gap-2 font-bold"><Megaphone className="h-4 w-4 text-fuchsia-500" />Give an MVP shoutout</h2>
            <p className="text-sm text-muted-foreground">Everyone will see the recognition, and they’ll get a live celebration if they’re online.</p>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
            <SearchableSelect
              value={recipientId}
              onValueChange={setRecipientId}
              options={people}
              placeholder="Who deserves the spotlight?"
              searchPlaceholder="Search teammates..."
            />
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What did they do that deserves a shoutout? Be specific and hype them up..."
              maxLength={2000}
              className="min-h-28 resize-y"
              required
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">This shoutout will be visible to everyone in the company.</p>
              <Button type="submit" disabled={!recipientId || !message.trim() || send.isPending} className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-400 text-white hover:opacity-90">
                <Megaphone className="mr-2 h-4 w-4" />{send.isPending ? "Posting..." : "Post shoutout"}
              </Button>
            </div>
            {sent && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">Shoutout posted! Their MVP moment is appearing now.</p>}
            {send.isError && <p className="text-sm text-destructive">Could not post this shoutout. The Gratitude database migration may still need to be applied.</p>}
          </form>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-xl font-bold"><Award className="h-5 w-5 text-amber-500" />MVP Spotlight</h2><p className="text-sm text-muted-foreground">The people making a difference, recognised by their teammates.</p></div>
          <Badge variant="secondary">{shoutouts.length} shoutout{shoutouts.length === 1 ? "" : "s"}</Badge>
        </div>

        {error ? (
          <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-5 text-sm text-amber-800 dark:text-amber-200">Shoutouts are not ready yet. Apply migration <strong>0052_learning_hub_and_gratitude.sql</strong> to this organisation’s Supabase project.</CardContent></Card>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2"><div className="h-52 animate-pulse rounded-2xl bg-muted" /><div className="h-52 animate-pulse rounded-2xl bg-muted" /></div>
        ) : shoutouts.length === 0 ? (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><div className="mb-4 rounded-full bg-amber-500/10 p-4 text-amber-500"><Trophy className="h-7 w-7" /></div><h3 className="font-bold">No MVP shoutouts yet</h3><p className="mt-1 text-sm text-muted-foreground">Spot someone doing great work? Give them the first shoutout.</p></CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shoutouts.map((shoutout) => {
              const senderName = shoutout.sender?.username ?? "Someone";
              const recipientName = shoutout.recipient?.username ?? "teammate";
              const canDelete = isAdmin || shoutout.sender_id === session?.user.id;
              return (
                <motion.div
                  key={shoutout.id}
                  initial={{ opacity: 0, y: 20, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ y: -5, rotate: 0.25 }}
                  transition={{ type: "spring", stiffness: 180, damping: 18 }}
                  className="h-full"
                >
                  <Card className="gratitude-letter group relative h-full overflow-hidden border-amber-400/30 bg-gradient-to-br from-card via-violet-500/5 to-amber-400/10 shadow-[0_16px_45px_-28px_rgba(217,70,239,0.8)]">
                    <div className="gratitude-letter-shimmer absolute inset-0 pointer-events-none" />
                    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-400/15 blur-2xl" />
                    <Crown className="gratitude-float absolute right-6 top-5 h-5 w-5 text-amber-400/70" />
                    <Star className="gratitude-float gratitude-float-delay absolute left-[14%] top-6 h-3.5 w-3.5 fill-fuchsia-400/50 text-fuchsia-400/70" />
                    <Sparkles className="gratitude-float gratitude-float-delay-2 absolute bottom-12 right-7 h-4 w-4 text-violet-400/70" />
                    <CardContent className="relative space-y-5 p-5 pt-7">
                      <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar
                            user={{ name: recipientName, initials: initialsForUsername(recipientName), color: colorForId(shoutout.recipient_id) }}
                            photoUrl={shoutout.recipient?.avatar_url}
                            border={shoutout.recipient?.active_border}
                            accessory={shoutout.recipient?.active_accessory}
                            className="h-12 w-12 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">MVP Shoutout</p>
                            <h3 className="truncate text-lg font-black">@{recipientName} got the spotlight</h3>
                            {shoutout.recipient?.department && <p className="text-xs text-muted-foreground">{shoutout.recipient.department}</p>}
                          </div>
                        </div>
                        {canDelete && <button onClick={() => window.confirm("Remove this MVP shoutout?") && remove.mutate(shoutout.id)} className="rounded-lg p-1.5 text-muted-foreground opacity-50 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100" aria-label="Delete shoutout"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                      <div className="relative rounded-2xl border border-violet-500/15 bg-background/40 px-4 py-5 shadow-inner">
                        <Megaphone className="absolute -left-2 -top-2 h-6 w-6 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 p-1 text-white shadow-lg" />
                        <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">{shoutout.message}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-amber-400/15 pt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span className="gratitude-seal grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400 text-white shadow-lg"><Trophy className="h-3.5 w-3.5" /></span>
                          Shouted out by <strong className="text-foreground">@{senderName}</strong>
                        </span>
                        <span>{formatDistanceToNow(new Date(shoutout.created_at), { addSuffix: true })}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
