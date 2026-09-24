import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { PageTransition } from "@/components/animations";
import { UserAvatar } from "@/components/user-avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Send, Search, ArrowLeft, MessageSquare, Trash2 } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import {
  useConversations,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useStartConversation,
  useMarkConversationRead,
  otherParticipant,
  type Conversation,
} from "@/hooks/use-dm";
import { useDirectory } from "@/hooks/use-mentors";
import { cn } from "@/lib/utils";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-storage";

const dmDraftKey = (conversationId: string) => `c9myr:dm-draft:${conversationId}`;

export default function Messages() {
  const { session } = useAuth();
  const { data: conversations = [], isLoading, unreadCounts } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  if (!session) {
    return (
      <PageTransition className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="p-8 text-center bg-muted/30 border border-dashed rounded-2xl text-muted-foreground">
          Sign in to send and receive messages.
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1">Direct, just between you two.</p>
        </div>
        <NewMessageDialog onStarted={setSelectedId} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden" style={{ height: "min(70vh, 640px)" }}>
        <div className="flex h-full">
          {}
          <div className={cn("w-full md:w-80 shrink-0 border-r border-border overflow-y-auto", selected && "hidden md:block")}>
            {isLoading ? (
              <div className="p-8 flex justify-center"><div className="animate-pulse w-6 h-6 rounded-full bg-primary/20" /></div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No conversations yet. Start one with the button above.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.map((c) => {
                  const other = otherParticipant(c, session.user.id);
                  const unread = unreadCounts[c.id] ?? 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                        selectedId === c.id && "bg-muted/60"
                      )}
                    >
                      <UserAvatar
                        user={{ initials: initialsForUsername(other?.username ?? "?"), color: colorForId(other?.id ?? c.id), name: other?.username ?? "?" }}
                        photoUrl={other?.avatar_url}
                        border={other?.active_border}
                        accessory={other?.active_accessory}
                        className="w-9 h-9 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">@{other?.username ?? "unknown"}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      {unread > 0 && (
                        <span className="w-[18px] h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {}
          <div className={cn("flex-1 min-w-0 flex flex-col", !selected && "hidden md:flex")}>
            {selected ? (
              <ConversationThread conversation={selected} onBack={() => setSelectedId(null)} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <MessageSquare className="w-10 h-10 opacity-30" />
                <p className="text-sm">Pick a conversation, or start a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function ConversationThread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { session } = useAuth();
  const other = otherParticipant(conversation, session?.user.id);
  const { data: messages = [] } = useMessages(conversation.id);
  const sendMessage = useSendMessage(conversation.id);
  const deleteMessage = useDeleteMessage(conversation.id);
  const markRead = useMarkConversationRead();
  const [text, setText] = useState(() => loadDraft<string>(dmDraftKey(conversation.id)) ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (markedRef.current === conversation.id)
      return;
    markedRef.current = conversation.id;
    markRead.mutate(conversation.id);
  }, [conversation.id]);

  useEffect(() => {
    setText(loadDraft<string>(dmDraftKey(conversation.id)) ?? "");
  }, [conversation.id]);

  useEffect(() => {
    if (text.trim()) saveDraft(dmDraftKey(conversation.id), text);
    else clearDraft(dmDraftKey(conversation.id));
  }, [text, conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage.mutate(text.trim(), { onSuccess: () => { setText(""); clearDraft(dmDraftKey(conversation.id)); } });
  };

  return (
    <>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <UserAvatar
          user={{ initials: initialsForUsername(other?.username ?? "?"), color: colorForId(other?.id ?? conversation.id), name: other?.username ?? "?" }}
          photoUrl={other?.avatar_url}
          border={other?.active_border}
          accessory={other?.active_accessory}
          className="w-8 h-8 shrink-0"
        />
        <span className="font-semibold text-sm">@{other?.username ?? "unknown"}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === session?.user.id;
          return (
            <div key={m.id} className={cn("group flex items-center gap-1.5", mine ? "justify-end" : "justify-start")}>
              {mine && (
                <button
                  onClick={() => window.confirm("Delete this message?") && deleteMessage.mutate(m.id)}
                  disabled={deleteMessage.isPending}
                  title="Delete message"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div className={cn("max-w-[75%] rounded-2xl px-3 py-2", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
                <p className={cn("text-[10px] mt-0.5", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {format(new Date(m.created_at), "h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-border shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          className="flex-1 h-10 rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={!text.trim() || sendMessage.isPending}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </>
  );
}

function NewMessageDialog({ onStarted }: { onStarted: (conversationId: string) => void }) {
  const { data: directory = [] } = useDirectory();
  const { session } = useAuth();
  const startConversation = useStartConversation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory.filter((p) => p.id !== session?.user.id && (!q || p.username.toLowerCase().includes(q)));
  }, [directory, search, session?.user.id]);

  const handlePick = (userId: string) => {
    startConversation.mutate(userId, {
      onSuccess: (conversationId) => {
        onStarted(conversationId);
        setIsOpen(false);
        setSearch("");
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="shrink-0">
          <MessageSquarePlus className="w-4 h-4 mr-2" /> New Message
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find someone..."
              autoFocus
              className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No one matches "{search}".</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePick(p.id)}
                  disabled={startConversation.isPending}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left disabled:opacity-50"
                >
                  <UserAvatar
                    user={{ initials: initialsForUsername(p.username), color: colorForId(p.id), name: p.username }}
                    photoUrl={p.avatar_url}
                    border={p.active_border}
                    accessory={p.active_accessory}
                    className="w-8 h-8 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">@{p.username}</div>
                    {p.role && <div className="text-[10px] text-muted-foreground">{p.role}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
          {startConversation.isError && (
            <p className="text-xs text-destructive">Couldn't start that conversation. Try again.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
