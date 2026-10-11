import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import type { Goal } from "@/hooks/use-goals";
import type { DirectoryProfile } from "@/hooks/use-mentors";
import { cn } from "@/lib/utils";
import { layoutPages, type ArtTransform, type Rect, type Size } from "@/components/goals-tree-layout";

function personCompletion(goals: Goal[]): number {
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
}

const IMAGE_WIDTH = 1884;
const IMAGE_HEIGHT = 835;
const IMAGE_RATIO = IMAGE_WIDTH / IMAGE_HEIGHT;
// lg+: the art is drawn "cover" and then zoomed a touch further, pinned to the top.
const EXTRA_ZOOM = 1.15;
// Below lg: the art is drawn at 108% of the stage, centred horizontally, pinned to the top.
const SMALL_ZOOM = 1.08;
const TREE_BACKGROUND_POSITION = "center 0%";

// When the viewport is smaller than this the stage keeps this size and the
// tree area scrolls, so the canopy never shrinks below a usable size. Anyone
// who still doesn't fit goes onto another page.
const LG_MIN_STAGE = { w: 1024, h: 700 };
const SMALL_MIN_STAGE_HEIGHT = 680;

// Selection is shown with the ring + glow only: growing the avatar would push
// the block into its neighbours' clear space.
const AVATAR_SIZE = 36;

// The floating video-call window in the top-right corner (the browser's
// picture-in-picture call window) isn't part of this page's DOM, so it can't
// be measured -- keep that corner clear on desktop.
const RESERVED_VIEWPORT_ZONES_LG = [{ right: 100, top: 0, w: 290, h: 125 }];

const PAGER_SIZE = { w: 200, h: 40 };
const PAGER_BOTTOM_PX = 24;

function artTransform(stage: Size, isLgUp: boolean): ArtTransform {
  if (isLgUp) {
    const ratio = stage.w / stage.h;
    const s = Math.max(ratio / IMAGE_RATIO, 1) * EXTRA_ZOOM;
    const bgH = s * stage.h;
    const bgW = IMAGE_RATIO * bgH;
    return { offsetX: (stage.w - bgW) / 2, offsetY: 0, scaleX: bgW / IMAGE_WIDTH, scaleY: bgH / IMAGE_HEIGHT };
  }
  const bgW = stage.w * SMALL_ZOOM;
  const bgH = stage.h * SMALL_ZOOM;
  return { offsetX: (stage.w - bgW) / 2, offsetY: 0, scaleX: bgW / IMAGE_WIDTH, scaleY: bgH / IMAGE_HEIGHT };
}

/** A block's placed size, and where the button sits inside it (decorations can
 *  stick out above/left of the avatar, so the button isn't always at 0,0). */
type BlockSize = Size & { ox: number; oy: number };

// Accessories and borders are SVGs allowed to draw outside their box (wings,
// hats, orbits). Animated ones move a little, hence the margin.
const DECORATION_MARGIN_PX = 3;

function measureBlock(el: HTMLElement): BlockSize {
  // Bounding rect rather than offsetWidth/Height: those round, and a
  // rounded-down 65.3px block would eat into its neighbour's gap.
  const box = el.getBoundingClientRect();
  let left = box.left, top = box.top, right = box.right, bottom = box.bottom;
  el.querySelectorAll<SVGSVGElement>("svg.overflow-visible").forEach((svg) => {
    const vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    if (!vb || !vb.width || !vb.height || !r.width || !r.height) return;
    const sx = r.width / vb.width;
    const sy = r.height / vb.height;
    const add = (x: number, y: number, w: number, h: number) => {
      if (!w && !h) return;
      left = Math.min(left, r.left + (x - vb.x) * sx - DECORATION_MARGIN_PX);
      top = Math.min(top, r.top + (y - vb.y) * sy - DECORATION_MARGIN_PX);
      right = Math.max(right, r.left + (x - vb.x + w) * sx + DECORATION_MARGIN_PX);
      bottom = Math.max(bottom, r.top + (y - vb.y + h) * sy + DECORATION_MARGIN_PX);
    };
    // Borders show a window onto a big sprite sheet through a nested
    // <svg overflow="hidden">; getBBox() ignores that clip, so count the
    // window itself and measure everything else with the windows hidden.
    const windows = Array.from(svg.children).filter(
      (c): c is SVGSVGElement => c instanceof SVGSVGElement && c.getAttribute("overflow") === "hidden"
    );
    for (const w of windows) add(w.x.baseVal.value, w.y.baseVal.value, w.width.baseVal.value, w.height.baseVal.value);
    const prev = windows.map((w) => w.style.display);
    windows.forEach((w) => (w.style.display = "none"));
    try {
      const bb = svg.getBBox();
      add(bb.x, bb.y, bb.width, bb.height);
    } catch {
      // Not rendered (e.g. display:none ancestor): nothing extra to count.
    } finally {
      windows.forEach((w, i) => (w.style.display = prev[i]));
    }
  });
  const ox = Math.ceil(box.left - left);
  const oy = Math.ceil(box.top - top);
  return { w: Math.ceil(right - box.left) + ox, h: Math.ceil(bottom - box.top) + oy, ox, oy };
}

