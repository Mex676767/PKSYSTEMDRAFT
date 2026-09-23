import type { CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { BorderDecoration } from "./border-decoration";
import { AccessoryDecoration } from "./accessory-decoration";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: { initials: string; color: string; name: string };
  className?: string;
  style?: CSSProperties
  accessory?: string | null
  photoUrl?: string | null
  border?: string | null
}

export function UserAvatar({ user, className, style, accessory, photoUrl, border }: UserAvatarProps) {
  return (
    <div className="relative inline-block shrink-0 self-start">
      <BorderDecoration border={border} />
      <Avatar className={cn("border-2 border-background relative z-10", className)} style={style}>
        {photoUrl && <AvatarImage src={photoUrl} alt={user.name} />}
        <AvatarFallback className={cn("text-white font-bold", user.color)}>
          {user.initials}
        </AvatarFallback>
      </Avatar>
      <AccessoryDecoration accessory={accessory} />
    </div>
  );
}
