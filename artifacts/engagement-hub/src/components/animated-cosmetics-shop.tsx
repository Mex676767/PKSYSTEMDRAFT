import { ANIMATED_COSMETIC_SETS } from "@/lib/animated-cosmetics";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { useSetActiveCosmeticSet } from "@/hooks/use-profile-customization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { UserAvatar } from "./user-avatar";
import { Check, Sparkles } from "lucide-react";
import { cn, getErrorMessage } from "@/lib/utils";

export function AnimatedCosmeticsShop({ busy = false, onPendingChange }: { busy?: boolean; onPendingChange?: (pending: boolean) => void }) {
  const { profile } = useAuth();
  const equip = useSetActiveCosmeticSet();
  if (!profile) return null;
  const user = { name: profile.username ?? profile.email, initials: initialsForUsername(profile.username ?? profile.email), color: colorForId(profile.id) };
  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="w-5 h-5 text-primary" /> Animated avatar sets</CardTitle>
        <CardDescription>Free for everyone. Equip a complete look, or mix its border and decoration below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(["after-hours", "overdrive"] as const).map(collection => (
          <section key={collection} aria-label={collection === "after-hours" ? "After Hours collection" : "Overdrive collection"}>
            <h3 className="text-sm font-semibold mb-3">{collection === "after-hours" ? "After Hours" : "Overdrive"}</h3>
            <div className="grid grid-cols-1 min-[600px]:grid-cols-2 md:grid-cols-3 gap-3">
              {ANIMATED_COSMETIC_SETS.filter(set => set.collection === collection).map(set => {
                const equipped = profile.active_border === set.borderKey && profile.active_accessory === set.accessoryKey;
                return (
                  <div key={set.id} data-cosmetic-set={set.id} className={cn("min-w-0 rounded-xl border p-3 text-center", equipped ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/20")}>
                    <div className="h-48 flex items-center justify-center">
                      <UserAvatar user={user} photoUrl={profile.avatar_url} border={set.borderKey} accessory={set.accessoryKey} className="w-12 h-12" presentation="showcase" />
                    </div>
                    <h4 className="text-sm font-semibold">{set.name}</h4>
                    <p className="text-[11px] leading-relaxed text-muted-foreground mt-1 min-h-12">{set.description}</p>
                    <Button size="sm" variant={equipped ? "outline" : "default"} className="w-full mt-3 text-xs" disabled={busy || equip.isPending}
                      aria-label={`${equipped ? "Remove" : "Equip"} ${set.name}`}
                      onClick={() => {
                        onPendingChange?.(true);
                        equip.mutate({ border: equipped ? null : set.borderKey, accessory: equipped ? null : set.accessoryKey }, { onSettled: () => onPendingChange?.(false) });
                      }}>
                      {equipped ? <><Check className="w-3 h-3 mr-1" /> Remove set</> : "Free · Equip set"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {equip.error && <p role="alert" className="text-sm text-destructive">{getErrorMessage(equip.error)}</p>}
      </CardContent>
    </Card>
  );
}