/** Where the button goes inside its placed block. */
function nodeSlot(block: Rect | undefined, size: BlockSize | undefined): Rect | null {
  if (!block) return null;
  return { ...block, x: block.x + (size?.ox ?? 0), y: block.y + (size?.oy ?? 0) };
}

function sameRects(a: Rect[], b: Rect[]) {
  return a.length === b.length && a.every((r, i) => r.x === b[i].x && r.y === b[i].y && r.w === b[i].w && r.h === b[i].h);
}

function TreePersonNode(
  {
    person,
    goals,
    slot,
    selected,
    onClick,
    measureRef,
  }: {
    person: DirectoryProfile;
    goals: Goal[];
    slot: Rect | null;
    selected: boolean;
    onClick: () => void;
    measureRef: (el: HTMLButtonElement | null) => void;
  }
) {
  const completion = personCompletion(goals);
  const pillColor = colorForId(person.id);
  const avatarSize = AVATAR_SIZE;

  return (
    <button
      ref={measureRef}
      type="button"
      onClick={onClick}
      data-tree-node={person.id}
      className={cn(
        "absolute flex flex-col items-center gap-0.5 group z-10 hover:z-20",
        !slot && "invisible pointer-events-none"
      )}
      style={slot ? { left: slot.x, top: slot.y } : { left: 0, top: 0 }}
      aria-hidden={slot ? undefined : true}
      tabIndex={slot ? undefined : -1}
      title={`@${person.username}: ${completion}% of goals`}
    >
      <span className="relative shrink-0 rounded-full">
        {selected && (
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full blur-md pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(232,121,249,0.6), transparent 70%)" }}
          />
        )}
        <UserAvatar
          user={{ initials: initialsForUsername(person.username), color: colorForId(person.id), name: person.username }}
          photoUrl={person.avatar_url}
          border={person.active_border}
          accessory={person.active_accessory}
          style={{ width: avatarSize, height: avatarSize }}
          className={cn(
            "relative z-10 border-2 border-white shadow-md group-hover:scale-110 transition-transform",
            selected && "ring-2 ring-fuchsia-400"
          )}
        />
      </span>

      <span className="flex flex-col items-center leading-none">
        <span className="text-[9px] font-bold text-white bg-black/55 backdrop-blur-sm rounded-full px-1.5 py-0.5 whitespace-nowrap max-w-[84px] truncate">
          @{person.username}
        </span>
        <span className={cn("mt-0.5 text-[8px] font-bold text-white rounded-full px-1.5 py-0.5 whitespace-nowrap", pillColor)}>
          {completion}%
        </span>
      </span>
    </button>
  );
}

