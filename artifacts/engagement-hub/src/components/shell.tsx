import { Link, useLocation } from "wouter";
import { Home, Target, Rss, Swords, MessageSquare, Trophy, Users, Cake, Gift, LogOut, UserCircle, Gamepad2, ShieldAlert, Dices, Clock, PartyPopper, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { titleLabel } from "@/lib/titles";
import { getAccessoryEmoji } from "@/lib/accessories";
import { LOCKED_ROUTES } from "@/lib/feature-flags";
import { useConversations } from "@/hooks/use-dm";
import { isBirthdayToday } from "@/hooks/use-birthdays";
import { useDiscordPresenceMap } from "@/hooks/use-discord";
import { discordStatusLabel } from "@/lib/discord";
import { BirthdayCelebration } from "./birthday-celebration";
import { DiscordStatusDot } from "./discord-status-dot";
import { UserAvatar } from "./user-avatar";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/birthdays", label: "Birthdays", icon: Cake },
  { href: "/social", label: "Social", icon: Rss },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/hall-of-fame", label: "Hall of Fame", icon: Trophy },
  { href: "/mentors", label: "Mentors", icon: Users },
  { href: "/lottery", label: "Lucky Draw", icon: Gift },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/betting", label: "Betting", icon: Dices },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const items = isAdmin ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldAlert }] : navItems;
  const { unreadCounts } = useConversations();
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
  const isMyBirthdayToday = isBirthdayToday(profile?.birthday);
  const { data: presenceMap } = useDiscordPresenceMap();
  const myPresence = profile ? presenceMap?.get(profile.id) : undefined;

  return (
    <div className={cn("min-h-[100dvh] app-gradient-bg relative", isMyBirthdayToday && "birthday-mode")}>
      <BirthdayCelebration active={isMyBirthdayToday} />

      <div className="fixed top-4 inset-x-4 z-40 flex items-center gap-3">
        <nav className="min-w-0 flex items-center gap-1 bg-card/70 backdrop-blur-xl border border-border rounded-full shadow-lg px-2 py-2 overflow-x-auto">
          <Link href="/" className="flex items-center gap-2 pl-2 pr-3 shrink-0">
            <div className="bg-gradient-flame text-primary-foreground w-7 h-7 rounded-lg shadow-glow-primary flex items-center justify-center shrink-0">
              <Trophy className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline font-display font-bold text-sm tracking-tight whitespace-nowrap">C9MYR</span>
          </Link>

          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const isLocked = LOCKED_ROUTES.has(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 py-2 px-3 rounded-full transition-all shrink-0 font-medium text-xs whitespace-nowrap",
                  isActive
                    ? "bg-gradient-flame text-primary-foreground shadow-glow-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isLocked && !isActive && "opacity-60"
                )}
              >
                <span className="relative">
                  <Icon className="w-4 h-4" />
                  {item.href === "/messages" && totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-destructive text-white text-[8px] font-bold flex items-center justify-center">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </span>
                <span className="hidden sm:flex items-center gap-1">
                  {item.label}
                  {isLocked && <Clock className="w-3 h-3 shrink-0" />}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 shrink-0">
        <NotificationBell />
        <ThemeToggle />

        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0 flex items-center gap-1.5 bg-card/70 backdrop-blur-xl border border-border rounded-full shadow-lg p-1.5 pr-2.5 hover:border-foreground/30 transition-colors">
                <div className="relative shrink-0">
                  <UserAvatar
                    user={{
                      name: profile.username ?? profile.email,
                      initials: initialsForUsername(profile.username ?? profile.email),
                      color: colorForId(profile.id),
                    }}
                    accessory={profile.active_accessory ? getAccessoryEmoji(profile.active_accessory) : null}
                    photoUrl={profile.avatar_url}
                    border={profile.active_border}
                    className="w-8 h-8"
                  />
                  <DiscordStatusDot presence={myPresence} className="w-2.5 h-2.5 absolute bottom-0 right-0" />
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold truncate">@{profile.username ?? profile.email}</p>
                {isMyBirthdayToday ? (
                  <p className="text-xs font-semibold text-secondary truncate flex items-center gap-1 mt-0.5">
                    <PartyPopper className="w-3 h-3" /> It's your birthday!
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground font-normal truncate mt-0.5">
                    {profile.active_title ? `${titleLabel(profile.active_title)} · ` : ""}{profile.points} pts
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground font-normal truncate mt-1 flex items-center gap-1.5">
                  <DiscordStatusDot presence={myPresence} className="w-2 h-2" /> {discordStatusLabel(myPresence)}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                  <UserCircle className="w-4 h-4" /> Profile
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                    <ShieldAlert className="w-4 h-4" /> Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        </div>
      </div>

      <main className="w-full pt-24 md:pt-28 pb-10 px-4 md:px-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
