import { Link, useLocation } from "wouter";
import { Home, Target, Rss, Swords, MessageSquare, Trophy, Users, Cake, Gift, LogOut, UserCircle, Gamepad2, ShieldAlert, Dices, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { titleLabel } from "@/lib/titles";
import { getAccessoryEmoji } from "@/lib/accessories";
import { LOCKED_ROUTES } from "@/lib/feature-flags";
import { useConversations } from "@/hooks/use-dm";
import { UserAvatar } from "./user-avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/social", label: "Social", icon: Rss },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/hall-of-fame", label: "Hall of Fame", icon: Trophy },
  { href: "/mentors", label: "Mentors", icon: Users },
  { href: "/birthdays", label: "Birthdays", icon: Cake },
  { href: "/lottery", label: "Lucky Draw", icon: Gift },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/betting", label: "Betting", icon: Dices },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const items = isAdmin ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldAlert }] : navItems;
  const { unreadCounts } = useConversations();
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row app-gradient-bg">
      {}
      {}
      <nav className="fixed bottom-0 left-0 right-0 md:sticky md:top-0 md:w-64 bg-card border-t md:border-t-0 md:border-r border-border z-40 flex md:flex-col md:h-screen">
        <div className="hidden md:flex p-6 items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-sm">
            <Trophy className="w-6 h-6" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">C9MYR</span>
        </div>

        {}
        <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:flex-1 w-full p-2 md:p-4 gap-1 md:gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const isLocked = LOCKED_ROUTES.has(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col md:flex-row items-center gap-1 md:gap-3 py-2 px-3 md:px-4 md:py-3 rounded-xl transition-all min-w-[70px] md:min-w-0 flex-shrink-0 font-medium text-xs md:text-sm",
                  isActive
                    ? "bg-primary/10 text-primary md:bg-primary md:text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isLocked && !isActive && "opacity-60"
                )}
              >
                <span className="relative">
                  <Icon className={cn("w-5 h-5", isActive && "md:text-primary-foreground")} />
                  {item.href === "/messages" && totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  {item.label}
                  {isLocked && <Clock className="w-3 h-3 shrink-0" />}
                </span>
              </Link>
            );
          })}
        </div>

        {profile && (
          <div className="hidden md:flex p-4 border-t border-border mt-auto items-center gap-3">
            <UserAvatar
              user={{
                name: profile.username ?? profile.email,
                initials: initialsForUsername(profile.username ?? profile.email),
                color: colorForId(profile.id),
              }}
              accessory={profile.active_accessory ? getAccessoryEmoji(profile.active_accessory) : null}
              photoUrl={profile.avatar_url}
              border={profile.active_border}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">@{profile.username ?? profile.email}</p>
              <p className="text-xs text-muted-foreground truncate">
                {profile.active_title ? `${titleLabel(profile.active_title)} · ` : ""}{profile.points} pts
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </nav>

      {}
      <main className="flex-1 w-full pt-16 pb-20 md:pb-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
