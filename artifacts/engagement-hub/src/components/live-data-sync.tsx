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

type LiveSyncTable = (typeof LIVE_SYNC_TABLES)[number];

// A database event should only refresh queries that can actually contain that
// table's data. Previously every event refreshed every mounted query, which
// multiplied one small change into a burst of unrelated API requests.
const LIVE_SYNC_QUERY_KEYS: Record<LiveSyncTable, readonly string[]> = {
  profiles: ["directory", "birthdays", "all-profiles-admin", "goals-feed", "giftable-profiles", "all-usernames", "achievement-holders"],
  account_approvals: ["all-profiles-admin"],
  progress_photos: ["progress-photos"],
  achievements: ["achievements", "achievement-holders"],
  birthday_email_settings: ["birthday-email-settings"],
  birthday_email_log: ["birthday-email-log"],
  org_roles: ["org-structure", "directory", "all-profiles-admin"],
  org_departments: ["org-structure", "directory", "all-profiles-admin", "hof-department-visibility"],
  mentorships: ["mentorships"],
  hof_categories: ["hof-categories", "hof-current-records"],
  hof_records: ["hof-current-records", "hof-history", "hof-deletion-logs"],
  hof_award_categories: ["hof-award-categories"],
  hof_award_winners: ["hof-award-winners"],
  hof_deletion_logs: ["hof-deletion-logs"],
  learning_resources: ["learning-resources"],
  learning_requests: ["learning-requests"],
  learning_shares: ["learning-shares"],
  points_settings: ["points-settings"],
  point_transactions: ["point-history", "giftable-profiles"],
  missions: ["missions-admin", "my-missions"],
  mission_claims: ["mission-claims-pending", "my-missions"],
  rewards: ["rewards"],
  reward_redemptions: ["my-redemptions", "redemptions-admin", "rewards"],
  bets: ["bets"],
  bet_options: ["bet-options"],
  bet_wagers: ["bet-wagers"],
  quiz_questions: ["quiz-questions", "quiz-questions-full"],
  quiz_answers: ["my-quiz-answers", "quiz-leaderboard"],
  wordle_attempts: ["wordle-attempts"],
  wordle_results: ["wordle-result", "wordle-leaderboard"],
  login_sessions: ["activity-history"],
  voice_sessions: ["activity-history"],
};

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
    const pendingQueryKeys = new Set<string>();

    const refreshActiveData = (table: LiveSyncTable) => {
      for (const key of LIVE_SYNC_QUERY_KEYS[table]) pendingQueryKeys.add(key);
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        for (const key of pendingQueryKeys) {
          queryClient.invalidateQueries({ queryKey: [key], refetchType: "active" });
        }
        pendingQueryKeys.clear();
      }, 350);
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
          refreshActiveData(table);
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
