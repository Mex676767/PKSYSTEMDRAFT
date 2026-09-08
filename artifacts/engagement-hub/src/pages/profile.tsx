import { useState } from "react";
import { PageTransition, slideUp, staggerContainer } from "@/components/animations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import { Flame, Award, ShoppingBag, Check, Lock, AlertTriangle, Cake } from "lucide-react";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { TITLE_CATALOG } from "@/lib/titles";
import { getAccessoryEmoji } from "@/lib/accessories";
import {
  useAccessoryCatalog,
  usePurchaseAccessory,
  useSetActiveAccessory,
  useSetActiveTitle,
} from "@/hooks/use-profile-customization";
import { useDeleteOwnAccount } from "@/hooks/use-admin";
import { useSetMyBirthday } from "@/hooks/use-birthdays";
import { DatePicker } from "@/components/date-picker";
import { getErrorMessage, cn } from "@/lib/utils";
import { format } from "date-fns";

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

      {/* Birthday */}
      <motion.div variants={slideUp} initial="hidden" animate="show">
        <Card className="border-secondary/20 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cake className="w-5 h-5 text-secondary" /> Birthday
            </CardTitle>
            <CardDescription>
              {profile.birthday
                ? "Set once — ask an admin if you need to change it."
                : "Set it once so the team can celebrate with you. You can't change it yourself afterward."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BirthdayField birthday={profile.birthday} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={slideUp} initial="hidden" animate="show">
        <Card className="border-destructive/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertTriangle className="w-5 h-5" /> Danger Zone
            </CardTitle>
            <CardDescription>
              Deletes your account: signs you out and hides your profile everywhere. Your past goals/posts stay attributed to your username.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountButton username={profile.username ?? ""} />
          </CardContent>
        </Card>
      </motion.div>
    </PageTransition>
  );
}

function BirthdayField({ birthday }: { birthday: string | null }) {
  const setBirthday = useSetMyBirthday();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (birthday) {
    const [, month, day] = birthday.split("-").map(Number);
    return (
      <p className="text-sm font-medium">
        🎂 {format(new Date(2000, month - 1, day), "MMMM d")}
      </p>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setError(null);
    setBirthday.mutate(value, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <DatePicker
        value={value || null}
        onChange={setValue}
        maxDate={format(new Date(), "yyyy-MM-dd")}
        className="w-40"
      />
      <Button type="submit" size="sm" disabled={!value || setBirthday.isPending}>
        {setBirthday.isPending ? "Saving..." : "Set Birthday"}
      </Button>
      {error && <p className="text-xs text-destructive w-full">{error}</p>}
    </form>
  );
}

function DeleteAccountButton({ username }: { username: string }) {
  const deleteAccount = useDeleteOwnAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete My Account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Type <strong className="text-foreground">@{username}</strong> to confirm. This can be undone by an admin, but you'll be signed out immediately.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`@${username}`}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          />
          <Button
            variant="destructive"
            className="w-full"
            disabled={confirmText !== `@${username}` || deleteAccount.isPending}
            onClick={() => deleteAccount.mutate()}
          >
            {deleteAccount.isPending ? "Deleting..." : "Permanently Delete Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
