import type { CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { BorderDecoration } from "./border-decoration";
import { AccessoryDecoration } from "./accessory-decoration";
import { cn } from "@/lib/utils";
import { isBorderKey } from "@/lib/cosmetics";

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
    <div className="relative inline-flex align-middle shrink-0 isolate overflow-visible">
      <AccessoryDecoration accessory={accessory} layer="back" />
      <Avatar className={cn("border-2 border-background bg-muted relative z-10", className, isBorderKey(border) && "border-0")} style={style}>
        {photoUrl && <AvatarImage src={photoUrl} alt={user.name} />}
        <AvatarFallback className={cn("text-white font-bold", user.color)}>
          {user.initials}
        </AvatarFallback>
      </Avatar>
      <BorderDecoration border={border} />
      <AccessoryDecoration accessory={accessory} layer="front" />
    </div>
  );
}
