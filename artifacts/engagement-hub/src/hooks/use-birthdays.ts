import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";

export type BirthdayEntry = {
  id: string;
  username: string | null;
  department: string | null;
  role: string | null;
  birthday: string
  avatar_url: string | null;
  active_border: string | null; active_accessory?: string | null;
  isToday: boolean;
  daysUntil: number;
};

function monthDayOf(dateStr: string) {
  const [, month, day] = dateStr.split("-").map(Number);
  return { month: month - 1, day };
}

export function isBirthdayToday(birthday: string | null | undefined) {
  if (!birthday) return false;
  const { month, day } = monthDayOf(birthday);
  const today = new Date();
  return month === today.getMonth() && day === today.getDate();
}

export function useBirthdays() {
  return useQuery({
    queryKey: ["birthdays"],
    queryFn: async () => {
      const data = await apiRequest<Omit<BirthdayEntry, "isToday" | "daysUntil">[]>("/birthdays");

      const today = new Date();
      const todayM = today.getMonth();
      const todayD = today.getDate();
      const todayMidnight = new Date(today.getFullYear(), todayM, todayD).getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      return data
        .map((p): BirthdayEntry => {
          const { month, day } = monthDayOf(p.birthday);
          const isToday = month === todayM && day === todayD;
          let next = new Date(today.getFullYear(), month, day).getTime();
          if (next < todayMidnight) next = new Date(today.getFullYear() + 1, month, day).getTime();
          const daysUntil = Math.round((next - todayMidnight) / dayMs);
          return { ...p, isToday, daysUntil };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil);
    },
  });
}

export function useSetMyBirthday() {
  const qc = useQueryClient();
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: (birthday: string) => apiRequest("/profile/birthday", { method: "PUT", body: JSON.stringify({ birthday }) }),
    onSuccess: () => {
      refetchProfile();
      qc.invalidateQueries({ queryKey: ["birthdays"] });
    },
  });
}

export function useAdminSetBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, birthday }: { userId: string; birthday: string }) =>
      apiRequest(`/admin/profiles/${encodeURIComponent(userId)}/birthday`, { method: "PUT", body: JSON.stringify({ birthday }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["birthdays"] });
      qc.invalidateQueries({ queryKey: ["all-profiles-admin"] });
    },
  });
}
