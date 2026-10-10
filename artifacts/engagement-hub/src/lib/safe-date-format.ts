import { format } from "date-fns";

/** Format untrusted or imported date values without allowing one bad row to crash a page. */
export function safeFormatDate(value: string | Date | null | undefined, pattern: string, fallback = "Date needs review") {
  if (value == null || value === "") return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return format(date, pattern);
}
