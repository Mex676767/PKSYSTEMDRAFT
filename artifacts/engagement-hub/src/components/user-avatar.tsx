import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: { initials: string; color: string; name: string };
  className?: string;
  /** Emoji shown as a small badge overlay, e.g. a purchased profile accessory. */
  accessory?: string | null;
}

export function UserAvatar({ user, className, accessory }: UserAvatarProps) {
  return (
    <div className="relative inline-block shrink-0">
      <Avatar className={cn("border-2 border-background", className)}>
        <AvatarFallback className={cn("text-white font-bold", user.color)}>
          {user.initials}
        </AvatarFallback>
      </Avatar>
      {accessory && (
        <span className="absolute -bottom-1 -right-1 text-xs bg-card border border-border rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {accessory}
        </span>
      )}
    </div>
  );
}
