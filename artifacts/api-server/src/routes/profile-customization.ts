import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { assertAllowedBrowserOrigin, requireApprovedSession, requireSession } from "../middleware/session-auth";
import { isValidAvatarUrl } from "../lib/avatar-url";
import { ANIMATED_BORDER_KEYS, ANIMATED_ACCESSORY_KEYS } from "../lib/animated-cosmetic-keys";

const router: IRouter = Router();
const ACCESSORIES = new Set<string>(["angel-wings", "neon-headphones", "rocket-pack", "wizard-hat", "cyber-cat-ears", "lightning-bolt-aura", "floating-hearts", "pixel-sword", "mini-planet", "champion-laurel", ...ANIMATED_ACCESSORY_KEYS]);
const BORDERS = new Set<string>(["cosmic-orbit", "pixel-glitch", "electric-pulse", "sakura-bloom", "trophy-halo", "crystal-prism", "meteor-trail", "galaxy-crown", ...ANIMATED_BORDER_KEYS]);

// Save a matched look in one update, so a failed equip can never leave half a set.
router.patch("/profile/customization/set", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { border, accessory } = req.body ?? {};
  if ((border !== null && (typeof border !== "string" || !BORDERS.has(border))) ||
      (accessory !== null && (typeof accessory !== "string" || !ACCESSORIES.has(accessory)))) {
    res.status(400).json({ error: "Profile customization is invalid." }); return;
  }
  try {
    const result = await pool.query("update public.profiles set active_border = $2, active_accessory = $3 where id = $1 returning id",
      [req.sessionUser!.id, border, accessory]);
    if (!result.rowCount) { res.status(404).json({ error: "Profile not found." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.patch("/profile/customization/:kind", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const kind = Array.isArray(req.params.kind) ? req.params.kind[0] : req.params.kind;
  const { value } = req.body ?? {};
  if (!["title", "border", "accessory"].includes(kind) || (value !== null && typeof value !== "string")) {
    res.status(400).json({ error: "Profile customization is invalid." }); return;
  }
  if ((kind === "border" && value !== null && !BORDERS.has(value)) || (kind === "accessory" && value !== null && !ACCESSORIES.has(value)) || (kind === "title" && typeof value === "string" && value.length > 80)) {
    res.status(400).json({ error: "Profile customization is invalid." }); return;
  }
  try {
    const column = kind === "title" ? "active_title" : kind === "border" ? "active_border" : "active_accessory";
    const result = await pool.query(
      `update public.profiles set ${column} = $2
        where id = $1 and ($2::text is null or $3::text <> 'title' or $2 = any(unlocked_titles))
        returning id`,
      [req.sessionUser!.id, value, kind],
    );
    if (!result.rowCount) { res.status(400).json({ error: "That title has not been unlocked." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

router.patch("/profile/avatar-url", requireSession, requireApprovedSession, assertAllowedBrowserOrigin, async (req, res, next) => {
  const { avatar_url: avatarUrl } = req.body ?? {};
  if (!isValidAvatarUrl(avatarUrl, req.sessionUser!.id)) {
    res.status(400).json({ error: "Avatar URL is invalid." }); return;
  }
  try {
    await pool.query("update public.profiles set avatar_url = $2 where id = $1", [req.sessionUser!.id, avatarUrl]);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
