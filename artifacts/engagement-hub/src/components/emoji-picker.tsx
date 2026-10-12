import { useState } from "react";
import { Smile } from "lucide-react";
import { EMOJI_PICKER_OPTIONS } from "@/hooks/use-social";
import { cn } from "@/lib/utils";

export function EmojiPicker({ onSelect, className, onDark = false }: { onSelect: (emoji: string) => void; className?: string; onDark?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className={cn("relative shrink-0", className)}>
    <button type="button" aria-label="Add emoji" aria-expanded={open} title="Add emoji" onClick={() => setOpen((value) => !value)}
      className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-colors", onDark ? "text-white/80 hover:bg-white/10" : "text-muted-foreground hover:bg-muted")}>
      <Smile className="w-4 h-4" />
    </button>
    {open && <div className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-lg border border-border bg-card p-2 shadow-lg" role="group" aria-label="Choose an emoji">
      <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto">{EMOJI_PICKER_OPTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => { onSelect(emoji); setOpen(false); }} className="rounded p-1.5 text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Add ${emoji}`}>{emoji}</button>)}</div>
    </div>}
  </div>;
}
