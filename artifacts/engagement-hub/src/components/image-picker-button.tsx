import { useRef, useState } from "react";
import { Camera, ClipboardPaste, Plus } from "lucide-react";
import { imageFromClipboard } from "@/lib/clipboard-image";
import { cn } from "@/lib/utils";

export function ImagePickerButton(
  {
    onImage,
    className,
    label = "Upload a photo",
    disabled = false,
    iconOnly = false,
  }: {
    onImage: (file: File) => void;
    className?: string;
    label?: string;
    disabled?: boolean;
    iconOnly?: boolean;
  }
) {
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

  if (iconOnly) {
    return (
      <div
        className={cn(
          "flex flex-col w-10 h-10 rounded-xl overflow-hidden border-2 border-dashed transition-colors shrink-0",
          disabled ? "opacity-50 border-border" : armed ? "border-primary" : "border-border/60",
          className
        )}
      >
        <div
          {...pasteZone}
          title={armed ? "Ready — press Ctrl+V, or drop an image" : "Paste an image (Ctrl+V), or drag one here"}
          className={cn(
            "flex-1 flex items-center justify-center transition-colors select-none",
            disabled
              ? "cursor-not-allowed text-muted-foreground"
              : armed
                ? "cursor-pointer bg-gradient-to-br from-primary/20 to-secondary/15 text-primary"
                : "cursor-pointer text-muted-foreground hover:text-primary hover:bg-muted/40"
          )}
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
        </div>
        <div className="h-px bg-border/60 shrink-0" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          title={label}
          className={cn(
            "flex-1 flex items-center justify-center transition-colors",
            disabled ? "cursor-not-allowed opacity-50 text-muted-foreground" : "cursor-pointer text-muted-foreground hover:text-secondary hover:bg-muted/40"
          )}
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
        {input}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        {...pasteZone}
        className={cn(
          "group flex flex-col items-center justify-center gap-1.5 w-full rounded-xl border-2 border-dashed px-4 py-4 text-center transition-all select-none outline-none",
          disabled
            ? "opacity-50 pointer-events-none border-border"
            : armed
              ? "cursor-pointer border-primary bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent ring-2 ring-primary/15"
              : "cursor-pointer border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/30"
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
            armed ? "bg-gradient-to-br from-primary to-secondary text-white" : "bg-muted text-muted-foreground group-hover:text-primary"
          )}
        >
          <ClipboardPaste className="w-4 h-4" />
        </span>
        <span className={cn("text-xs font-medium", armed ? "text-primary" : "text-muted-foreground")}>
          {armed ? "Ready — press Ctrl+V, or drop it" : "Paste or drag an image here"}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-secondary/20 disabled:opacity-50 disabled:pointer-events-none"
      >
        <Plus className="w-3 h-3" /> {label}
      </button>
      {input}
    </div>
  );
}
