import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

// Tables not already covered by a feature-specific live subscription. The
// callback invalidates active queries only, so pages that are not mounted do
// not suddenly fetch in the background.
const LIVE_SYNC_TABLES = [
  "profiles",
  "account_approvals",
  "progress_photos",
  "achievements",
  "birthday_email_settings",
  "birthday_email_log",
  "org_roles",
  "org_departments",
  "mentorships",
  "hof_categories",
  "hof_records",
  "hof_award_categories",
  "hof_award_winners",
  "hof_deletion_logs",
  "learning_resources",
  "learning_requests",
  "learning_shares",
  "points_settings",
  "point_transactions",
  "missions",
  "mission_claims",
  "rewards",
  "reward_redemptions",
  "bets",
  "bet_options",
  "bet_wagers",
  "quiz_questions",
  "quiz_answers",
  "wordle_attempts",
  "wordle_results",
  "login_sessions",
  "voice_sessions",
] as const;

type ProfileChange = {
  new?: { id?: string; user_id?: string };
  old?: { id?: string; user_id?: string };
};

export function LiveDataSync() {
  const queryClient = useQueryClient();
  const { session, refetchProfile } = useAuth();

  useEffect(() => {
    if (!session) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let profileTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshActiveData = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        queryClient.invalidateQueries({ refetchType: "active" });
      }, 120);
    };

    const refreshProfileIfNeeded = (payload: ProfileChange) => {
      const changedId = payload.new?.id ?? payload.new?.user_id ?? payload.old?.id ?? payload.old?.user_id;
      if (changedId !== session.user.id) return;
      if (profileTimer) clearTimeout(profileTimer);
      profileTimer = setTimeout(() => void refetchProfile(), 120);
    };

    let channel = supabase.channel(`hub-live-sync-${session.user.id}`);
    for (const table of LIVE_SYNC_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          refreshActiveData();
          if (table === "profiles" || table === "account_approvals") refreshProfileIfNeeded(payload as ProfileChange);
        },
      );
    }
    channel.subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (profileTimer) clearTimeout(profileTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, refetchProfile, session?.user.id]);

  return null;
}
