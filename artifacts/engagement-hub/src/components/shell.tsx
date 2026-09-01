import { Link, useLocation } from "wouter";
import { Home, Target, Swords, Trophy, Users, Cake, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-mock-api";
import { UserAvatar } from "./user-avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/hall-of-fame", label: "Hall of Fame", icon: Trophy },
  { href: "/mentors", label: "Mentors", icon: Users },
  { href: "/birthdays", label: "Birthdays", icon: Cake },
  { href: "/lottery", label: "Lucky Draw", icon: Gift },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useCurrentUser();

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 md:relative md:w-64 bg-card border-t md:border-t-0 md:border-r border-border z-40 flex md:flex-col justify-between md:min-h-screen">
        <div className="hidden md:flex p-6 items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-sm">
            <Trophy className="w-6 h-6" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">Hub</span>
        </div>

        <div className="flex md:flex-col overflow-x-auto md:overflow-visible w-full p-2 md:p-4 gap-1 md:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col md:flex-row items-center gap-1 md:gap-3 py-2 px-3 md:px-4 md:py-3 rounded-xl transition-all min-w-[70px] md:min-w-0 flex-shrink-0 font-medium text-xs md:text-sm",
                  isActive 
                    ? "bg-primary/10 text-primary md:bg-primary md:text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "md:text-primary-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {user && (
          <div className="hidden md:flex p-4 border-t border-border mt-auto items-center gap-3">
            <UserAvatar user={user} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.points} pts</p>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 w-full pb-20 md:pb-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
