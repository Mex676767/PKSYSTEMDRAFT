import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { imageFromClipboard } from "@/lib/clipboard-image";
import { cn } from "@/lib/utils";

// An explicit, visibly-labeled target for clipboard image pastes -- click it
// to focus (it turns primary-colored and says "Ready"), then Ctrl+V. Plain
// onPaste handlers on a textarea/dialog work but give the user no visual cue
// that pasting is even possible; this makes the affordance obvious.
export function PasteImageBox({
  onImage,
  className,
  label = "Click here, then paste (Ctrl+V)",
}: {
  onImage: (file: File) => void;
  className?: string;
  label?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label="Paste an image from the clipboard"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPaste={(e) => {
        const file = imageFromClipboard(e);
        if (file) {
          e.preventDefault();
          onImage(file);
        }
      }}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 text-xs font-medium transition-colors outline-none cursor-pointer select-none",
        focused
          ? "border-primary text-primary bg-primary/5"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
        className
      )}
    >
      <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
      {focused ? "Ready — press Ctrl+V" : label}
    </div>
  );
}
