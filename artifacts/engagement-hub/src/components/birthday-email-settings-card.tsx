import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Mail, Save, Eye, Pencil, Send, Users, Cake, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/searchable-select";
import {
  BIRTHDAY_EMAIL_PLACEHOLDERS,
  fillBirthdayTemplate,
  useBirthdayEmailLog,
  useBirthdayEmailSettings,
  useSaveBirthdayEmailSettings,
  useSendTestBirthdayEmail,
  type BirthdayEmailKind,
  type BirthdayEmailSettings,
} from "@/hooks/use-birthday-email-settings";
import { cn, getErrorMessage } from "@/lib/utils";
import { BRAND_HUB_NAME } from "@/lib/brand";

type Draft = Omit<BirthdayEmailSettings, "updated_at">;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: format(new Date(2000, 0, 1, h), "h:mm a"),
}));

function timezoneOptions() {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  if (!zones.includes("Asia/Kuala_Lumpur")) zones = ["Asia/Kuala_Lumpur", ...zones];
  return zones.map((z) => ({ value: z, label: z.replaceAll("_", " "), keywords: [z] }));
}

const EMAILS: Record<BirthdayEmailKind, { label: string; icon: typeof Users; enabled: keyof Draft; subject: keyof Draft; body: keyof Draft; to: string; help: string }> = {
  announcement: {
    label: "Team announcement",
    icon: Users,
    enabled: "enabled",
    subject: "subject",
    body: "body",
    to: "every employee",
    help: "Sent to everyone. With the birthday person email on, the birthday people get that one instead.",
  },
  personal: {
    label: "Birthday person",
    icon: Cake,
    enabled: "personal_enabled",
    subject: "personal_subject",
    body: "personal_body",
    to: "the birthday person",
    help: "A personal birthday email to each person celebrating that day.",
  },
};

