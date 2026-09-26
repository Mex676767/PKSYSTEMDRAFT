import { useMemo, useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, Mail, Send, Sparkles, Trash2 } from "lucide-react";
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
  const { data: letters = [], isLoading, error } = useGratitudeLetters();
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
    <PageTransition className="mx-auto max-w-5xl space-y-7 p-4 md:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-pink-500/25 bg-gradient-to-br from-pink-500/15 via-card to-orange-400/10 p-6 md:p-8">
        <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/20">
            <Mail className="h-8 w-8" />
          </div>
          <div>
            <Badge className="mb-2 border-pink-400/30 bg-pink-500/15 text-pink-700 hover:bg-pink-500/15 dark:text-pink-200"><Sparkles className="mr-1 h-3 w-3" />Make someone’s day</Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Gratitude</h1>
            <p className="mt-1 text-muted-foreground">Send a public thank-you letter to someone who helped, supported, or inspired you.</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-pink-500/25">
        <CardContent className="p-0">
          <div className="border-b bg-pink-500/5 px-5 py-4">
            <h2 className="font-bold">Write a thank-you letter</h2>
            <p className="text-sm text-muted-foreground">They’ll get a special surprise the next time they open the Hub.</p>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
            <SearchableSelect
              value={recipientId}
              onValueChange={setRecipientId}
              options={people}
              placeholder="Who do you want to thank?"
              searchPlaceholder="Search teammates..."
            />
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell them what they did and why it mattered to you..."
              maxLength={2000}
              className="min-h-32 resize-y"
              required
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">This letter will be visible to everyone in the company.</p>
              <Button type="submit" disabled={!recipientId || !message.trim() || send.isPending} className="bg-gradient-to-r from-pink-500 to-orange-400 text-white hover:opacity-90">
                <Send className="mr-2 h-4 w-4" />{send.isPending ? "Sending..." : "Send gratitude"}
              </Button>
            </div>
            {sent && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">Sent! They’ll see your surprise when they open the Hub.</p>}
            {send.isError && <p className="text-sm text-destructive">Could not send this letter. The new database migration may still need to be applied.</p>}
          </form>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-xl font-bold">Wall of thanks</h2><p className="text-sm text-muted-foreground">Good work deserves to be seen.</p></div>
          <Badge variant="secondary">{letters.length} letter{letters.length === 1 ? "" : "s"}</Badge>
        </div>

        {error ? (
          <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-5 text-sm text-amber-800 dark:text-amber-200">Gratitude is not ready yet. Apply migration <strong>0052_learning_hub_and_gratitude.sql</strong> to this organisation’s Supabase project.</CardContent></Card>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2"><div className="h-52 animate-pulse rounded-2xl bg-muted" /><div className="h-52 animate-pulse rounded-2xl bg-muted" /></div>
        ) : letters.length === 0 ? (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><div className="mb-4 rounded-full bg-pink-500/10 p-4 text-pink-500"><Heart className="h-7 w-7" /></div><h3 className="font-bold">No letters yet</h3><p className="mt-1 text-sm text-muted-foreground">Send the first thank-you and start the wall.</p></CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {letters.map((letter) => {
              const senderName = letter.sender?.username ?? "Someone";
              const recipientName = letter.recipient?.username ?? "teammate";
              const canDelete = isAdmin || letter.sender_id === session?.user.id;
              return (
                <Card key={letter.id} className="group relative overflow-hidden border-pink-500/20 bg-gradient-to-br from-card to-pink-500/5">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-pink-500/10 blur-2xl" />
                  <CardContent className="relative space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          user={{ name: recipientName, initials: initialsForUsername(recipientName), color: colorForId(letter.recipient_id) }}
                          photoUrl={letter.recipient?.avatar_url}
                          border={letter.recipient?.active_border}
                          accessory={letter.recipient?.active_accessory}
                          className="h-12 w-12 shrink-0"
                        />
                        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-500">Thank you</p><h3 className="truncate text-lg font-bold">@{recipientName}</h3></div>
                      </div>
                      {canDelete && <button onClick={() => window.confirm("Remove this gratitude letter?") && remove.mutate(letter.id)} className="rounded-lg p-1.5 text-muted-foreground opacity-50 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100" aria-label="Delete gratitude letter"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">“{letter.message}”</p>
                    <div className="flex items-center justify-between gap-3 border-t border-pink-500/15 pt-3 text-xs text-muted-foreground">
                      <span>From <strong className="text-foreground">@{senderName}</strong></span>
                      <span>{formatDistanceToNow(new Date(letter.created_at), { addSuffix: true })}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
