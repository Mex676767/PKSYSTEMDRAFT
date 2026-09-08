import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type BirthdayEntry = {
  id: string;
  username: string | null;
  department: string | null;
  birthday: string; // YYYY-MM-DD
  isToday: boolean;
  daysUntil: number;
};

function monthDayOf(dateStr: string) {
  // Parse as a plain calendar date, ignoring timezone shifts.
  const [, month, day] = dateStr.split("-").map(Number);
  return { month: month - 1, day };
}

export function useBirthdays() {
  return useQuery({
    queryKey: ["birthdays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, department, birthday")
        .not("birthday", "is", null);
      if (error) throw error;

      const today = new Date();
      const todayM = today.getMonth();
      const todayD = today.getDate();
      const todayMidnight = new Date(today.getFullYear(), todayM, todayD).getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      return (data as { id: string; username: string | null; department: string | null; birthday: string }[])
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
    mutationFn: async (birthday: string) => {
      const { error } = await supabase.rpc("set_my_birthday", { birthday_param: birthday });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchProfile();
      qc.invalidateQueries({ queryKey: ["birthdays"] });
    },
  });
}

export function useAdminSetBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, birthday }: { userId: string; birthday: string }) => {
      const { error } = await supabase.rpc("admin_set_birthday", { user_id_param: userId, birthday_param: birthday });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["birthdays"] });
      qc.invalidateQueries({ queryKey: ["all-profiles-admin"] });
    },
  });
}