export function GoalsTreeView({
  people,
  goalsByOwner,
  onSelect,
  selectedId,
  header,
}: {
  people: DirectoryProfile[];
  goalsByOwner: Map<string, Goal[]>;
  onSelect: (person: DirectoryProfile) => void;
  selectedId: string | null;
  header?: React.ReactNode
}) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const bgFile = isLight ? "tree-bg-light.png" : "tree-bg.png";

  const [isLgUp, setIsLgUp] = useState(false);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [blockSizes, setBlockSizes] = useState<Map<string, BlockSize>>(new Map());
  const [obstacles, setObstacles] = useState<Rect[]>([]);
  const [page, setPage] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLButtonElement>());
  const centredFor = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Placement is a few hundred ms for a crowded tree, so settle on the new
    // size before re-running it rather than on every frame of a drag-resize.
    let timer: number | undefined;
    const apply = () => {
      const w = el.clientWidth;
      const h = window.innerHeight;
      if (w > 0 && h > 0) setViewport((v) => (v && v.w === w && v.h === h ? v : { w, h }));
    };
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        apply();
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const stage = useMemo<Size | null>(() => {
    if (!viewport) return null;
    if (isLgUp) return { w: Math.max(viewport.w, LG_MIN_STAGE.w), h: Math.max(viewport.h, LG_MIN_STAGE.h) };
    const h = Math.max(viewport.w / IMAGE_RATIO, SMALL_MIN_STAGE_HEIGHT);
    return { w: Math.max(viewport.w, h * IMAGE_RATIO), h };
  }, [viewport, isLgUp]);
  const art = useMemo(() => (stage ? artTransform(stage, isLgUp) : null), [stage, isLgUp]);

  // Below lg the stage is wider than the screen; start with the canopy centred.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stage || centredFor.current === stage.w) return;
    centredFor.current = stage.w;
    el.scrollLeft = (stage.w - el.clientWidth) / 2;
  }, [stage]);

  // Measure every person's full block (avatar + name + percentage, plus
  // whatever their border or accessory draws outside the avatar); that whole
  // rectangle is what gets placed and collision-checked.
  const measureKey = people
    .map((p) => `${p.id}:${p.username}:${p.active_border}:${p.active_accessory}:${personCompletion(goalsByOwner.get(p.id) ?? [])}`)
    .join("|");
  useLayoutEffect(() => {
    const next = new Map<string, BlockSize>();
    for (const p of people) {
      const el = nodeEls.current.get(p.id);
      if (!el) continue;
      next.set(p.id, measureBlock(el));
    }
    setBlockSizes((prev) => {
      const same = (a: BlockSize | undefined, b: BlockSize) => !!a && a.w === b.w && a.h === b.h && a.ox === b.ox && a.oy === b.oy;
      if (prev.size === next.size && [...next].every(([id, s]) => same(prev.get(id), s))) {
        return prev;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey]);

  // Everything the blocks must stay clear of, in stage coordinates.
  const measureObstacles = useCallback(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const s = stageEl.getBoundingClientRect();
    const toStage = (r: DOMRect): Rect => ({ x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height });
    const rects: Rect[] = [];
    // Fixed chrome (nav, call bar) only sits still over the tree on lg+, where
    // the tree is itself pinned full-screen. Below that the page scrolls and the
    // chrome passes over the tree like any other content.
    if (isLgUp) {
      document.querySelectorAll<HTMLElement>("[data-tree-obstacle]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push(toStage(r));
      });
    }
    const headerEl = headerRef.current;
    if (headerEl && headerEl.offsetParent !== null) {
      const parts = headerEl.querySelectorAll<HTMLElement>(":scope > * > * > *");
      (parts.length ? Array.from(parts) : [headerEl]).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push(toStage(r));
      });
    }
    if (isLgUp) {
      for (const z of RESERVED_VIEWPORT_ZONES_LG) {
        rects.push({ x: window.innerWidth - z.right - z.w - s.left, y: z.top - s.top, w: z.w, h: z.h });
      }
    }
    // Round outward so an obstacle never shrinks.
    const rounded = rects.map((r) => {
      const x = Math.floor(r.x), y = Math.floor(r.y);
      return { x, y, w: Math.ceil(r.x + r.w) - x, h: Math.ceil(r.y + r.h) - y };
    });
    setObstacles((prev) => (sameRects(prev, rounded) ? prev : rounded));
  }, [isLgUp]);

  useLayoutEffect(() => {
    measureObstacles();
  }, [measureObstacles, stage]);

  useEffect(() => {
    // Obstacles (nav, call bar, header) can appear, move or resize without the
    // stage itself changing, so keep an eye on them.
    const ro = new ResizeObserver(() => measureObstacles());
    if (headerRef.current) ro.observe(headerRef.current);
    document.querySelectorAll("[data-tree-obstacle]").forEach((el) => ro.observe(el));
    const id = window.setInterval(measureObstacles, 1500);
    return () => {
      ro.disconnect();
      window.clearInterval(id);
    };
  }, [measureObstacles]);

  const pages = useMemo(() => {
    if (!stage || !art || blockSizes.size === 0) return [];
    const pagerObstacle: Rect = {
      x: (stage.w - PAGER_SIZE.w) / 2,
      y: stage.h - PAGER_BOTTOM_PX - PAGER_SIZE.h,
      ...PAGER_SIZE,
    };
    return layoutPages({
      ids: people.map((p) => p.id),
      sizes: blockSizes,
      stage,
      art,
      obstacles: [...obstacles, pagerObstacle],
    });
  }, [people, blockSizes, stage, art, obstacles]);

  const pageCount = pages.length;
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));

  // Jump to whichever page holds the selected person (e.g. after a search).
  useEffect(() => {
    if (!selectedId) return;
    const idx = pages.findIndex((p) => p.has(selectedId));
    if (idx >= 0 && idx !== currentPage) setPage(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, pages]);

  const slots = pages[currentPage] ?? new Map<string, Rect>();

  return (
    <div
      ref={scrollerRef}
      className="relative w-full overflow-x-auto overflow-y-hidden lg:h-screen lg:overflow-auto"
      style={!isLgUp && stage ? { height: stage.h } : undefined}
    >
      <div
        ref={stageRef}
        className="relative bg-no-repeat"
        style={{
          width: stage?.w ?? "100%",
          height: stage?.h ?? (isLgUp ? "100vh" : undefined),
          aspectRatio: stage ? undefined : `${IMAGE_WIDTH} / ${IMAGE_HEIGHT}`,
          backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
          backgroundPosition: TREE_BACKGROUND_POSITION,
          backgroundSize: art ? `${IMAGE_WIDTH * art.scaleX}px ${IMAGE_HEIGHT * art.scaleY}px` : "cover",
        }}
      >
        <span className="sr-only">A glowing illustrated tree, each teammate growing somewhere in its canopy</span>

        {header && (
          <div
            aria-hidden
            className="hidden lg:block absolute inset-0 bg-no-repeat pointer-events-none"
            style={{
              backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
              backgroundPosition: TREE_BACKGROUND_POSITION,
              backgroundSize: art ? `${IMAGE_WIDTH * art.scaleX}px ${IMAGE_HEIGHT * art.scaleY}px` : "cover",
              filter: "blur(60px)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 8%, transparent 17%)",
              maskImage: "linear-gradient(to bottom, black 0%, black 8%, transparent 17%)",
            }}
          />
        )}

        {header && (
          <div
            ref={headerRef}
            className="hidden lg:block absolute inset-x-0 top-0 z-30 pt-20 px-6 pb-6 lg:pr-[22rem] xl:pt-24 xl:px-8 xl:pb-8 xl:pr-8 pointer-events-none [&_input]:pointer-events-auto [&_button]:pointer-events-auto"
          >
            {header}
          </div>
        )}

        {people.map((person) => (
          <TreePersonNode
            key={person.id}
            person={person}
            goals={goalsByOwner.get(person.id) ?? []}
            slot={nodeSlot(slots.get(person.id), blockSizes.get(person.id))}
            selected={person.id === selectedId}
            onClick={() => onSelect(person)}
            measureRef={(el) => {
              if (el) nodeEls.current.set(person.id, el);
              else nodeEls.current.delete(person.id);
            }}
          />
        ))}

        {pageCount > 1 && stage && (
          <div
            className="absolute z-20 flex items-center justify-between gap-2 rounded-full bg-black/55 backdrop-blur-sm text-white text-xs font-semibold px-1.5"
            style={{
              left: (stage.w - PAGER_SIZE.w) / 2,
              top: stage.h - PAGER_BOTTOM_PX - PAGER_SIZE.h,
              width: PAGER_SIZE.w,
              height: PAGER_SIZE.h,
            }}
          >
            <button
              type="button"
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-40"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
              disabled={currentPage >= pageCount - 1}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-40"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {people.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm text-center px-8 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
            No one matches your search.
          </div>
        )}
      </div>
    </div>
  );
}
