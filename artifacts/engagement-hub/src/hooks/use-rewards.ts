import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/api";
import type { MissionCadence } from "@/lib/missions";

export type PointsSettings = { revamp_enabled: boolean; timezone: string };
export type Mission = { id: string; title: string; description: string | null; cadence: MissionCadence; kind: string; target_count: number; points: number; starts_at: string | null; ends_at: string | null; active: boolean; created_at: string };
export type MyMission = Omit<Mission, "active" | "created_at"> & { progress: number; claim_status: "awarded" | "pending" | "rejected" | null; resets_at: string | null };
export type Reward = { id: string; name: string; description: string | null; cost: number; stock: number | null; active: boolean; created_at: string };
export type Redemption = { id: string; reward_id: string | null; reward_name: string; user_id: string; cost: number; status: "pending" | "fulfilled" | "rejected"; admin_note: string | null; reviewed_at: string | null; created_at: string; user?: { username: string | null } | null };
export type PendingMissionClaim = { id: string; points: number; created_at: string; mission: { title: string } | null; user: { username: string | null } | null };

const KEYS = { settings:["points-settings"], myMissions:["my-missions"], allMissions:["missions-admin"], rewards:["rewards"], myRedemptions:["my-redemptions"], redemptions:["redemptions-admin"], pendingClaims:["mission-claims-pending"] };

export function usePointsSettings() {
  const { session } = useAuth();
  return useQuery({ queryKey:KEYS.settings, enabled:!!session, staleTime:60_000, queryFn:()=>apiRequest<PointsSettings>("/points/settings") });
}
export function useRevampEnabled() { return usePointsSettings().data?.revamp_enabled ?? false; }
export function useSetRevampEnabled() {
  const qc=useQueryClient();
  return useMutation({ mutationFn:(enabled:boolean)=>apiRequest<void>("/points/settings",{method:"PATCH",body:JSON.stringify({revamp_enabled:enabled})}), onSuccess:()=>{ for(const key of [KEYS.settings,KEYS.myMissions,KEYS.allMissions,KEYS.rewards]) qc.invalidateQueries({queryKey:key}); } });
}
export function useMyMissions(enabled:boolean) {
  const {session}=useAuth();
  return useQuery({queryKey:[...KEYS.myMissions,session?.user.id],enabled:!!session&&enabled,refetchInterval:5*60_000,refetchIntervalInBackground:false,queryFn:()=>apiRequest<MyMission[]>("/points/missions/me")});
}
function useRefreshPoints() {
  const {refetchProfile}=useAuth(); const qc=useQueryClient();
  return async()=>{await refetchProfile();for(const key of [KEYS.myMissions,KEYS.myRedemptions,KEYS.rewards,["point-history"]])qc.invalidateQueries({queryKey:key});};
}
export function useClaimMission(){const refresh=useRefreshPoints();return useMutation({mutationFn:(missionId:string)=>apiRequest<"awarded"|"pending">(`/points/missions/${encodeURIComponent(missionId)}/claim`,{method:"POST"}),onSettled:refresh});}
export function useRewards(){const {session}=useAuth();return useQuery({queryKey:KEYS.rewards,enabled:!!session,queryFn:()=>apiRequest<Reward[]>("/rewards")});}
export function useRedeemReward(){const refresh=useRefreshPoints();return useMutation({mutationFn:(rewardId:string)=>apiRequest<void>(`/rewards/${encodeURIComponent(rewardId)}/redeem`,{method:"POST"}),onSettled:refresh});}
export function useMyRedemptions(){const {session}=useAuth();return useQuery({queryKey:[...KEYS.myRedemptions,session?.user.id],enabled:!!session,queryFn:()=>apiRequest<Redemption[]>("/rewards/redemptions/me")});}
export function useFullPointHistory(){const {session}=useAuth();return useQuery({queryKey:["point-history",session?.user.id,"full"],enabled:!!session,queryFn:()=>apiRequest<{id:string;amount:number;reason:string;created_at:string}[]>("/points/history/full")});}
export function useAllMissions(){return useQuery({queryKey:KEYS.allMissions,queryFn:()=>apiRequest<Mission[]>("/points/missions")});}
export type MissionInput=Omit<Mission,"id"|"created_at">;
export function useSaveMission(){const qc=useQueryClient();return useMutation({mutationFn:(input:MissionInput&{id?:string;created_at?:string})=>apiRequest<Mission>("/points/missions",{method:"POST",body:JSON.stringify(input)}),onSuccess:()=>{qc.invalidateQueries({queryKey:KEYS.allMissions});qc.invalidateQueries({queryKey:KEYS.myMissions});}});}
export function useDeleteMission(){const qc=useQueryClient();return useMutation({mutationFn:(id:string)=>apiRequest<void>(`/points/missions/${encodeURIComponent(id)}`,{method:"DELETE"}),onSuccess:()=>{qc.invalidateQueries({queryKey:KEYS.allMissions});qc.invalidateQueries({queryKey:KEYS.myMissions});}});}
export type RewardInput=Omit<Reward,"id"|"created_at">;
export function useSaveReward(){const qc=useQueryClient();return useMutation({mutationFn:(input:RewardInput&{id?:string;created_at?:string})=>apiRequest<Reward>("/rewards",{method:"POST",body:JSON.stringify(input)}),onSuccess:()=>qc.invalidateQueries({queryKey:KEYS.rewards})});}
export function useDeleteReward(){const qc=useQueryClient();return useMutation({mutationFn:(id:string)=>apiRequest<void>(`/rewards/${encodeURIComponent(id)}`,{method:"DELETE"}),onSuccess:()=>qc.invalidateQueries({queryKey:KEYS.rewards})});}
export function usePendingMissionClaims(){return useQuery({queryKey:KEYS.pendingClaims,refetchInterval:5*60_000,refetchIntervalInBackground:false,queryFn:()=>apiRequest<PendingMissionClaim[]>("/points/mission-claims/pending")});}
export function useReviewMissionClaim(){const qc=useQueryClient();return useMutation({mutationFn:({id,approve}:{id:string;approve:boolean})=>apiRequest<void>(`/points/mission-claims/${encodeURIComponent(id)}/review`,{method:"POST",body:JSON.stringify({approve})}),onSettled:()=>qc.invalidateQueries({queryKey:KEYS.pendingClaims})});}
export function useAllRedemptions(){return useQuery({queryKey:KEYS.redemptions,refetchInterval:5*60_000,refetchIntervalInBackground:false,queryFn:()=>apiRequest<Redemption[]>("/rewards/redemptions")});}
export function useReviewRedemption(){const qc=useQueryClient();return useMutation({mutationFn:({id,approve,note}:{id:string;approve:boolean;note?:string})=>apiRequest<void>(`/rewards/redemptions/${encodeURIComponent(id)}/review`,{method:"POST",body:JSON.stringify({approve,note:note??null})}),onSettled:()=>{qc.invalidateQueries({queryKey:KEYS.redemptions});qc.invalidateQueries({queryKey:KEYS.rewards});qc.invalidateQueries({queryKey:KEYS.myRedemptions});}});}
