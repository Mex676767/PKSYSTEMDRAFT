import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Target, Rss, Swords, MessageSquare, Trophy, Medal, Users, Cake, Gift, LogOut, UserCircle, Gamepad2, ShieldAlert, Dices, Clock, PartyPopper, ChevronDown, ChevronRight, ChevronLeft, Radio, ShoppingBag, BookOpen, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRevampEnabled } from "@/hooks/use-rewards";
import { useAuth, colorForId, initialsForUsername } from "@/hooks/use-auth";
import { LOCKED_ROUTES } from "@/lib/feature-flags";
import { useConversations } from "@/hooks/use-dm";
import { useVoiceCall } from "@/hooks/use-voice-call";
import { isBirthdayToday } from "@/hooks/use-birthdays";
import { BirthdayCelebration } from "./birthday-celebration";
import { ConfettiBurstOnClick } from "./confetti-burst";
import { CursorSparkleTrail } from "./cursor-sparkle-trail";
import { Fireflies } from "./fireflies";
import { TabVisibilityPause } from "./tab-visibility-pause";
import { UserAvatar } from "./user-avatar";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { GratitudeCelebration } from "./gratitude-celebration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAchievements } from "@/hooks/use-achievements";
import { BRAND_NAME, BRAND_LOGO } from "@/lib/brand";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/birthdays", label: "Birthdays", icon: Cake },
  { href: "/social", label: "Social", icon: Rss },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/rewards", label: "Rewards", icon: ShoppingBag },
  { href: "/learning", label: "Learning Hub", icon: BookOpen },
  { href: "/gratitude", label: "Gratitude", icon: HeartHandshake },
  { href: "/hall-of-fame", label: "Hall of Fame", icon: Trophy },
  { href: "/guinness-records", label: "Guinness Records", icon: Medal },
  { href: "/mentors", label: "Mentors", icon: Users },
  { href: "/lottery", label: "Lucky Draw", icon: Gift },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/betting", label: "Betting", icon: Dices },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const revampEnabled = useRevampEnabled();
  const { label: titleLabel } = useAchievements();
  // Rewards only appears while an admin has missions + the shop switched on.
  const items = navItems.filter((item) => item.href !== "/rewards" || revampEnabled);
  const { channelId: voiceChannelId } = useVoiceCall();
  const { unreadCounts } = useConversations();
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
  const isMyBirthdayToday = isBirthdayToday(profile?.birthday);
  const navRef = useRef<HTMLElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateScrollState = () => {
      setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
      setCanScrollLeft(el.scrollLeft > 4);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    updateScrollState();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [items.length]);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active) nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
  }, [location]);

  const scrollNavRight = () => {
    navRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  const scrollNavLeft = () => {
    navRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  };

  return (
    <div className={cn("min-h-[100dvh] relative", isMyBirthdayToday && "birthday-mode")}>
      <div className="fixed inset-0 -z-10 pointer-events-none app-gradient-bg atmosphere-hue" />
      <TabVisibilityPause />
      <BirthdayCelebration active={isMyBirthdayToday} />
      <GratitudeCelebration />
      <ConfettiBurstOnClick />
      <CursorSparkleTrail />
      <Fireflies />

      <div className="fixed top-4 inset-x-4 z-40 flex flex-col gap-2 xl:block xl:h-14">
        <div className="flex items-center justify-center xl:absolute xl:inset-y-0 xl:left-[280px] xl:right-[280px]">
        <div data-tree-obstacle className="flex items-center max-w-[min(88vw,52rem)] min-w-0 bg-card/90 backdrop-blur-xl border border-border rounded-full shadow-lg px-2">
          <button type="button" onClick={scrollNavLeft} disabled={!canScrollLeft} aria-label="Scroll navigation left" className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>
          <nav ref={navRef} aria-label="Main navigation" className="relative min-w-0 flex items-center gap-1 px-1 py-2 overflow-x-auto">
          <Link href="/" className="flex items-center gap-2 pl-2 pr-3 shrink-0">
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img src={BRAND_LOGO} alt="" className="w-9 h-9 object-contain" />
            </div>
            <span className="hidden sm:inline font-display font-bold text-sm tracking-tight whitespace-nowrap">{BRAND_NAME}</span>
          </Link>

          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            const isLocked = LOCKED_ROUTES.has(item.href);

            return (
              <Link
                key={item.href}
                href={item.href} aria-current={isActive ? "page" : undefined}
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
                </span>
                <span className="hidden sm:flex items-center gap-1">
                  {item.label}
                  {isLocked && <Clock className="w-3 h-3 shrink-0" />}
                </span>
              </Link>
            );
          })}

          </nav>
          <button type="button" onClick={scrollNavRight} disabled={!canScrollRight} aria-label="Scroll navigation right" className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
        </div>
        </div>

        <div data-tree-obstacle className="flex items-center justify-end gap-2 xl:absolute xl:right-0 xl:top-0">
        {isAdmin && (
          <Link
            href="/voice"
            title="Voice Channels"
            className={cn(
              "relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              location.startsWith("/voice")
                ? "bg-gradient-flame text-primary-foreground shadow-glow-primary"
                : "bg-card/70 backdrop-blur-xl border border-border shadow-lg text-foreground hover:scale-110"
            )}
          >
            <Radio className="w-4 h-4" />
            {voiceChannelId && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
            )}
          </Link>
        )}
        <Link
          href="/messages"
          title="Messages"
          className={cn(
            "relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
            location.startsWith("/messages")
              ? "bg-gradient-flame text-primary-foreground shadow-glow-primary"
              : "bg-card/70 backdrop-blur-xl border border-border shadow-lg text-foreground hover:scale-110"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Link>
        <NotificationBell />
        <ThemeToggle />

        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0 flex items-center gap-3 bg-card/70 backdrop-blur-xl border border-border rounded-full shadow-lg p-1.5 sm:pr-2.5 hover:border-foreground/30 transition-colors">
                <div className="relative shrink-0">
                  <UserAvatar
                    user={{
                      name: profile.username ?? profile.email,
                      initials: initialsForUsername(profile.username ?? profile.email),
                      color: colorForId(profile.id),
                    }}
                    accessory={profile.active_accessory}
                    photoUrl={profile.avatar_url}
                    border={profile.active_border}
                    className="w-8 h-8"
                  />
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

      <main className="w-full pt-32 sm:pt-20 md:pt-24 pb-10 px-4 md:px-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
