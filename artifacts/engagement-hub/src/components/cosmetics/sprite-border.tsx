import type { BorderKey } from "@/lib/cosmetics";
import { BORDER_CROPS, BORDER_SPRITE } from "@/lib/border-sprite";
import { BorderAccents } from "./border-accents";

/** Crop the untouched reference PNG in SVG source coordinates. SVG viewBoxes
 * give the same size-independent placement as percentage background positions,
 * while a luminance mask removes the baked-in dark card and placeholder icon.
 * No canvas readback, JS measurement, or replacement ring illustration.
 */
export function SpriteBorder({
  border,
  uid,
  animated,
}: {
  border: BorderKey;
  uid: string;
  animated: boolean;
}) {
  const c = BORDER_CROPS[border];
  const scale = 100 / (c.r * 2);
  const mask = `border-art-${uid}`;
  const ink = `border-ink-${uid}`;
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-20"
      aria-hidden="true"
      focusable="false"
    >
      <svg
        x={50 + (c.x - c.cx) * scale}
        y={50 + (c.y - c.cy) * scale}
        width={c.w * scale}
        height={c.h * scale}
        viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`}
        overflow="hidden"
      >
        <defs>
          <filter
            id={ink}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            {/* Keep saturated neon as well as white highlights; remove dark ink. */}
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 1.5 1.5 0 -0.6"
            />
          </filter>
          <mask
            id={mask}
            maskUnits="userSpaceOnUse"
            x={c.x}
            y={c.y}
            width={c.w}
            height={c.h}
            style={{ maskType: "luminance" }}
          >
            <image
              href={BORDER_SPRITE.url}
              width={BORDER_SPRITE.width}
              height={BORDER_SPRITE.height}
              filter={`url(#${ink})`}
            />
            <circle cx={c.cx} cy={c.cy} r={c.r - 1} fill="black" />
          </mask>
        </defs>
        <image
          href={BORDER_SPRITE.url}
          width={BORDER_SPRITE.width}
          height={BORDER_SPRITE.height}
          mask={`url(#${mask})`}
        />
      </svg>
      {/* Only the light accents move; crowns, flowers and ring art stay aligned. */}
      <BorderAccents border={border} animated={animated} />
    </svg>
  );
}
