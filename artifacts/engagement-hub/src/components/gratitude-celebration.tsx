import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MailOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confetti } from "@/components/confetti";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useMarkGratitudeSeen, useUnseenGratitude } from "@/hooks/use-gratitude";

export function GratitudeCelebration() {
  const { profile } = useAuth();
  const { data: letters = [], isSuccess } = useUnseenGratitude(Boolean(profile?.is_approved));
  const markSeen = useMarkGratitudeSeen();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isSuccess && letters.length > 0) {
      setIndex(0);
      setOpen(true);
    }
  }, [isSuccess, letters.length]);

  if (letters.length === 0) return null;
  const letter = letters[Math.min(index, letters.length - 1)];
  const senderName = letter.sender?.username ?? "A teammate";
  const isLast = index >= letters.length - 1;

  const finish = () => {
    markSeen.mutate(letters.map((item) => item.id), { onSuccess: () => setOpen(false) });
  };

  return (
    <>
      <Confetti active={open} />
      <Dialog open={open} onOpenChange={(next) => { if (!next) finish(); }}>
        <DialogContent className="overflow-hidden border-pink-500/30 bg-card/95 p-0 shadow-[0_30px_100px_-25px_rgba(236,72,153,0.65)] sm:max-w-lg [&>button.absolute]:hidden">
          <div className="relative overflow-hidden px-6 pb-4 pt-8 text-center">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-pink-500/25 via-orange-400/10 to-transparent" />
            <motion.div
              initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 190, damping: 13 }}
              className="relative mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-xl shadow-pink-500/30"
            >
              <MailOpen className="h-9 w-9" />
              <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-yellow-300" />
            </motion.div>
            <DialogHeader className="relative items-center text-center sm:text-center">
              <div className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-pink-500">Someone appreciates you</div>
              <DialogTitle className="text-2xl">You received a gratitude letter!</DialogTitle>
              <DialogDescription>{letters.length > 1 ? `${index + 1} of ${letters.length} new letters` : "A little thank-you, just for you."}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={letter.id}
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className="rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-orange-400/5 p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <UserAvatar
                    user={{ name: senderName, initials: initialsForUsername(senderName), color: colorForId(letter.sender_id) }}
                    photoUrl={letter.sender?.avatar_url}
                    border={letter.sender?.active_border}
                    accessory={letter.sender?.active_accessory}
                    className="h-10 w-10"
                  />
                  <div><p className="text-xs text-muted-foreground">From</p><p className="font-bold">@{senderName}</p></div>
                </div>
                <p className="whitespace-pre-wrap text-base leading-relaxed">“{letter.message}”</p>
              </motion.div>
            </AnimatePresence>

            <Button
              className="mt-5 h-11 w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white hover:opacity-90"
              disabled={markSeen.isPending}
              onClick={() => isLast ? finish() : setIndex((value) => value + 1)}
            >
              <Heart className="mr-2 h-4 w-4 fill-current" />
              {isLast ? "This made my day" : "Open next letter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
