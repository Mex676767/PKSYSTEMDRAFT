import { useState } from "react";
import { format } from "date-fns";
import { Coins, Plus, Pencil, Trash2, Check, X, Target, Gift, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAllMissions,
  useAllRedemptions,
  useDeleteMission,
  useDeleteReward,
  usePendingMissionClaims,
  usePointsSettings,
  useReviewMissionClaim,
  useReviewRedemption,
  useRewards,
  useSaveMission,
  useSaveReward,
  useSetRevampEnabled,
  type Mission,
  type MissionInput,
  type Reward,
  type RewardInput,
} from "@/hooks/use-rewards";
import { CADENCE_LABEL, MISSION_KINDS, missionKindLabel, missionUnit, type MissionCadence } from "@/lib/missions";
import { cn, getErrorMessage } from "@/lib/utils";
import { SearchableSelect } from "@/components/searchable-select";

type Section = "approvals" | "missions" | "rewards";


export function AdminPointsCard() {
  const { data: settings, error: settingsError } = usePointsSettings();
  const setEnabled = useSetRevampEnabled();
  const { data: pendingClaims = [] } = usePendingMissionClaims();
  const { data: redemptions = [] } = useAllRedemptions();
  const [section, setSection] = useState<Section>("approvals");
  const pendingCount = pendingClaims.length + redemptions.filter((r) => r.status === "pending").length;
  const enabled = settings?.revamp_enabled ?? false;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Missions & Rewards</h2>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "On: members see missions and the rewards shop."
                : "Off: only the existing points system runs (daily login bonus, gifts). You can still set things up here first."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="revamp-enabled" className="text-xs text-muted-foreground">{enabled ? "On" : "Off"}</Label>
            <Switch
              id="revamp-enabled"
              checked={enabled}
              disabled={setEnabled.isPending || !!settingsError}
              onCheckedChange={(v) => setEnabled.mutate(v)}
            />
          </div>
        </div>
        {setEnabled.error && <p className="text-xs text-destructive">{getErrorMessage(setEnabled.error)}</p>}

        <div className="flex flex-wrap gap-2">
          {([
            { key: "approvals", label: "Approvals", icon: Inbox, badge: pendingCount },
            { key: "missions", label: "Missions", icon: Target, badge: 0 },
            { key: "rewards", label: "Rewards", icon: Gift, badge: 0 },
          ] as const).map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                section === key ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
              {badge > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">{badge}</span>}
            </button>
          ))}
        </div>

        {section === "approvals" && <Approvals />}
        {section === "missions" && <MissionsManager />}
        {section === "rewards" && <RewardsManager />}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------- approvals

