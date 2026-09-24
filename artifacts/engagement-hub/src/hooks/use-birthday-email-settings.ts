import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type BirthdayEmailSettings = {
  /** Team announcement on/off. */
  enabled: boolean;
  from_name: string;
  from_email: string;
  reply_to: string;
  subject: string;
  body: string;
  personal_enabled: boolean;
  personal_subject: string;
  personal_body: string;
  site_url: string;
  send_hour: number;
  timezone: string;
  updated_at: string;
};

export type BirthdayEmailKind = "announcement" | "personal";

export const BIRTHDAY_EMAIL_PLACEHOLDERS: Record<BirthdayEmailKind, { key: string; help: string }[]> = {
  announcement: [
    { key: "{{names}}", help: "Everyone with a birthday today" },
    { key: "{{date}}", help: "Today's date" },
    { key: "{{site_url}}", help: "Link to the hub" },
  ],
  personal: [
    { key: "{{name}}", help: "The birthday person" },
    { key: "{{date}}", help: "Today's date" },
    { key: "{{site_url}}", help: "Link to the hub" },
  ],
};

/** Same substitution the send-birthday-emails function does, for the admin preview. */
export function fillBirthdayTemplate(template: string, values: { names?: string; name?: string; date: string; site_url: string }) {
  return template
    .replaceAll("{{names}}", values.names ?? values.name ?? "")
    .replaceAll("{{name}}", values.name ?? values.names ?? "")
    .replaceAll("{{date}}", values.date)
    .replaceAll("{{site_url}}", values.site_url.replace(/\/+$/, ""));
}

export function useBirthdayEmailSettings(enabled: boolean) {
  return useQuery({
    queryKey: ["birthday-email-settings"],
    enabled,
    queryFn: async () => {
      // select("*") so the card still loads before migration 0024 adds columns.
      const { data, error } = await supabase.from("birthday_email_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as (Partial<BirthdayEmailSettings> & Pick<BirthdayEmailSettings, "enabled" | "subject" | "body">) | null;
    },
  });
}

export function useSaveBirthdayEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<Omit<BirthdayEmailSettings, "updated_at">>) => {
      const { error } = await supabase.from("birthday_email_settings").update(settings).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["birthday-email-settings"] }),
  });
}

/** Sends one email, filled with sample names, to the signed-in admin only. */
export function useSendTestBirthdayEmail() {
  return useMutation({
    mutationFn: async (kind: BirthdayEmailKind) => {
      const { data, error } = await supabase.functions.invoke("send-birthday-emails", { body: { action: "test", kind } });
      if (error) {
        // Surface the function's own message ("domain not verified", etc.).
        const ctx = (error as { context?: Response }).context;
        const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
        if (detail?.error) throw new Error(detail.error);
        if (ctx?.status === 404) throw new Error("The send-birthday-emails function isn't deployed yet.");
        throw error;
      }
      return data as { sent: boolean; to: string };
    },
  });
}

export type BirthdayEmailLogRow = {
  id: string;
  birthday_on: string;
  kind: BirthdayEmailKind;
  status: "sending" | "sent" | "failed";
  recipients: number;
  error: string | null;
  created_at: string;
  person: { username: string | null } | null;
};

export function useBirthdayEmailLog(enabled: boolean) {
  return useQuery({
    queryKey: ["birthday-email-log"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthday_email_log")
        .select("id, birthday_on, kind, status, recipients, error, created_at, person:profiles(username)")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) return [] as BirthdayEmailLogRow[];
      return data as unknown as BirthdayEmailLogRow[];
    },
  });
}
