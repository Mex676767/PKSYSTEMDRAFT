import { useRef, useState } from "react";
import { Camera, ClipboardPaste, Plus } from "lucide-react";
import { imageFromClipboard } from "@/lib/clipboard-image";
import { cn } from "@/lib/utils";

// Two distinct zones instead of one dual-purpose control: a dashed dropzone
// on top that's just for paste (click it, or focus it, then Ctrl+V -- also
// accepts a real drag-and-drop) and a separate "+ <label>" link below it for
// browsing to a file. Modeled on the classic "Paste or drag files here / +
// Upload local files" attachment widget, so each action has its own obvious
// target instead of one element quietly doing both.
export function ImagePickerButton({
  onImage,
  className,
  compact = false,
  label = "Upload a photo",
  disabled = false,
}: {
  onImage: (file: File) => void;
  className?: string;
  compact?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const armed = !disabled && (focused || dragOver);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) onImage(file);
  };

  const pasteZone = {
    tabIndex: disabled ? -1 : 0,
    role: "button" as const,
    "aria-disabled": disabled,
    "aria-label": "Paste an image from the clipboard, or drag one in",
    onFocus: () => !disabled && setFocused(true),
    onBlur: () => setFocused(false),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop,
    onPaste: (e: React.ClipboardEvent) => {
      if (disabled) return;
      const file = imageFromClipboard(e);
      if (file) {
        e.preventDefault();
        onImage(file);
      }
    },
  };

  const input = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      disabled={disabled}
      onChange={handleFileChange}
    />
  );

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-col shrink-0 w-14 h-14 rounded-lg border-2 border-dashed overflow-hidden transition-colors outline-none",
          disabled ? "opacity-50" : "",
          armed ? "border-primary" : "border-border",
          className
        )}
      >
        <div
          {...pasteZone}
          title={armed ? "Ready — press Ctrl+V, or drop an image" : "Paste an image (Ctrl+V), or drag one here"}
          className={cn(
            "flex-1 flex items-center justify-center transition-colors select-none",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
            armed ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <ClipboardPaste className="w-4 h-4" />
        </div>
        <div className="h-px bg-border shrink-0" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          title={label}
          className={cn(
            "flex-1 flex items-center justify-center transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          )}
        >
          <Camera className="w-4 h-4" />
        </button>
        {input}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        {...pasteZone}
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-xs text-center transition-colors select-none outline-none",
          disabled ? "opacity-50 pointer-events-none" : "cursor-pointer",
          armed ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
        )}
      >
        {armed ? "Ready — press Ctrl+V, or drop it" : "Paste or drag an image here"}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline mx-auto"
      >
        <Plus className="w-3 h-3" /> {label}
      </button>
      {input}
    </div>
  );
}
