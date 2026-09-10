import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Bell, MessageCircle, Heart, Swords, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<AppNotification["type"], LucideIcon> = {
  comment: MessageCircle,
  reaction: Heart,
  challenge: Swords,
};

// Where clicking a notification should take you -- keyed by target_type.
const TARGET_LINK: Record<string, string> = {
  goal: "/goals",
  birthday: "/birthdays",
  post: "/social",
  hof_record: "/hall-of-fame",
  challenge: "/challenges",
};

export function NotificationBell() {
  const { session } = useAuth();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [isOpen]);

  if (!session) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div ref={rootRef} className="fixed top-4 right-[68px] z-50">
      <button
        onClick={() => setIsOpen((o) => !o)}
        title="Notifications"
        className="relative w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:scale-110 active:scale-95 transition-transform"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border sticky top-0 bg-card">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead.mutate()} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type];
                const href = TARGET_LINK[n.target_type ?? ""] ?? "/";
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        !n.read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
