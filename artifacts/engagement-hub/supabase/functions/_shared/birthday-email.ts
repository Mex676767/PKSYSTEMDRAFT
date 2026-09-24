// Pure helpers for the birthday emails (no Deno or network APIs, so they can
// be tested in Node too).

export type TemplateValues = { names?: string; name?: string; date: string; site_url: string };

export function fillTemplate(template: string, v: TemplateValues): string {
  return template
    .replaceAll("{{names}}", v.names ?? v.name ?? "")
    .replaceAll("{{name}}", v.name ?? v.names ?? "")
    .replaceAll("{{date}}", v.date)
    .replaceAll("{{site_url}}", v.site_url.replace(/\/+$/, ""));
}

/** ["@a"] -> "@a"; ["@a","@b"] -> "@a and @b"; ["@a","@b","@c"] -> "@a, @b and @c" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The admin writes plain text; send it as-is plus a simple HTML version with clickable links. */
export function textToHtml(text: string): string {
  const body = escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#db2777">${url}</a>`)
    .replace(/\n/g, "<br>");
  return `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f2e;max-width:560px">${body}</div>`;
}

export type LocalDate = { year: number; month: number; day: number; hour: number };

/** Current date and hour in an IANA timezone, e.g. Asia/Kuala_Lumpur. */
export function localNow(timezone: string, now = new Date()): LocalDate {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour };
}

export function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** birthday is "YYYY-MM-DD". 29 Feb birthdays are celebrated on 28 Feb in non-leap years. */
export function isBirthdayOn(birthday: string, d: LocalDate): boolean {
  const [, m, day] = birthday.split("-").map(Number);
  if (m === d.month && day === d.day) return true;
  return m === 2 && day === 29 && !isLeapYear(d.year) && d.month === 2 && d.day === 28;
}

export function isoDate(d: LocalDate) {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

export function prettyDate(d: LocalDate) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d.day} ${months[d.month - 1]}`;
}