export function BirthdayEmailSettingsCard() {
  const { data: settings, isLoading, error: loadError } = useBirthdayEmailSettings(true);
  const { data: log = [] } = useBirthdayEmailLog(true);
  const save = useSaveBirthdayEmailSettings();
  const test = useSendTestBirthdayEmail();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [kind, setKind] = useState<BirthdayEmailKind>("announcement");
  const [preview, setPreview] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const zones = useMemo(timezoneOptions, []);
  const hubUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
  const migrated = !!settings && typeof settings.personal_subject === "string";

  useEffect(() => {
    if (settings && migrated && !draft) {
      const { updated_at: _updatedAt, ...rest } = settings as BirthdayEmailSettings;
      setDraft(rest);
    }
  }, [settings, migrated, draft]);

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 flex justify-center">
          <div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" />
        </CardContent>
      </Card>
    );
  }

  if (loadError || !settings || !migrated || !draft) {
    return (
      <Card className="shadow-sm border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Birthday email settings need a database update. Run migration{" "}
          <code>{settings ? "0024_birthday_emails" : "0014_birthday_email_settings and 0024_birthday_emails"}</code> in
          Supabase, then reload this page.
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSavedAt(null);
  };

  const e = EMAILS[kind];
  const fromEmailValid = draft.from_email.trim() === "" || EMAIL_PATTERN.test(draft.from_email.trim());
  const replyToValid = draft.reply_to.trim() === "" || EMAIL_PATTERN.test(draft.reply_to.trim());
  const hasSender = EMAIL_PATTERN.test(draft.from_email.trim());
  const complete = (k: BirthdayEmailKind) =>
    String(draft[EMAILS[k].subject]).trim() !== "" && String(draft[EMAILS[k].body]).trim() !== "";
  const invalidEnabled = (["announcement", "personal"] as const).filter((k) => draft[EMAILS[k].enabled] && (!hasSender || !complete(k)));
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== (settings as BirthdayEmailSettings)[k]);
  const canSave = dirty && fromEmailValid && replyToValid && invalidEnabled.length === 0 && !save.isPending;

  const siteUrl = draft.site_url.trim() || hubUrl;
  const sample = { names: "@aldo and @max", name: "@bella", date: format(new Date(), "d MMMM"), site_url: siteUrl };

  const onSave = () =>
    save.mutate(
      {
        ...draft,
        from_name: draft.from_name.trim(),
        from_email: draft.from_email.trim(),
        reply_to: draft.reply_to.trim(),
        site_url: siteUrl.replace(/\/+$/, ""),
      },
      { onSuccess: () => setSavedAt(Date.now()) }
    );

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Birthday Emails</h2>
            <p className="text-xs text-muted-foreground">
              Sent automatically on each birthday at the time below. Nothing is sent until an email is switched on and a
              sender is set up (verified domain + Resend key, see <code>supabase/BIRTHDAY-EMAILS.md</code>).
            </p>
          </div>
        </div>

        {/* Sender */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bday-from-name">Sender name</Label>
            <Input id="bday-from-name" value={draft.from_name} onChange={(ev) => set("from_name", ev.target.value)} placeholder={BRAND_HUB_NAME} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-from-email">Sender email</Label>
            <Input
              id="bday-from-email"
              type="email"
              value={draft.from_email}
              onChange={(ev) => set("from_email", ev.target.value)}
              placeholder="hub@yourcompany.com"
              className={cn(!fromEmailValid && "border-destructive focus-visible:ring-destructive")}
            />
            {!fromEmailValid && <p className="text-[11px] text-destructive">That doesn't look like an email address.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-reply-to">Reply-to <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="bday-reply-to"
              type="email"
              value={draft.reply_to}
              onChange={(ev) => set("reply_to", ev.target.value)}
              placeholder="hr@yourcompany.com"
              className={cn(!replyToValid && "border-destructive focus-visible:ring-destructive")}
            />
            {!replyToValid && <p className="text-[11px] text-destructive">That doesn't look like an email address.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-site">Link to the hub</Label>
            <Input id="bday-site" value={draft.site_url} onChange={(ev) => set("site_url", ev.target.value)} placeholder={hubUrl} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-hour">Send at</Label>
            <SearchableSelect
              id="bday-hour"
              value={String(draft.send_hour)}
              onValueChange={(v) => set("send_hour", Number(v))}
              options={HOUR_OPTIONS}
              searchPlaceholder="Search times..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-tz">Time zone</Label>
            <SearchableSelect
              id="bday-tz"
              value={draft.timezone}
              onValueChange={(v) => set("timezone", v)}
              options={zones}
              searchPlaceholder="Search time zones..."
            />
          </div>
        </div>

        {/* Which email */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EMAILS) as BirthdayEmailKind[]).map((k) => {
            const Icon = EMAILS[k].icon;
            const on = draft[EMAILS[k].enabled] as boolean;
            return (
              <button
                key={k}
                type="button"
                onClick={() => { setKind(k); setPreview(false); test.reset(); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  kind === k ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {EMAILS[k].label}
                <span className={cn("ml-0.5 text-[10px] px-1.5 rounded-full", on ? "bg-emerald-500/25 text-emerald-300" : "bg-black/20")}>{on ? "On" : "Off"}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border p-3 md:p-4 space-y-3">
          <div className="flex items-start gap-3">
            <p className="text-xs text-muted-foreground flex-1">{e.help}</p>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor={`bday-${kind}-on`} className="text-xs text-muted-foreground">{draft[e.enabled] ? "On" : "Off"}</Label>
              <Switch
                id={`bday-${kind}-on`}
                checked={draft[e.enabled] as boolean}
                onCheckedChange={(v) => set(e.enabled, v as never)}
                disabled={!(draft[e.enabled] as boolean) && (!hasSender || !complete(kind))}
                title={!hasSender ? "Add a sender email first" : undefined}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Content</span>
            <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
              <button type="button" onClick={() => setPreview(false)} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full", !preview && "bg-primary text-primary-foreground")}>
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button type="button" onClick={() => setPreview(true)} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full", preview && "bg-primary text-primary-foreground")}>
                <Eye className="w-3 h-3" /> Preview
              </button>
            </div>
          </div>

          {preview ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p><span className="font-medium text-foreground">From:</span> {draft.from_name || "(no name)"} &lt;{draft.from_email || "sender not set"}&gt;</p>
                {draft.reply_to && <p><span className="font-medium text-foreground">Reply-to:</span> {draft.reply_to}</p>}
                <p><span className="font-medium text-foreground">To:</span> {e.to}</p>
              </div>
              <p className="font-semibold">{fillBirthdayTemplate(String(draft[e.subject]), sample)}</p>
              <p className="whitespace-pre-wrap break-words">{fillBirthdayTemplate(String(draft[e.body]), sample)}</p>
              <p className="text-[11px] text-muted-foreground">Preview uses sample names ({kind === "personal" ? sample.name : sample.names}).</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`bday-${kind}-subject`}>Subject</Label>
                <Input id={`bday-${kind}-subject`} value={String(draft[e.subject])} onChange={(ev) => set(e.subject, ev.target.value as never)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`bday-${kind}-body`}>Message</Label>
                <Textarea id={`bday-${kind}-body`} value={String(draft[e.body])} onChange={(ev) => set(e.body, ev.target.value as never)} rows={8} className="font-mono text-xs" />
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <span>Placeholders:</span>
                {BIRTHDAY_EMAIL_PLACEHOLDERS[kind].map((p) => (
                  <code key={p.key} title={p.help} className="px-1.5 py-0.5 rounded bg-muted text-foreground">{p.key}</code>
                ))}
                <span>are filled in when the email is sent.</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={test.isPending || dirty}
              title={dirty ? "Save your changes first" : undefined}
              onClick={() => test.mutate(kind)}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" /> {test.isPending ? "Sending..." : "Send test to me"}
            </Button>
            {dirty && !test.isPending && <span className="text-[11px] text-muted-foreground">Save first to test your latest changes.</span>}
            {test.data?.sent && <span className="text-xs text-emerald-500">Test sent to {test.data.to}.</span>}
            {test.error && <span className="text-xs text-destructive">{getErrorMessage(test.error)}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {save.error && <span className="text-xs text-destructive">{getErrorMessage(save.error)}</span>}
          {savedAt && !dirty && <span className="text-xs text-emerald-500">Saved</span>}
          {invalidEnabled.length > 0 && <span className="text-xs text-destructive">Add a sender email, subject and message before switching an email on.</span>}
          <Button size="sm" onClick={onSave} disabled={!canSave}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> {save.isPending ? "Saving..." : "Save"}
          </Button>
        </div>

        <div className="space-y-1.5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Recent sends</h3>
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing sent yet.</p>
          ) : (
            log.map((r) => (
              <p key={r.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                {r.status === "sent" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" /> : r.status === "failed" ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-px" /> : <Clock className="w-3.5 h-3.5 shrink-0 mt-px" />}
                <span>
                  {format(new Date(r.birthday_on + "T12:00:00"), "d MMM yyyy")} · @{r.person?.username ?? "someone"} ·{" "}
                  {r.kind === "personal" ? "birthday person email" : `team announcement to ${r.recipients}`}
                  {r.status === "failed" && r.error ? ` · ${r.error}` : ""}
                </span>
              </p>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
