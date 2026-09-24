import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Mail, Save, Eye, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  BIRTHDAY_EMAIL_PLACEHOLDERS,
  fillBirthdayTemplate,
  useBirthdayEmailSettings,
  useSaveBirthdayEmailSettings,
  type BirthdayEmailSettings,
} from "@/hooks/use-birthday-email-settings";
import { cn } from "@/lib/utils";

type Draft = Omit<BirthdayEmailSettings, "updated_at">;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BirthdayEmailSettingsCard() {
  const { data: settings, isLoading, error: loadError } = useBirthdayEmailSettings(true);
  const save = useSaveBirthdayEmailSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (settings && !draft) {
      const { updated_at: _updatedAt, ...rest } = settings;
      setDraft(rest);
    }
  }, [settings, draft]);

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 flex justify-center">
          <div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" />
        </CardContent>
      </Card>
    );
  }

  if (loadError || !settings || !draft) {
    return (
      <Card className="shadow-sm border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Birthday email settings aren't available yet. Run the <code>0014_birthday_email_settings</code> migration on
          Supabase, then reload this page.
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setSavedAt(null);
  };

  const fromEmailValid = draft.from_email.trim() === "" || EMAIL_PATTERN.test(draft.from_email.trim());
  const replyToValid = draft.reply_to.trim() === "" || EMAIL_PATTERN.test(draft.reply_to.trim());
  const canEnable = EMAIL_PATTERN.test(draft.from_email.trim()) && draft.subject.trim() !== "" && draft.body.trim() !== "";
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== settings[k]);
  const canSave = dirty && fromEmailValid && replyToValid && (!draft.enabled || canEnable) && !save.isPending;

  const sample = {
    names: "@aldo and @max",
    date: format(new Date(), "d MMMM"),
    site_url: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ""),
  };

  const onSave = () => {
    save.mutate(
      {
        ...draft,
        from_name: draft.from_name.trim(),
        from_email: draft.from_email.trim(),
        reply_to: draft.reply_to.trim(),
      },
      { onSuccess: () => setSavedAt(Date.now()) }
    );
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Birthday Email</h2>
            <p className="text-xs text-muted-foreground">
              The announcement emailed to every employee on someone's birthday. Automatic sending isn't switched on
              yet — what you save here is what it will use.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="bday-enabled" className="text-xs text-muted-foreground">
              {draft.enabled ? "On" : "Off"}
            </Label>
            <Switch
              id="bday-enabled"
              checked={draft.enabled}
              onCheckedChange={(v) => set("enabled", v)}
              disabled={!draft.enabled && !canEnable}
              title={!canEnable ? "Add a sender email, subject and message first" : undefined}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bday-from-name">Sender name</Label>
            <Input
              id="bday-from-name"
              value={draft.from_name}
              onChange={(e) => set("from_name", e.target.value)}
              placeholder="C9MYR Hub"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bday-from-email">Sender email</Label>
            <Input
              id="bday-from-email"
              type="email"
              value={draft.from_email}
              onChange={(e) => set("from_email", e.target.value)}
              placeholder="hub@yourcompany.com"
              className={cn(!fromEmailValid && "border-destructive focus-visible:ring-destructive")}
            />
            {!fromEmailValid && <p className="text-[11px] text-destructive">That doesn't look like an email address.</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bday-reply-to">
              Reply-to <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="bday-reply-to"
              type="email"
              value={draft.reply_to}
              onChange={(e) => set("reply_to", e.target.value)}
              placeholder="hr@yourcompany.com"
              className={cn(!replyToValid && "border-destructive focus-visible:ring-destructive")}
            />
            {!replyToValid && <p className="text-[11px] text-destructive">That doesn't look like an email address.</p>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Content</span>
          <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full", !preview && "bg-primary text-primary-foreground")}
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full", preview && "bg-primary text-primary-foreground")}
            >
              <Eye className="w-3 h-3" /> Preview
            </button>
          </div>
        </div>

        {preview ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium text-foreground">From:</span> {draft.from_name || "(no name)"}{" "}
                &lt;{draft.from_email || "sender not set"}&gt;
              </p>
              {draft.reply_to && (
                <p>
                  <span className="font-medium text-foreground">Reply-to:</span> {draft.reply_to}
                </p>
              )}
              <p>
                <span className="font-medium text-foreground">To:</span> every employee
              </p>
            </div>
            <p className="font-semibold">{fillBirthdayTemplate(draft.subject, sample)}</p>
            <p className="whitespace-pre-wrap break-words">{fillBirthdayTemplate(draft.body, sample)}</p>
            <p className="text-[11px] text-muted-foreground">Preview uses sample names: {sample.names}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bday-subject">Subject</Label>
              <Input id="bday-subject" value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bday-body">Message</Label>
              <Textarea
                id="bday-body"
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span>Placeholders:</span>
              {BIRTHDAY_EMAIL_PLACEHOLDERS.map((p) => (
                <code key={p.key} title={p.help} className="px-1.5 py-0.5 rounded bg-muted text-foreground">
                  {p.key}
                </code>
              ))}
              <span>— filled in when the email is sent.</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {save.error && <span className="text-xs text-destructive">{(save.error as Error).message}</span>}
          {savedAt && !dirty && <span className="text-xs text-emerald-500">Saved</span>}
          {draft.enabled && !canEnable && (
            <span className="text-xs text-destructive">Add a sender email, subject and message to turn this on.</span>
          )}
          <Button size="sm" onClick={onSave} disabled={!canSave}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> {save.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
