import { memo, useId, type CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { BorderDecoration } from "./border-decoration";
import { AccessoryDecoration } from "./accessory-decoration";
import { cn } from "@/lib/utils";
import { apiAssetUrl } from "@/lib/api";
import { isBorderKey } from "@/lib/cosmetics";
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
  /** Photo size stays fixed; only the space around its artwork changes. */
  presentation?: "compact" | "showcase" | "stack"
}

function UserAvatarComponent({ user, className, style, accessory, photoUrl, border, presentation = "compact" }: UserAvatarProps) {
  const uid = useId();
  const reducedMotion = useReducedMotion();
  const paired = ANIMATED_COSMETIC_SETS.find(set => set.borderKey === border && set.accessoryKey === accessory);
  // Every cosmetic gets the same footprint and the same photo diameter.
  // Intrinsic grid tracks reserve room before paint, without measuring the DOM.
  const gutter = presentation === "showcase" ? 1.05 : presentation === "stack" ? 0 : .9;
  const frameStyle: CSSProperties = {
    gridTemplateColumns: `${gutter}fr 1fr ${gutter}fr`,
    gridTemplateRows: `${gutter}fr 1fr ${gutter}fr`,
  };

  return (
    <div data-user-avatar data-presentation={presentation} className="relative inline-grid w-max align-middle shrink-0 isolate overflow-visible" style={frameStyle}>
      <div data-avatar-face className={cn("relative col-start-2 row-start-2 w-10 h-10 rounded-full", className)} style={style}>
        {paired ? <AnimatedCatalogDecoration entry={paired} uid={`${uid}-back`} kind="set" layer="back" animated={!reducedMotion} /> : <>
          <AccessoryDecoration accessory={accessory} layer="back" />
          <BorderDecoration border={border} layer="back" />
        </>}
        <Avatar data-avatar-photo className={cn("w-full h-full border-2 border-background bg-muted relative z-10", isBorderKey(border) && "border-0")}>
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
    previous.presentation === next.presentation &&
    sameStyle(previous.style, next.style),
);
UserAvatar.displayName = "UserAvatar";
