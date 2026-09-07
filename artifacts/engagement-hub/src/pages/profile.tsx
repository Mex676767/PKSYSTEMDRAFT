import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { Flame, Award, ShoppingBag, Check, Lock } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { TITLE_CATALOG } from "@/lib/titles";
import { getAccessoryEmoji } from "@/lib/accessories";
import {
  useAccessoryCatalog,
  usePurchaseAccessory,
  useSetActiveAccessory,
  useSetActiveTitle,
} from "@/hooks/use-profile-customization";
import { cn } from "@/lib/utils";

export default function Profile() {
  const { profile } = useAuth();
  const { data: catalog = [] } = useAccessoryCatalog();
  const purchase = usePurchaseAccessory();
  const setAccessory = useSetActiveAccessory();
  const setTitle = useSetActiveTitle();

  if (!profile) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-primary/20" /></div>;
  }

  const unlockedTitles = profile.unlocked_titles ?? [];
  const unlockedAccessories = profile.unlocked_accessories ?? [];

  return (
    <PageTransition className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <UserAvatar
          user={{
            name: profile.username ?? profile.email,
            initials: initialsForUsername(profile.username ?? profile.email),
            color: colorForId(profile.id),
          }}
          accessory={profile.active_accessory ? getAccessoryEmoji(profile.active_accessory) : null}
          className="w-16 h-16 text-xl"
        />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">@{profile.username}</h1>
          <p className="text-muted-foreground">
            {profile.active_title ? TITLE_CATALOG[profile.active_title]?.label ?? profile.active_title : "No title set"}
            {" · "}{profile.points} pts
          </p>
        </div>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Streak */}
        <motion.div variants={slideUp}>
          <Card className="border-secondary/20 shadow-sm bg-gradient-to-br from-secondary/10 via-card to-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="w-5 h-5 text-secondary" /> Login Streak
              </CardTitle>
              <CardDescription>Come back every day to keep it going</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-8">
              <div>
                <div className="text-3xl font-black">{profile.current_streak ?? 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Current</div>
              </div>
              <div>
                <div className="text-3xl font-black">{profile.longest_streak ?? 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Longest</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Titles */}
        <motion.div variants={slideUp}>
          <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/10 via-card to-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="w-5 h-5 text-primary" /> Titles
              </CardTitle>
              <CardDescription>Pick one to show off next to your name</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <button
                onClick={() => setTitle.mutate(null)}
                disabled={setTitle.isPending}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  !profile.active_title
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                )}
              >
                None
              </button>
              {unlockedTitles.length === 0 && (
                <p className="text-xs text-muted-foreground py-1.5">No titles unlocked yet — complete a goal, hit a streak, or claim a record.</p>
              )}
              {unlockedTitles.map((key) => (
                <button
                  key={key}
                  onClick={() => setTitle.mutate(key)}
                  disabled={setTitle.isPending}
                  title={TITLE_CATALOG[key]?.description}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    profile.active_title === key
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {TITLE_CATALOG[key]?.label ?? key}
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Accessory shop */}
      <motion.div variants={slideUp} initial="hidden" animate="show">
        <Card className="border-accent/20 shadow-sm bg-gradient-to-br from-accent/10 via-card to-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="w-5 h-5 text-accent-foreground" /> Accessory Shop
            </CardTitle>
            <CardDescription>Spend points on a little flair for your avatar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {catalog.map((item) => {
                const owned = unlockedAccessories.includes(item.key);
                const equipped = profile.active_accessory === item.key;
                const canAfford = profile.points >= item.price;

                return (
                  <div
                    key={item.key}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border text-center",
                      equipped ? "border-primary/40 bg-primary/10" : "border-border/50 bg-muted/30"
                    )}
                  >
                    <div className="text-3xl">{item.emoji}</div>
                    <div className="text-xs font-semibold">{item.name}</div>
                    {owned ? (
                      <Button
                        size="sm"
                        variant={equipped ? "outline" : "default"}
                        className="w-full text-xs h-7"
                        disabled={setAccessory.isPending}
                        onClick={() => setAccessory.mutate(equipped ? null : item.key)}
                      >
                        {equipped ? (
                          <><Check className="w-3 h-3 mr-1" /> Equipped</>
                        ) : (
                          "Equip"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7"
                        disabled={!canAfford || purchase.isPending}
                        onClick={() => purchase.mutate(item.key)}
                      >
                        {!canAfford && <Lock className="w-3 h-3 mr-1" />}
                        {item.price} pts
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageTransition>
  );
}