function Approvals() {
  const { data: claims = [] } = usePendingMissionClaims();
  const { data: redemptions = [] } = useAllRedemptions();
  const reviewClaim = useReviewMissionClaim();
  const reviewRedemption = useReviewRedemption();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = redemptions.filter((r) => r.status === "pending");
  const recent = redemptions.filter((r) => r.status !== "pending").slice(0, 15);
  const err = reviewClaim.error ?? reviewRedemption.error;

  return (
    <div className="space-y-5">
      {err && <p className="text-xs text-destructive">{getErrorMessage(err)}</p>}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Reward redemptions</h3>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing waiting.</p>
        ) : (
          pending.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0">
                  <span className="font-semibold">@{r.user?.username ?? "someone"}</span> redeemed <span className="font-semibold">{r.reward_name}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{r.cost} pts · {format(new Date(r.created_at), "d MMM")}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Note to them (optional), e.g. collect from HR on Friday"
                  className="h-8 text-xs"
                />
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="h-8" disabled={reviewRedemption.isPending} onClick={() => reviewRedemption.mutate({ id: r.id, approve: true, note: notes[r.id] })}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" disabled={reviewRedemption.isPending} onClick={() => reviewRedemption.mutate({ id: r.id, approve: false, note: notes[r.id] })}>
                    <X className="w-3.5 h-3.5 mr-1" /> Decline & refund
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Manual missions</h3>
        {claims.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing waiting.</p>
        ) : (
          claims.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex-1 min-w-0 text-sm">
                <span className="font-semibold">@{c.user?.username ?? "someone"}</span> says they did <span className="font-semibold">{c.mission?.title ?? "a mission"}</span>
                <span className="text-xs text-muted-foreground"> · +{c.points} pts · {format(new Date(c.created_at), "d MMM")}</span>
              </span>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" className="h-8" disabled={reviewClaim.isPending} onClick={() => reviewClaim.mutate({ id: c.id, approve: true })}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="h-8" disabled={reviewClaim.isPending} onClick={() => reviewClaim.mutate({ id: c.id, approve: false })}>
                  <X className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {recent.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">Recently reviewed</h3>
          {recent.map((r) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              <span className={r.status === "fulfilled" ? "text-emerald-500" : "text-destructive"}>{r.status === "fulfilled" ? "Approved" : "Declined"}</span>
              {" · "}@{r.user?.username ?? "someone"} · {r.reward_name} · {r.cost} pts
              {r.reviewed_at && ` · ${format(new Date(r.reviewed_at), "d MMM")}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- missions

const EMPTY_MISSION: MissionInput = {
  title: "",
  description: "",
  cadence: "daily",
  kind: "login",
  target_count: 1,
  points: 10,
  starts_at: null,
  ends_at: null,
  active: true,
};

function toLocalInput(iso: string | null) {
  return iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "";
}

function MissionsManager() {
  const { data: missions = [] } = useAllMissions();
  const save = useSaveMission();
  const remove = useDeleteMission();
  const [editing, setEditing] = useState<(MissionInput & { id?: string }) | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Points are paid once per day / week / month (or once for Special) when the target is reached.</p>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY_MISSION })}><Plus className="w-3.5 h-3.5 mr-1" /> Add mission</Button>
      </div>
      {missions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No missions yet.</p>}
      {missions.map((m) => (
        <MissionRow
          key={m.id}
          mission={m}
          onEdit={() => setEditing({ ...m })}
          onToggle={(active) => save.mutate({ ...m, active })}
          onDelete={() => { if (confirm(`Delete "${m.title}"? Past claims are removed too.`)) remove.mutate(m.id); }}
        />
      ))}
      {editing && <MissionDialog value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MissionRow({ mission: m, onEdit, onToggle, onDelete }: { mission: Mission; onEdit: () => void; onToggle: (v: boolean) => void; onDelete: () => void }) {
  return (
    <div className={cn("rounded-lg border border-border p-3 flex items-center gap-3", !m.active && "opacity-60")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{m.title}</p>
        <p className="text-xs text-muted-foreground">
          {CADENCE_LABEL[m.cadence]} · {missionKindLabel(m.kind)}
          {m.kind !== "manual" && ` × ${m.target_count} ${missionUnit(m.kind, m.target_count)}`} · +{m.points} pts
          {m.cadence === "special" && m.ends_at && ` · ends ${format(new Date(m.ends_at), "d MMM")}`}
        </p>
      </div>
      <Switch checked={m.active} onCheckedChange={onToggle} title={m.active ? "Active" : "Hidden"} />
      <button type="button" onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted" title="Edit"><Pencil className="w-4 h-4" /></button>
      <button type="button" onClick={onDelete} className="p-1.5 rounded-md hover:bg-muted text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

function MissionDialog({ value, onClose }: { value: MissionInput & { id?: string }; onClose: () => void }) {
  const save = useSaveMission();
  const [m, setM] = useState(value);
  const set = <K extends keyof MissionInput>(k: K, v: MissionInput[K]) => setM((x) => ({ ...x, [k]: v }));
  const kindHelp = MISSION_KINDS.find((k) => k.key === m.kind)?.help;
  const special = m.cadence === "special";
  const datesOk = !special || !m.starts_at || !m.ends_at || new Date(m.ends_at) > new Date(m.starts_at);
  const valid = m.title.trim() !== "" && m.points > 0 && (m.kind === "manual" || m.target_count > 0) && datesOk;

  const onSave = () =>
    save.mutate(
      {
        ...m,
        title: m.title.trim(),
        description: m.description?.trim() || null,
        target_count: m.kind === "manual" ? 1 : m.target_count,
        starts_at: special ? m.starts_at : null,
        ends_at: special ? m.ends_at : null,
      },
      { onSuccess: onClose }
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{value.id ? "Edit mission" : "New mission"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Title</Label>
            <Input id="m-title" value={m.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Cheer on 3 teammates" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="m-desc" rows={2} value={m.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-cadence">Repeats</Label>
              <SearchableSelect
                id="m-cadence"
                value={m.cadence}
                onValueChange={(v) => set("cadence", v as MissionCadence)}
                options={(Object.keys(CADENCE_LABEL) as MissionCadence[]).map((c) => ({ value: c, label: c === "special" ? "Special (once, set dates)" : CADENCE_LABEL[c] }))}
                searchable={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-points">Points reward</Label>
              <Input id="m-points" type="number" min={1} value={m.points} onChange={(e) => set("points", Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-kind">What they do</Label>
              <SearchableSelect
                id="m-kind"
                value={m.kind}
                onValueChange={(v) => set("kind", v)}
                options={MISSION_KINDS.map((k) => ({ value: k.key, label: k.label, description: k.help }))}
                searchPlaceholder="Search activities..."
              />
            </div>
            {m.kind !== "manual" && (
              <div className="space-y-1.5 w-24">
                <Label htmlFor="m-target">How many</Label>
                <Input id="m-target" type="number" min={1} value={m.target_count} onChange={(e) => set("target_count", Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </div>
            )}
          </div>
          {kindHelp && <p className="text-[11px] text-muted-foreground -mt-1">{kindHelp}</p>}
          {special && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-start">Starts</Label>
                <Input id="m-start" type="datetime-local" value={toLocalInput(m.starts_at)} onChange={(e) => set("starts_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-end">Ends</Label>
                <Input id="m-end" type="datetime-local" value={toLocalInput(m.ends_at)} onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
              </div>
              {!datesOk && <p className="col-span-2 text-[11px] text-destructive">End must be after start.</p>}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch id="m-active" checked={m.active} onCheckedChange={(v) => set("active", v)} />
            <Label htmlFor="m-active" className="text-sm">Visible to members</Label>
          </div>
          {save.error && <p className="text-xs text-destructive">{getErrorMessage(save.error)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={!valid || save.isPending}>{save.isPending ? "Saving..." : "Save mission"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- rewards

const EMPTY_REWARD: RewardInput = { name: "", description: "", cost: 100, stock: null, active: true };

function RewardsManager() {
  const { data: rewards = [] } = useRewards();
  const save = useSaveReward();
  const remove = useDeleteReward();
  const [editing, setEditing] = useState<(RewardInput & { id?: string }) | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Items, vouchers or perks members can spend points on.</p>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY_REWARD })}><Plus className="w-3.5 h-3.5 mr-1" /> Add reward</Button>
      </div>
      {rewards.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No rewards yet.</p>}
      {rewards.map((r: Reward) => (
        <div key={r.id} className={cn("rounded-lg border border-border p-3 flex items-center gap-3", !r.active && "opacity-60")}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.cost.toLocaleString()} pts · {r.stock === null ? "unlimited" : `${r.stock} in stock`}</p>
          </div>
          <Switch checked={r.active} onCheckedChange={(active) => save.mutate({ ...r, active })} title={r.active ? "In the shop" : "Hidden"} />
          <button type="button" onClick={() => setEditing({ ...r })} className="p-1.5 rounded-md hover:bg-muted" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button type="button" onClick={() => { if (confirm(`Delete "${r.name}"? Past redemptions stay in history.`)) remove.mutate(r.id); }} className="p-1.5 rounded-md hover:bg-muted text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {editing && <RewardDialog value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RewardDialog({ value, onClose }: { value: RewardInput & { id?: string }; onClose: () => void }) {
  const save = useSaveReward();
  const [r, setR] = useState(value);
  const [stockText, setStockText] = useState(value.stock === null ? "" : String(value.stock));
  const stock = stockText.trim() === "" ? null : Math.max(0, Math.floor(Number(stockText) || 0));
  const valid = r.name.trim() !== "" && r.cost > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{value.id ? "Edit reward" : "New reward"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-name">Name</Label>
            <Input id="r-name" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="e.g. RM20 coffee voucher" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="r-desc" rows={2} value={r.description ?? ""} onChange={(e) => setR({ ...r, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-cost">Cost (pts)</Label>
              <Input id="r-cost" type="number" min={1} value={r.cost} onChange={(e) => setR({ ...r, cost: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-stock">Stock</Label>
              <Input id="r-stock" type="number" min={0} value={stockText} onChange={(e) => setStockText(e.target.value)} placeholder="Unlimited" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="r-active" checked={r.active} onCheckedChange={(v) => setR({ ...r, active: v })} />
            <Label htmlFor="r-active" className="text-sm">Show in the shop</Label>
          </div>
          {save.error && <p className="text-xs text-destructive">{getErrorMessage(save.error)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() => save.mutate({ ...r, name: r.name.trim(), description: r.description?.trim() || null, stock }, { onSuccess: onClose })}
          >
            {save.isPending ? "Saving..." : "Save reward"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
