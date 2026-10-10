import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

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
    queryFn: () => apiRequest<(Partial<BirthdayEmailSettings> & Pick<BirthdayEmailSettings, "enabled" | "subject" | "body">) | null>("/birthday-email/settings"),
  });
}

export function useSaveBirthdayEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<Omit<BirthdayEmailSettings, "updated_at">>) => {
      await apiRequest<void>("/birthday-email/settings", { method:"PATCH", body:JSON.stringify(settings) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["birthday-email-settings"] }),
  });
}

/** Sends one email, filled with sample names, to the signed-in admin only. */
export function useSendTestBirthdayEmail() {
  return useMutation({
    mutationFn: async (kind: BirthdayEmailKind) => {
      return apiRequest<{ sent:boolean; to:string }>("/birthday-email/test",{method:"POST",body:JSON.stringify({kind})});
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
    queryFn: async () => apiRequest<BirthdayEmailLogRow[]>("/birthday-email/log").catch(() => []),
  });
}
