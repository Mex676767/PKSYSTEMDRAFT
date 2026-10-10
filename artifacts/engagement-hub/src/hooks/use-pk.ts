import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiAssetUrl, apiRequest, uploadImage } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import type { Pk, PkSettings, PkViolation, PkChampion, PkDebt, PkLeaderRow, PkLibraryEntry, PkPerson, PkPlaybook, PkTerminateReason, PkTerms } from "@/lib/pk";

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

const PK_KEYS = [["pk"], ["pk-detail"], ["pk-approvals"], ["pk-leaderboard"], ["pk-champions"], ["pk-money"], ["pk-library"], ["pk-can-approve"]];
export function usePkList() {
  useRealtimeInvalidate("challenges", PK_KEYS);
  useRealtimeInvalidate("challenge_participants", PK_KEYS);
  return useQuery({
    queryKey: ["pk"],
    queryFn: async () => {
      return apiRequest<Pk[]>("/pk");
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
      return apiRequest<{ pk: Pk | null; events: PkEvent[]; terms: PkTermsVersion[]; scores: PkScoreUpdate[]; sides: PkSideScore[]; playbook: PkPlaybook | null; debts: PkDebt[] }>(`/pk/${encodeURIComponent(id!)}`);
    },
  });
}

/** Live side scores for the arena cards. */
export function usePkSideScores(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pk-detail", id, "sides"],
    enabled,
    queryFn: async () => {
      return apiRequest<PkSideScore[]>("/pk/rpc/pk_side_scores", { method: "POST", body: JSON.stringify({ cid: id }) });
    },
  });
}

export function usePkApprovals() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["pk-approvals", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const data = await apiRequest<string[]>("/pk/rpc/pk_pending_approvals", { method: "POST", body: "{}" });
      return new Set(data ?? []);
    },
  });
}

export function usePkSettings() {
  return useQuery({
    queryKey: ["pk-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      return apiRequest<PkSettings | null>("/pk/settings");
    },
  });
}

export function useUpdatePkSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<PkSettings>) => call("pk_update_settings", { changes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pk-settings"] }),
  });
}

export function usePkViolations(enabled: boolean) {
  return useQuery({
    queryKey: ["pk-violations"],
    enabled,
    queryFn: async () => {
      return apiRequest<PkViolation[]>("/pk/violations");
    },
  });
}

export function useResolvePkViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => call("pk_resolve_violation", { violation_id: id, resolution_note: note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pk-violations"] }),
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
  return apiRequest<T>(`/pk/rpc/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify(args) });
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
    await uploadImage(`/files/${encodeURIComponent(session.user.id)}/${encodeURIComponent(path.split("/").at(-1)!)}`, file);
    return call("pk_update_score", { cid: id, new_value: value, proof: path, note: comment.trim() || null });
  });
}

export function getPkProofUrl(path: string) {
  const [owner, name] = path.split("/", 2);
  return apiAssetUrl(`/files/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(name ?? "")}`);
}

export const useRequestSettlement = () => useRpc((id: string) => call("pk_request_settlement", { cid: id }));

export const useSubmitPlaybook = () =>
  useRpc(({ id, extra, worked, copy }: { id: string; extra: string; worked: string; copy: string }) =>
    call("pk_submit_playbook", { cid: id, extra, worked, copy }));

export const useSubmitPkUpgradeEvidence = () =>
  useRpc(({ id, evidence }: { id: string; evidence: string }) => call("pk_submit_upgrade_evidence", { cid: id, evidence }));

export const useMarkPkStopped = () =>
  useRpc(({ id, participantId, note }: { id: string; participantId: string; note: string }) => call("pk_mark_stopped", { cid: id, participant_id: participantId, note: note.trim() || null }));

export const useDisputePkTier = () =>
  useRpc(({ id, note }: { id: string; note: string }) => call("pk_dispute_tier", { cid: id, note: note.trim() }));

export const useVerifyPk = () =>
  useRpc(({ id, decision, note, tiebreak }: { id: string; decision: "confirm" | "playbook" | "reopen"; note: string; tiebreak?: "A" | "B" | null }) =>
    call("pk_verify", { cid: id, decision, note: note.trim() || null, tiebreak_side: tiebreak ?? null }));

export function usePkLeaderboard(period: string, department: string | null) {
  useRealtimeInvalidate("pk_points", [["pk-leaderboard"], ["pk-champions"]]);
  return useQuery({
    queryKey: ["pk-leaderboard", period, department],
    queryFn: async () => {
      return apiRequest<PkLeaderRow[]>("/pk/rpc/pk_leaderboard", { method: "POST", body: JSON.stringify({ period, dept: department }) });
    },
  });
}

export function usePkChampions(department: string | null) {
  return useQuery({
    queryKey: ["pk-champions", department],
    queryFn: async () => {
      return apiRequest<PkChampion[]>("/pk/rpc/pk_champions", { method: "POST", body: JSON.stringify({ dept: department }) });
    },
  });
}

/** Can the signed-in person approve (and so terminate) this PK? */
export function usePkCanApprove(id: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["pk-can-approve", id, session?.user.id],
    enabled: !!id && !!session,
    queryFn: async () => {
      return apiRequest<boolean>("/pk/rpc/pk_can_approve", { method: "POST", body: JSON.stringify({ cid: id }) });
    },
  });
}

export const useTerminatePk = () =>
  useRpc(({ id, reason, note }: { id: string; reason: PkTerminateReason; note: string }) =>
    call("pk_terminate", { cid: id, reason, note }));

/** Every settled PK's winner playbook, newest first. */
export function usePlaybookLibrary() {
  return useQuery({
    queryKey: ["pk-library"],
    queryFn: async () => {
      return apiRequest<PkLibraryEntry[]>("/pk/library");
    },
  });
}
