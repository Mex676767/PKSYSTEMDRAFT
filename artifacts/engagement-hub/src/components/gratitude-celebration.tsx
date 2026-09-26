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
        <DialogContent className="gratitude-popup overflow-hidden border-pink-400/40 bg-card/95 p-0 shadow-[0_0_90px_-15px_rgba(236,72,153,0.8)] sm:max-w-lg [&>button.absolute]:hidden">
          <div className="relative overflow-hidden px-6 pb-4 pt-8 text-center">
            <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-pink-500/35 via-orange-400/15 to-transparent" />
            <motion.div
              className="absolute left-1/2 top-10 h-44 w-44 -translate-x-1/2 rounded-full border border-pink-300/30"
              animate={{ scale: [0.7, 1.35], opacity: [0.65, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="absolute left-1/2 top-10 h-44 w-44 -translate-x-1/2 rounded-full border border-orange-300/25"
              animate={{ scale: [0.7, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, delay: 0.7, ease: "easeOut" }}
            />
            {[[-92, 18], [92, 22], [-122, 92], [120, 98]].map(([x, y], sparkleIndex) => (
              <motion.span
                key={`${letter.id}-sparkle-${sparkleIndex}`}
                className="absolute left-1/2 top-6 text-pink-300 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]"
                style={{ marginLeft: x, marginTop: y }}
                animate={{ y: [0, -12, 0], scale: [0.75, 1.25, 0.75], opacity: [0.35, 1, 0.35], rotate: [0, 30, 0] }}
                transition={{ duration: 2 + sparkleIndex * 0.25, repeat: Infinity, delay: sparkleIndex * 0.18 }}
              >
                {sparkleIndex % 2 === 0 ? "✦" : "♥"}
              </motion.span>
            ))}
            <motion.div
              initial={{ scale: 0.25, rotate: -22, y: 50, opacity: 0 }}
              animate={{ scale: [0.25, 1.12, 1], rotate: [-22, 6, 0], y: [50, -8, 0], opacity: 1 }}
              transition={{ duration: 0.9, times: [0, 0.72, 1], ease: "easeOut" }}
              className="relative mx-auto mb-4 grid h-24 w-24 place-items-center rounded-[1.75rem] bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-white shadow-[0_18px_50px_-12px_rgba(236,72,153,0.85)]"
            >
              <motion.div animate={{ rotateY: [0, 180, 180] }} transition={{ duration: 1.1, delay: 0.25, times: [0, 0.55, 1] }}>
                <MailOpen className="h-11 w-11" />
              </motion.div>
              <Sparkles className="absolute -right-2 -top-2 h-7 w-7 text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
              <Heart className="gratitude-heartbeat absolute -bottom-2 -left-2 h-7 w-7 fill-pink-200 text-pink-200 drop-shadow-[0_0_8px_rgba(251,207,232,0.8)]" />
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
                initial={{ y: 45, opacity: 0, rotateX: -18, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ delay: 0.18, type: "spring", stiffness: 145, damping: 16 }}
                className="gratitude-open-letter relative overflow-hidden rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/12 via-background/90 to-orange-400/10 p-5 shadow-[0_15px_45px_-30px_rgba(236,72,153,0.9)]"
              >
                <div className="gratitude-letter-shimmer absolute inset-0 pointer-events-none" />
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
                <p className="relative whitespace-pre-wrap font-serif text-[17px] italic leading-relaxed">“{letter.message}”</p>
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
