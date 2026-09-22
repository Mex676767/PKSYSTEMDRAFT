import { useState } from "react";
import { useAddComment } from "@/hooks/use-social";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, cn } from "@/lib/utils";
import { Check } from "lucide-react";

const WISH_TEMPLATES = [
  { emoji: "🎉", text: "🎉 Happy Birthday! Hope you have an amazing day!" },
  { emoji: "🎂", text: "🎂 Wishing you all the best on your special day!" },
  { emoji: "🥳", text: "🥳 Have a fantastic birthday!" },
  { emoji: "🎁", text: "🎁 Enjoy your day to the fullest!" },
];

export function SendBirthdayWish({
  birthdayId,
  username,
  dark = false,
  onSent,
}: {
  birthdayId: string;
  username: string;
  dark?: boolean;
  onSent?: () => void;
}) {
  const addComment = useAddComment("birthday", birthdayId);
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  const send = (text: string) => {
    addComment.mutate({ body: text }, {
      onSuccess: () => {
        setSent(true);
        toast({ title: "Wishes sent!", description: `You sent birthday wishes to @${username}.` });
        onSent?.();
      },
      onError: (err) => {
        toast({ title: "Couldn't send that", description: getErrorMessage(err), variant: "destructive" });
      },
    });
  };

  if (sent) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", dark ? "text-white" : "text-secondary")}>
        <Check className="w-4 h-4" /> Wishes sent!
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {WISH_TEMPLATES.map((t) => (
        <button
          key={t.text}
          type="button"
          title={t.text}
          disabled={addComment.isPending}
          onClick={() => send(t.text)}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-lg transition-colors disabled:opacity-50",
            dark ? "bg-white/20 hover:bg-white/30" : "bg-muted hover:bg-secondary/20"
          )}
        >
          {t.emoji}
        </button>
      ))}
    </div>
  );
}
