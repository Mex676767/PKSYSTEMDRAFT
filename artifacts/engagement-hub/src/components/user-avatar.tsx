import { memo, useId, type CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { BorderDecoration } from "./border-decoration";
import { AccessoryDecoration } from "./accessory-decoration";
import { cn } from "@/lib/utils";
import { apiAssetUrl } from "@/lib/api";
import { ACCESSORY_EXTENTS, BORDER_EXTENTS, isAccessoryKey, isBorderKey } from "@/lib/cosmetics";
import { avatarUrlForDisplay } from "@/lib/avatar-presets";
import { ANIMATED_COSMETIC_SETS } from "@/lib/animated-cosmetics";
import { AnimatedCatalogDecoration } from "./cosmetics/animated-catalog-decoration";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface UserAvatarProps {
  user: { initials: string; color: string; name: string };
  className?: string;
  style?: CSSProperties
  accessory?: string | null
  photoUrl?: string | null
  border?: string | null

}

function UserAvatarComponent({ user, className, style, accessory, photoUrl, border }: UserAvatarProps) {
  const uid = useId();
  const reducedMotion = useReducedMotion();
  const paired = ANIMATED_COSMETIC_SETS.find(set => set.borderKey === border && set.accessoryKey === accessory);
  const acc = isAccessoryKey(accessory) ? ACCESSORY_EXTENTS[accessory] : null;
  const bor = isBorderKey(border) ? BORDER_EXTENTS[border] : null;
  const left = Math.max(acc?.left ?? 0, bor?.left ?? 0);
  const right = Math.max(acc?.right ?? 0, bor?.right ?? 0);
  const top = Math.max(acc?.top ?? 0, bor?.top ?? 0);
  const bottom = Math.max(acc?.bottom ?? 0, bor?.bottom ?? 0);
  // Scale the entire composition inside the caller's fixed slot. Cosmetic
  // selection must never change a row, card header, stack or menu's geometry.
  const scale = 1 / Math.max(1 + left + right, 1 + top + bottom);
  const compositionStyle: CSSProperties = {
    transform: `translate(${(left - right) * scale * 50}%, ${(top - bottom) * scale * 50}%) scale(${scale})`,
  };

  return (
    <div data-user-avatar className={cn("relative inline-flex w-10 h-10 rounded-full align-middle shrink-0 isolate", className)} style={style}>
      <div className="absolute inset-0" style={compositionStyle}>
        {paired ? <AnimatedCatalogDecoration entry={paired} uid={`${uid}-back`} kind="set" layer="back" animated={!reducedMotion} /> : <>
          <AccessoryDecoration accessory={accessory} layer="back" />
          <BorderDecoration border={border} layer="back" />
        </>}
        <Avatar className={cn("w-full h-full border-2 border-background bg-muted relative z-10", isBorderKey(border) && "border-0")}>
          {photoUrl && <AvatarImage src={apiAssetUrl(avatarUrlForDisplay(photoUrl) ?? photoUrl)} alt={user.name} loading="lazy" decoding="async" />}
          <AvatarFallback className={cn("text-white font-bold", user.color)}>
            {user.initials}
          </AvatarFallback>
        </Avatar>
        {paired ? <AnimatedCatalogDecoration entry={paired} uid={`${uid}-front`} kind="set" layer="front" animated={!reducedMotion} /> : <>
          <BorderDecoration border={border} />
          <AccessoryDecoration accessory={accessory} layer="front" />
        </>}
      </div>
    </div>
  );
}

function sameStyle(a?: CSSProperties, b?: CSSProperties) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a) as (keyof CSSProperties)[];
  const bKeys = Object.keys(b) as (keyof CSSProperties)[];
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

export const UserAvatar = memo(
  UserAvatarComponent,
  (previous, next) =>
    previous.user.name === next.user.name &&
    previous.user.initials === next.user.initials &&
    previous.user.color === next.user.color &&
    previous.className === next.className &&
    previous.accessory === next.accessory &&
    previous.photoUrl === next.photoUrl &&
    previous.border === next.border &&
    sameStyle(previous.style, next.style),
);
UserAvatar.displayName = "UserAvatar";
