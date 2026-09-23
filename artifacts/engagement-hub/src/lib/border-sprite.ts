import type { BorderKey } from "./cosmetics";

export const BORDER_SPRITE = {
  url: `${import.meta.env.BASE_URL}cosmetics/borders-reference.png`,
  width: 1448,
  height: 1086,
};

/** Measured from the inner photo openings, NOT the animation centres in the
 * reference demo (especially its second row). Bounds contain artwork only.
 * r is the photo radius in source pixels; the avatar always maps to 0..100.
 */
export const BORDER_CROPS: Record<
  BorderKey,
  {
    cx: number;
    cy: number;
    r: number;
    x: number;
    y: number;
    w: number;
    h: number;
    accent: string;
  }
> = {
  "cosmic-orbit": {
    cx: 217,
    cy: 357,
    r: 71,
    x: 88,
    y: 245,
    w: 248,
    h: 203,
    accent: "#ffd36d",
  },
  "pixel-glitch": {
    cx: 555,
    cy: 356,
    r: 70,
    x: 433,
    y: 251,
    w: 244,
    h: 197,
    accent: "#5df5ff",
  },
  "electric-pulse": {
    cx: 894,
    cy: 358,
    r: 69,
    x: 774,
    y: 244,
    w: 245,
    h: 207,
    accent: "#70eeff",
  },
  "sakura-bloom": {
    cx: 1233,
    cy: 358,
    r: 69,
    x: 1116,
    y: 249,
    w: 230,
    h: 202,
    accent: "#ffd0ed",
  },
  "trophy-halo": {
    cx: 217,
    cy: 723,
    r: 69,
    x: 104,
    y: 605,
    w: 226,
    h: 210,
    accent: "#ffe3a1",
  },
  "crystal-prism": {
    cx: 554,
    cy: 720,
    r: 69,
    x: 443,
    y: 608,
    w: 227,
    h: 208,
    accent: "#b8faff",
  },
  "meteor-trail": {
    cx: 894,
    cy: 731,
    r: 66,
    x: 779,
    y: 612,
    w: 230,
    h: 208,
    accent: "#fff1a4",
  },
  "galaxy-crown": {
    cx: 1232,
    cy: 722,
    r: 68,
    x: 1110,
    y: 603,
    w: 250,
    h: 218,
    accent: "#f2afff",
  },
};
