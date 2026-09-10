import type { CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { BorderDecoration } from "./border-decoration";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: { initials: string; color: string; name: string };
  className?: string;
  /** Extra inline styles for the avatar circle itself, e.g. a context-colored ring. */
  style?: CSSProperties;
  /** Emoji shown as a small badge overlay, e.g. a purchased profile accessory. */
  accessory?: string | null;
  /** Uploaded profile photo -- falls back to the initials avatar when absent. */
  photoUrl?: string | null;
  /** Key into BorderDecoration's themes, e.g. a purchased Discord-style profile border. */
  border?: string | null;
}

export function UserAvatar({ user, className, style, accessory, photoUrl, border }: UserAvatarProps) {
  return (
    <div className="relative inline-block shrink-0">
      <BorderDecoration border={border} />
      <Avatar className={cn("border-2 border-background relative z-10", className)} style={style}>
        {photoUrl && <AvatarImage src={photoUrl} alt={user.name} />}
        <AvatarFallback className={cn("text-white font-bold", user.color)}>
          {user.initials}
        </AvatarFallback>
      </Avatar>
      {accessory && (
        <span className="absolute -bottom-1 -right-1 z-20 text-xs bg-card border border-border rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {accessory}
        </span>
      )}
    </div>
  );
}
