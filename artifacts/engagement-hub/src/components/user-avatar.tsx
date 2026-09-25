import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { BorderDecoration } from "./border-decoration";
import { AccessoryDecoration } from "./accessory-decoration";
import { cn } from "@/lib/utils";
import { ACCESSORY_EXTENTS, BORDER_EXTENTS, isAccessoryKey, isBorderKey } from "@/lib/cosmetics";

interface UserAvatarProps {
  user: { initials: string; color: string; name: string };
  className?: string;
  style?: CSSProperties
  accessory?: string | null
  photoUrl?: string | null
  border?: string | null
  /** Reserve room beside the avatar for wings, ears, borders and so on, so
   * they don't cover the name next to it. Off for overlapping stacks and
   * layouts that place avatars themselves (the goals tree). */
  reserveSpace?: boolean
}

export function UserAvatar({ user, className, style, accessory, photoUrl, border, reserveSpace = true }: UserAvatarProps) {
  const avatarRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(0);
  const acc = isAccessoryKey(accessory) ? ACCESSORY_EXTENTS[accessory] : null;
  const bor = isBorderKey(border) ? BORDER_EXTENTS[border] : null;
  const decorated = reserveSpace && !!(acc || bor);

  useLayoutEffect(() => {
    const el = avatarRef.current;
    if (!decorated || !el) return;
    setSize(el.offsetWidth);
    const ro = new ResizeObserver(() => setSize(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [decorated]);

  // Accessory and border art overlap, so the room needed on a side is the larger of the two.
  const side = (s: "left" | "right") => Math.ceil(Math.max(acc?.[s] ?? 0, bor?.[s] ?? 0) * size);
  const margins: CSSProperties | undefined = decorated && size
    ? { marginLeft: side("left"), marginRight: side("right") }
    : undefined;

  return (
    <div className="relative inline-flex h-fit align-middle shrink-0 isolate overflow-visible" style={margins}>
      <AccessoryDecoration accessory={accessory} layer="back" />
      <Avatar ref={avatarRef} className={cn("border-2 border-background bg-muted relative z-10", className, isBorderKey(border) && "border-0")} style={style}>
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
