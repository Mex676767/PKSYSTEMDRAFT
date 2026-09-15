import { useRef, useState } from "react";
import { Camera, ClipboardPaste } from "lucide-react";
import { imageFromClipboard } from "@/lib/clipboard-image";
import { cn } from "@/lib/utils";

// One control for both ways to add an image -- click it to browse for a
// file, or focus it (a click also focuses it) and paste with Ctrl+V. Used to
// be two separate elements side by side (a browse button plus a distinct
// paste box); merged into one so there's a single obvious target instead of
// two competing affordances. The icon swaps to a clipboard glyph and the
// label to "Ready" once focused, so pasting still has a visible cue even
// without the dedicated box.
export function ImagePickerButton({
  onImage,
  className,
  compact = false,
  label = "Add photo",
  disabled = false,
}: {
  onImage: (file: File) => void;
  className?: string;
  compact?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-disabled={disabled}
      aria-label={`${label} -- click to browse for a file, or focus this and paste an image with Ctrl+V`}
      onFocus={() => !disabled && setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => !disabled && fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      onPaste={(e) => {
        if (disabled) return;
        const file = imageFromClipboard(e);
        if (file) {
          e.preventDefault();
          onImage(file);
        }
      }}
      title={disabled ? undefined : focused ? "Ready — press Ctrl+V to paste" : `${label} (or paste with Ctrl+V)`}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed transition-colors outline-none select-none",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        focused
          ? "border-primary text-primary bg-primary/5"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
        compact ? "w-14 h-14 shrink-0" : "h-10 px-3 text-sm font-medium",
        className
      )}
    >
      {focused ? (
        <ClipboardPaste className={compact ? "w-5 h-5" : "w-4 h-4 shrink-0"} />
      ) : (
        <Camera className={compact ? "w-5 h-5" : "w-4 h-4 shrink-0"} />
      )}
      {!compact && <span>{focused ? "Ready — press Ctrl+V" : label}</span>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onImage(file);
        }}
      />
    </div>
  );
}
