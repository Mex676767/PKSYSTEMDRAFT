import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// A fully custom calendar popover, not <input type="date"> -- the native
// picker's popup grid is OS/browser chrome with no CSS styling hook in any
// browser, so it can never actually match the app's theme. Ported from the
// Test-1 project's D.O.B. picker (same day-grid math, month/year nav, and
// today/selected states), rebuilt in React + our design tokens.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const keyFor = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const navBtnClass =
  "shrink-0 w-6 h-6 flex items-center justify-center rounded-md border border-input text-muted-foreground text-xs hover:border-primary hover:text-primary transition-colors";

function formatDisplay(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Builds exactly 6 rows (42 cells) so the grid is always the same height --
// leading/trailing cells spill into the adjacent month, shown dimmed but
// still clickable.
function buildDays(year: number, month: number) {
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // 0=Mon..6=Sun
  const daysInThisMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevY = month === 0 ? year - 1 : year;
  const prevM = month === 0 ? 11 : month - 1;
  const nextY = month === 11 ? year + 1 : year;
  const nextM = month === 11 ? 0 : month + 1;
  const cells: { y: number; m: number; day: number; otherMonth: boolean }[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ y: prevY, m: prevM, day: daysInPrevMonth - firstWeekday + i + 1, otherMonth: true });
  }
  for (let d = 1; d <= daysInThisMonth; d++) cells.push({ y: year, m: month, day: d, otherMonth: false });
  let nextDay = 1;
  while (cells.length < 42) cells.push({ y: nextY, m: nextM, day: nextDay++, otherMonth: true });
  return cells;
}

export function DatePicker({
  value,
  onChange,
  onClear,
  maxDate,
  minDate,
  placeholder = "dd/mm/yyyy",
  className,
}: {
  value: string | null;
  onChange: (date: string) => void;
  onClear?: () => void;
  /** YYYY-MM-DD -- days after this are shown but not selectable. */
  maxDate?: string;
  /** YYYY-MM-DD -- days before this are shown but not selectable. */
  minDate?: string;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [isOpen]);

  const today = new Date();
  const todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();
  const cells = buildDays(view.year, view.month);
  const rows = [0, 1, 2, 3, 4, 5].map((r) => cells.slice(r * 7, r * 7 + 7));
  const maxDateObj = maxDate ? new Date(maxDate + "T23:59:59") : null;
  const minDateObj = minDate ? new Date(minDate + "T00:00:00") : null;

  const navMonth = (dir: number) => {
    let { year, month } = view;
    month += dir;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    setView({ year, month });
  };
  const navYear = (dir: number) => setView((v) => ({ year: v.year + dir, month: v.month }));

  const select = (key: string) => {
    onChange(key);
    const [y, m] = key.split("-").map(Number);
    setView({ year: y, month: m - 1 });
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm"
      >
        <span className={cn(!value && "text-muted-foreground")}>{value ? formatDisplay(value) : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1.5 w-64 rounded-lg border border-border bg-card p-2.5 shadow-lg">
          <div className="flex items-center gap-1 mb-2">
            <button type="button" onClick={() => navYear(-1)} title="Previous year" className={navBtnClass}>«</button>
            <button type="button" onClick={() => navMonth(-1)} title="Previous month" className={navBtnClass}>‹</button>
            <span className="flex-1 text-center text-xs font-semibold">{MONTH_NAMES[view.month]} {view.year}</span>
            <button type="button" onClick={() => navMonth(1)} title="Next month" className={navBtnClass}>›</button>
            <button type="button" onClick={() => navYear(1)} title="Next year" className={navBtnClass}>»</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
            {WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {rows.flatMap((row, ri) =>
              row.map((cell, ci) => {
                const key = keyFor(cell.y, cell.m, cell.day);
                const isToday = cell.y === todayY && cell.m === todayM && cell.day === todayD;
                const isSelected = value === key;
                const cellDate = new Date(cell.y, cell.m, cell.day);
                const disabled = (maxDateObj ? cellDate > maxDateObj : false) || (minDateObj ? cellDate < minDateObj : false);
                return (
                  <button
                    key={`${ri}-${ci}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => select(key)}
                    className={cn(
                      "rounded-md py-1.5 text-xs tabular-nums transition-colors",
                      cell.otherMonth ? "text-muted-foreground/50" : "text-foreground",
                      isToday && !isSelected && "text-primary font-semibold",
                      isSelected && "bg-primary text-primary-foreground font-semibold",
                      !isSelected && !disabled && "hover:bg-muted",
                      disabled && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })
            )}
          </div>
          {onClear && (
            <div className="flex justify-end mt-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => { onClear(); setIsOpen(false); }}
                className="text-xs text-primary hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
