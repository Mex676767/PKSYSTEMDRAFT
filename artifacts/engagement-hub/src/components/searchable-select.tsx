import { useMemo, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  /** Second line, e.g. role or department. Also searchable. */
  description?: string;
  /** Shown before the label, e.g. an avatar or icon. */
  leading?: ReactNode;
  /** Extra words that should match a search but aren't shown. */
  keywords?: string[];
  disabled?: boolean;
};

export type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Hide the search box for very short lists (it's shown by default). */
  searchable?: boolean;
  "aria-label"?: string;
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/^@/, "");
}

/**
 * Themed dropdown with a search box, used everywhere instead of native
 * <select>. Type to filter; arrow keys + Enter to pick; Esc to close.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  id,
  disabled,
  className,
  searchable = true,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) =>
      [o.label, o.description ?? "", ...(o.keywords ?? [])].some((t) => normalize(t).includes(q))
    );
  }, [options, query]);

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    }
  };

  const pick = (o: SelectOption | undefined) => {
    if (!o || o.disabled) return;
    onValueChange(o.value);
    setOpen(false);
  };

  const move = (delta: number) => {
    if (filtered.length === 0) return;
    let i = active;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setActive(i);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); pick(filtered[active]); }
  };

  return (
    // modal: keeps scrolling/focus working when the dropdown opens inside a dialog.
    <PopoverPrimitive.Root open={open} onOpenChange={openChange} modal>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm transition-colors",
            "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-primary/60 ring-1 ring-primary/40",
            className
          )}
        >
          {selected?.leading && <span className="shrink-0 flex items-center">{selected.leading}</span>}
          <span className={cn("flex-1 min-w-0 truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            if (!searchable) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>("input")?.focus();
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "z-[100] w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden",
            "rounded-2xl border border-border bg-popover/95 backdrop-blur-xl text-popover-foreground shadow-xl shadow-black/30",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          )}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-[min(18rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain p-1.5"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={i}
                    disabled={o.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                      i === active && "bg-primary/15",
                      isSelected && "text-primary font-semibold",
                      o.disabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {o.leading && <span className="shrink-0 flex items-center">{o.leading}</span>}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.description && <span className="block truncate text-[11px] font-normal text-muted-foreground">{o.description}</span>}
                    </span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
