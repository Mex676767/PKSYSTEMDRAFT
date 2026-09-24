import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import type { Pk, PkPerson, PkTerms } from "@/lib/pk";

const PERSON = "username, role, avatar_url, active_border, active_accessory";
const PK_SELECT = `*, participants:challenge_participants(*, profile:profiles(${PERSON}))`;

export type PkEvent = {
  id: string;
  kind: string;
  message: string;
  created_at: string;
  actor_id: string | null;
};

export type PkTermsVersion = {
  id: string;
  version: number;
  action: string;
  actor_id: string | null;
  terms: Record<string, unknown> & { participants?: { user_id: string; username: string; side: string; baseline: number | null; target: number | null }[] };
  created_at: string;
  actor: { username: string | null } | null;
};

export type PkScoreUpdate = {
  id: string;
  user_id: string;
  value: number;
  proof_path: string;
  comment: string | null;
  created_at: string;
  profile: PkPerson | null;
};

export type PkSideScore = { side: "A" | "B"; score: number | null };

const PK_KEYS = [["pk"], ["pk-detail"], ["pk-approvals"]];

export function usePkList() {
  useRealtimeInvalidate("challenges", PK_KEYS);
  useRealtimeInvalidate("challenge_participants", PK_KEYS);
  return useQuery({
    queryKey: ["pk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select(PK_SELECT)
        .eq("pk_version", 1)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Pk[];
    },
  });
}

export function usePk(id: string | undefined) {
  useRealtimeInvalidate("challenge_events", [["pk-detail"]]);
  useRealtimeInvalidate("challenge_score_updates", [["pk-detail"]]);
  return useQuery({
    queryKey: ["pk-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const [pk, events, terms, scores, sides] = await Promise.all([
        supabase.from("challenges").select(PK_SELECT).eq("id", id!).eq("pk_version", 1).maybeSingle(),
        supabase.from("challenge_events").select("*").eq("challenge_id", id!).order("created_at", { ascending: false }),
        supabase
          .from("challenge_terms_history")
          .select("*, actor:profiles(username)")
          .eq("challenge_id", id!)
          .order("created_at", { ascending: false }),
        supabase
          .from("challenge_score_updates")
          .select(`*, profile:profiles(${PERSON})`)
          .eq("challenge_id", id!)
          .order("created_at", { ascending: false }),
        supabase.rpc("pk_side_scores", { cid: id! }),
      ]);
      for (const r of [pk, events, terms, scores, sides]) if (r.error) throw r.error;
      return {
        pk: pk.data as unknown as Pk | null,
        events: (events.data ?? []) as PkEvent[],
        terms: (terms.data ?? []) as unknown as PkTermsVersion[],
        scores: (scores.data ?? []) as unknown as PkScoreUpdate[],
        sides: (sides.data ?? []) as PkSideScore[],
      };
    },
  });
}

/** Live side scores for the arena cards. */
export function usePkSideScores(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pk-detail", id, "sides"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pk_side_scores", { cid: id });
      if (error) throw error;
      return (data ?? []) as PkSideScore[];
    },
  });
}

export function usePkApprovals() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["pk-approvals", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pk_pending_approvals");
      if (error) throw error;
      return new Set(((data ?? []) as unknown as (string | { pk_pending_approvals: string })[]).map((r) =>
        typeof r === "string" ? r : r.pk_pending_approvals));
    },
  });
}

export function usePkSettings() {
  return useQuery({
    queryKey: ["pk-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("pk_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as { max_counter_rounds: number; open_expiry_days: number } | null;
    },
  });
}

/** Terms as the database functions expect them (empty strings become nulls there). */
export function termsPayload(t: PkTerms) {
  const endOfDay = (d: string) => (d ? new Date(d + "T23:59:59").toISOString() : "");
  const startOfDay = (d: string) => (d ? new Date(d + "T00:00:00").toISOString() : "");
  return {
    ...t,
    title: t.title.trim(),
    starts_at: startOfDay(t.starts_at),
    ends_at: endOfDay(t.ends_at),
  };
}

function useRpc<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of PK_KEYS) qc.invalidateQueries({ queryKey: key });
    },
  });
}

async function call<T = unknown>(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const useCreatePk = () => useRpc((terms: PkTerms) => call<string>("pk_create", { terms: termsPayload(terms) }));

export const useRespondPk = () =>
  useRpc(({ id, response, counter }: { id: string; response: "accept" | "decline" | "counter"; counter?: PkTerms }) =>
    call("pk_respond", { cid: id, response, counter: counter ? termsPayload(counter) : null }));

export const useAcceptOpenPk = () =>
  useRpc(({ id, baseline, target }: { id: string; baseline: string; target: string }) =>
    call("pk_accept_open", {
      cid: id,
      my_baseline: baseline === "" ? null : Number(baseline),
      my_target: target === "" ? null : Number(target),
    }));

export const useCancelPk = () => useRpc((id: string) => call("pk_cancel", { cid: id }));

export const useReviewPk = () =>
  useRpc(({ id, approve, note }: { id: string; approve: boolean; note: string }) =>
    call("pk_review", { cid: id, approve, note: note.trim() || null }));

export const useDeletePk = () => useRpc((id: string) => call("pk_delete", { cid: id }));

export function useUpdatePkScore() {
  const { session } = useAuth();
  return useRpc(async ({ id, value, file, comment }: { id: string; value: number; file: File; comment: string }) => {
    if (!session) throw new Error("Sign in first.");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${session.user.id}/pk-proof-${id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("post-images").upload(path, file);
    if (error) throw error;
    return call("pk_update_score", { cid: id, new_value: value, proof: path, note: comment.trim() || null });
  });
}

export function getPkProofUrl(path: string) {
  return supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
}
