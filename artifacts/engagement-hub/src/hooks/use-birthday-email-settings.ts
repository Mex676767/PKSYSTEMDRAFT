import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type BirthdayEmailSettings = {
  enabled: boolean;
  from_name: string;
  from_email: string;
  reply_to: string;
  subject: string;
  body: string;
  updated_at: string;
};

export const BIRTHDAY_EMAIL_PLACEHOLDERS = [
  { key: "{{names}}", help: "Everyone with a birthday today" },
  { key: "{{date}}", help: "Today's date" },
  { key: "{{site_url}}", help: "Link to the hub" },
] as const;

/** What the sending job will do with the template, for the admin preview. */
export function fillBirthdayTemplate(template: string, values: { names: string; date: string; site_url: string }) {
  return template
    .replaceAll("{{names}}", values.names)
    .replaceAll("{{date}}", values.date)
    .replaceAll("{{site_url}}", values.site_url);
}

export function useBirthdayEmailSettings(enabled: boolean) {
  return useQuery({
    queryKey: ["birthday-email-settings"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthday_email_settings")
        .select("enabled, from_name, from_email, reply_to, subject, body, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as BirthdayEmailSettings | null;
    },
  });
}

export function useSaveBirthdayEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Omit<BirthdayEmailSettings, "updated_at">) => {
      const { error } = await supabase.from("birthday_email_settings").update(settings).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["birthday-email-settings"] }),
  });
}
