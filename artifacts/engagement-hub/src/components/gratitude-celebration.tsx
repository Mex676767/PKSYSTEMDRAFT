import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Confetti } from "@/components/confetti";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useMarkGratitudeSeen, useUnseenGratitude } from "@/hooks/use-gratitude";

export function GratitudeCelebration() {
  const { profile } = useAuth();
  const { data: shoutouts = [], isSuccess } = useUnseenGratitude(Boolean(profile?.is_approved));
  const markSeen = useMarkGratitudeSeen();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isSuccess && shoutouts.length > 0) {
      setIndex(0);
      setOpen(true);
    }
  }, [isSuccess, shoutouts.length]);

  if (shoutouts.length === 0) return null;
  const shoutout = shoutouts[Math.min(index, shoutouts.length - 1)];
  const senderName = shoutout.sender?.username ?? "A teammate";
  const isLast = index >= shoutouts.length - 1;

  const finish = () => {
    markSeen.mutate(shoutouts.map((item) => item.id), { onSuccess: () => setOpen(false) });
  };

  return (
    <>
      <Confetti active={open} />
      <Dialog open={open} onOpenChange={(next) => { if (!next) finish(); }}>
        <DialogContent className="gratitude-popup overflow-hidden border-amber-400/40 bg-card/95 p-0 shadow-[0_0_100px_-15px_rgba(217,70,239,0.75)] sm:max-w-lg [&>button.absolute]:hidden">
          <div className="relative overflow-hidden px-6 pb-4 pt-8 text-center">
            <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-violet-600/35 via-fuchsia-500/18 to-transparent" />
            <motion.div
              className="absolute left-1/2 top-10 h-44 w-44 -translate-x-1/2 rounded-full border border-amber-300/35"
              animate={{ scale: [0.7, 1.35], opacity: [0.7, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="absolute left-1/2 top-10 h-44 w-44 -translate-x-1/2 rounded-full border border-fuchsia-300/30"
              animate={{ scale: [0.7, 1.5], opacity: [0.55, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, delay: 0.7, ease: "easeOut" }}
            />
            {[[-92, 18], [92, 22], [-122, 92], [120, 98]].map(([x, y], sparkleIndex) => (
              <motion.span
                key={`${shoutout.id}-sparkle-${sparkleIndex}`}
                className="absolute left-1/2 top-6 text-amber-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]"
                style={{ marginLeft: x, marginTop: y }}
                animate={{ y: [0, -12, 0], scale: [0.75, 1.25, 0.75], opacity: [0.35, 1, 0.35], rotate: [0, 30, 0] }}
                transition={{ duration: 2 + sparkleIndex * 0.25, repeat: Infinity, delay: sparkleIndex * 0.18 }}
              >
                {sparkleIndex % 2 === 0 ? "✦" : "★"}
              </motion.span>
            ))}
            <motion.div
              initial={{ scale: 0.25, rotate: -22, y: 50, opacity: 0 }}
              animate={{ scale: [0.25, 1.15, 1], rotate: [-22, 7, 0], y: [50, -8, 0], opacity: 1 }}
              transition={{ duration: 0.9, times: [0, 0.72, 1], ease: "easeOut" }}
              className="relative mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400 text-white shadow-[0_18px_55px_-10px_rgba(217,70,239,0.85)]"
            >
              <motion.div animate={{ rotate: [-8, 8, -4, 0], scale: [0.8, 1.12, 1] }} transition={{ duration: 1.1, delay: 0.15 }}>
                <Trophy className="h-11 w-11" />
              </motion.div>
              <Crown className="absolute -right-2 -top-3 h-8 w-8 rotate-12 fill-amber-300 text-amber-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
              <Star className="gratitude-heartbeat absolute -bottom-2 -left-2 h-7 w-7 fill-fuchsia-200 text-fuchsia-200 drop-shadow-[0_0_8px_rgba(245,208,254,0.8)]" />
            </motion.div>
            <DialogHeader className="relative items-center text-center sm:text-center">
              <div className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-amber-500">Your work got noticed</div>
              <DialogTitle className="text-2xl font-black">You just got an MVP shoutout!</DialogTitle>
              <DialogDescription>{shoutouts.length > 1 ? `${index + 1} of ${shoutouts.length} new shoutouts` : "A teammate put you in the spotlight."}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={shoutout.id}
                initial={{ y: 45, opacity: 0, rotateX: -18, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ delay: 0.18, type: "spring", stiffness: 145, damping: 16 }}
                className="gratitude-open-letter relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-violet-500/12 via-background/90 to-amber-400/10 p-5 shadow-[0_15px_45px_-30px_rgba(217,70,239,0.9)]"
              >
                <div className="gratitude-letter-shimmer absolute inset-0 pointer-events-none" />
                <div className="mb-4 flex items-center gap-3">
                  <UserAvatar
                    user={{ name: senderName, initials: initialsForUsername(senderName), color: colorForId(shoutout.sender_id) }}
                    photoUrl={shoutout.sender?.avatar_url}
                    border={shoutout.sender?.active_border}
                    accessory={shoutout.sender?.active_accessory}
                    className="h-10 w-10"
                  />
                  <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-500">Shoutout from</p><p className="font-bold">@{senderName}</p></div>
                </div>
                <p className="relative whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{shoutout.message}</p>
              </motion.div>
            </AnimatePresence>

            <Button
              className="mt-5 h-11 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-400 text-white hover:opacity-90"
              disabled={markSeen.isPending}
              onClick={() => isLast ? finish() : setIndex((value) => value + 1)}
            >
              <Trophy className="mr-2 h-4 w-4" />
              {isLast ? "Claim the spotlight" : "See next shoutout"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
