import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getBorderStyle } from "@/lib/borders";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: { initials: string; color: string; name: string };
  className?: string;
  /** Emoji shown as a small badge overlay, e.g. a purchased profile accessory. */
  accessory?: string | null;
  /** Uploaded profile photo -- falls back to the initials avatar when absent. */
  photoUrl?: string | null;
  /** Key into BORDER_STYLES, e.g. a purchased Discord-style profile border. */
  border?: string | null;
}

export function UserAvatar({ user, className, accessory, photoUrl, border }: UserAvatarProps) {
  const borderStyle = getBorderStyle(border);

  return (
    <div className={cn("relative inline-block shrink-0", borderStyle && "rounded-full p-[3px]", borderStyle)}>
      <Avatar className={cn("border-2 border-background", className)}>
        {photoUrl && <AvatarImage src={photoUrl} alt={user.name} />}
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
