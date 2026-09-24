import {
  FOLIAGE_MASK_COLS,
  FOLIAGE_MASK_IMAGE_HEIGHT,
  FOLIAGE_MASK_IMAGE_WIDTH,
  FOLIAGE_MASK_RLE,
  FOLIAGE_MASK_ROWS,
} from "./goals-tree-foliage-mask";

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

/** Where the tree artwork is drawn inside the stage, in stage pixels. */
export type ArtTransform = { offsetX: number; offsetY: number; scaleX: number; scaleY: number };

/** Minimum clear space between any two blocks, and between a block and an obstacle. */
export const BLOCK_GAP_PX = 8;
/** Stage pixels per occupancy-grid cell. Blocks snap to this grid. */
const GRID_PX = 2;
const GAP_CELLS = Math.ceil(BLOCK_GAP_PX / GRID_PX);
const SPREAD_SEEDS = 4;
const SPREAD_STRIDE = 2;
const PACK_STRIDE = 2;
const PACK_RINGS = [2, 1, 4];

// ---------------------------------------------------------------------------
// Foliage mask (see scripts/generate-tree-foliage-mask.py), decoded once into
// a summed-area table so "is this whole area leaves?" is an O(1) lookup.
// ---------------------------------------------------------------------------

const MASK_CELL_W = FOLIAGE_MASK_IMAGE_WIDTH / FOLIAGE_MASK_COLS;
const MASK_CELL_H = FOLIAGE_MASK_IMAGE_HEIGHT / FOLIAGE_MASK_ROWS;

let maskSat: Int32Array | null = null;

function foliageSat(): Int32Array {
  if (maskSat) return maskSat;
  const cols = FOLIAGE_MASK_COLS;
  const stride = cols + 1;
  const sat = new Int32Array((FOLIAGE_MASK_ROWS + 1) * stride);
  FOLIAGE_MASK_RLE.split(";").forEach((row, r) => {
    const cells = new Uint8Array(cols);
    let c = 0;
    row.split(".").forEach((run, i) => {
      const n = parseInt(run, 36);
      if (i % 2 === 1) cells.fill(1, c, c + n);
      c += n;
    });
    let rowSum = 0;
    for (let x = 0; x < cols; x++) {
      rowSum += cells[x];
      sat[(r + 1) * stride + x + 1] = sat[r * stride + x + 1] + rowSum;
    }
  });
  maskSat = sat;
  return sat;
}

/** True only if every mask cell the stage-pixel rect touches is foliage. */
function rectOnFoliage(x: number, y: number, w: number, h: number, t: ArtTransform): boolean {
  const sat = foliageSat();
  const stride = FOLIAGE_MASK_COLS + 1;
  const c0 = Math.floor((x - t.offsetX) / t.scaleX / MASK_CELL_W);
  const c1 = Math.ceil((x + w - t.offsetX) / t.scaleX / MASK_CELL_W);
  const r0 = Math.floor((y - t.offsetY) / t.scaleY / MASK_CELL_H);
  const r1 = Math.ceil((y + h - t.offsetY) / t.scaleY / MASK_CELL_H);
  if (c0 < 0 || r0 < 0 || c1 > FOLIAGE_MASK_COLS || r1 > FOLIAGE_MASK_ROWS) return false;
  const sum = sat[r1 * stride + c1] - sat[r0 * stride + c1] - sat[r1 * stride + c0] + sat[r0 * stride + c0];
  return sum === (c1 - c0) * (r1 - r0);
}

// ---------------------------------------------------------------------------
// Occupancy grid over the stage. A cell is "blocked" if it isn't fully on
// foliage, is within BLOCK_GAP_PX of an obstacle, or is within BLOCK_GAP_PX of
// an already placed block. A block may only go where every cell is free.
// ---------------------------------------------------------------------------

class Grid {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;
  private sat: Int32Array;

  constructor(stage: Size, art: ArtTransform, obstacles: Rect[]) {
    this.cols = Math.floor(stage.w / GRID_PX);
    this.rows = Math.floor(stage.h / GRID_PX);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!rectOnFoliage(c * GRID_PX, r * GRID_PX, GRID_PX, GRID_PX, art)) this.blocked[r * this.cols + c] = 1;
      }
    }
    for (const o of obstacles) {
      this.fill(
        Math.floor((o.x - BLOCK_GAP_PX) / GRID_PX),
        Math.floor((o.y - BLOCK_GAP_PX) / GRID_PX),
        Math.ceil((o.x + o.w + BLOCK_GAP_PX) / GRID_PX),
        Math.ceil((o.y + o.h + BLOCK_GAP_PX) / GRID_PX)
      );
    }
    this.sat = new Int32Array((this.cols + 1) * (this.rows + 1));
    this.rebuild();
  }

  clone(): Grid {
    const g = Object.create(Grid.prototype) as Grid;
    Object.assign(g, { cols: this.cols, rows: this.rows, blocked: this.blocked.slice(), sat: this.sat.slice() });
    return g;
  }

  private fill(c0: number, r0: number, c1: number, r1: number) {
    for (let r = Math.max(0, r0); r < Math.min(this.rows, r1); r++) {
      this.blocked.fill(1, r * this.cols + Math.max(0, c0), r * this.cols + Math.min(this.cols, c1));
    }
  }

  /** Summed-area rows only depend on rows above, so rebuild from `fromRow` down. */
  private rebuild(fromRow = 0) {
    const stride = this.cols + 1;
    for (let r = Math.max(0, fromRow); r < this.rows; r++) {
      let rowSum = 0;
      for (let c = 0; c < this.cols; c++) {
        rowSum += this.blocked[r * this.cols + c];
        this.sat[(r + 1) * stride + c + 1] = this.sat[r * stride + c + 1] + rowSum;
      }
    }
  }

  /** Blocked cells in [c0,c1) x [r0,r1); anything off-grid counts as blocked. */
  count(c0: number, r0: number, c1: number, r1: number): number {
    const area = (c1 - c0) * (r1 - r0);
    const cc0 = Math.max(0, c0), rr0 = Math.max(0, r0);
    const cc1 = Math.min(this.cols, c1), rr1 = Math.min(this.rows, r1);
    if (cc1 <= cc0 || rr1 <= rr0) return area;
    const s = this.sat, st = this.cols + 1;
    const inside = s[rr1 * st + cc1] - s[rr0 * st + cc1] - s[rr1 * st + cc0] + s[rr0 * st + cc0];
    return inside + (area - (cc1 - cc0) * (rr1 - rr0));
  }

  occupy(c: number, r: number, cw: number, ch: number) {
    this.fill(c - GAP_CELLS, r - GAP_CELLS, c + cw + GAP_CELLS, r + ch + GAP_CELLS);
    this.rebuild(r - GAP_CELLS);
  }
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/** FNV-1a -> [0, 1). Deterministic per id so each person keeps their spot. */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export type LayoutInput = {
  ids: string[];
  sizes: Map<string, Size>;
  stage: Size;
  art: ArtTransform;
  obstacles: Rect[];
};

type Attempt = { placed: Map<string, Rect>; unplaced: string[] };

type Strategy =
  // Everyone heads for their own hashed point on the crown: an even, organic
  // spread over the whole canopy while there's room to spare.
  | { kind: "spread"; seed: number }
  // Tight packing for a crowded tree: each block hugs whatever is already
  // blocked (canopy edge, branches, other blocks) so no space is wasted.
  | { kind: "pack"; ring: number; fine?: boolean };

function attempt(order: string[], input: LayoutInput, base: Grid, strategy: Strategy): Attempt {
  const grid = base.clone();
  const placed = new Map<string, Rect>();
  const unplaced: string[] = [];
  // Only the part of the grid that actually has foliage is worth scanning.
  const bounds = canopyCellBounds(base);

  for (const id of order) {
    const size = input.sizes.get(id)!;
    const cw = Math.ceil(size.w / GRID_PX);
    const ch = Math.ceil(size.h / GRID_PX);
    const tx = strategy.kind === "spread" ? bounds.c0 + hash01(`${id}:x:${strategy.seed}`) * (bounds.c1 - bounds.c0) : 0;
    const ty = strategy.kind === "spread" ? bounds.r0 + hash01(`${id}:y:${strategy.seed}`) * (bounds.r1 - bounds.r0) : 0;
    const stride = strategy.kind === "spread" ? SPREAD_STRIDE : strategy.fine ? 1 : PACK_STRIDE;

    let bestC = -1, bestR = -1, bestScore = Infinity;
    for (let r = bounds.r0; r + ch <= bounds.r1; r += stride) {
      for (let c = bounds.c0; c + cw <= bounds.c1; c += stride) {
        let score: number;
        if (strategy.kind === "spread") {
          score = (c + cw / 2 - tx) ** 2 + (r + ch / 2 - ty) ** 2;
          if (score >= bestScore) continue;
          if (grid.count(c, r, c + cw, r + ch) !== 0) continue;
        } else {
          if (grid.count(c, r, c + cw, r + ch) !== 0) continue;
          const k = strategy.ring;
          score = -grid.count(c - k, r - k, c + cw + k, r + ch + k);
          if (score >= bestScore) continue;
        }
        bestScore = score;
        bestC = c;
        bestR = r;
      }
    }
    if (bestC < 0) {
      unplaced.push(id);
      continue;
    }
    grid.occupy(bestC, bestR, cw, ch);
    placed.set(id, { x: bestC * GRID_PX, y: bestR * GRID_PX, w: size.w, h: size.h });
  }
  return { placed, unplaced };
}

function canopyCellBounds(grid: Grid) {
  let c0 = grid.cols, r0 = grid.rows, c1 = 0, r1 = 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.count(c, r, c + 1, r + 1) === 0) {
        if (c < c0) c0 = c;
        if (c + 1 > c1) c1 = c + 1;
        if (r < r0) r0 = r;
        if (r + 1 > r1) r1 = r + 1;
      }
    }
  }
  return { c0, r0, c1: Math.max(c0, c1), r1: Math.max(r0, r1) };
}

/**
 * Places as many blocks as fit, each fully on foliage, clear of obstacles, and
 * at least BLOCK_GAP_PX from every other block. Deterministic: the same ids,
 * sizes and stage always produce the same layout.
 */
export function layoutPage(input: LayoutInput): Attempt {
  const ids = input.ids.filter((id) => input.sizes.has(id));
  const base = new Grid(input.stage, input.art, input.obstacles);
  const byHash = [...ids].sort((a, b) => hash01(a) - hash01(b) || (a < b ? -1 : 1));

  let best: Attempt | null = null;
  const consider = (a: Attempt) => {
    if (!best || a.placed.size > best.placed.size) best = a;
    return a.unplaced.length === 0;
  };

  // Tight-packing orders for a crowded tree; which one wins depends on the mix
  // of block widths, biggest-first usually does.
  const w = (id: string) => input.sizes.get(id)!.w;
  const h = (id: string) => input.sizes.get(id)!.h;
  const packOrders = [
    [...byHash].sort((a, b) => w(b) * h(b) - w(a) * h(a)),
    [...byHash].sort((a, b) => w(a) * h(a) - w(b) * h(b)),
    byHash,
  ];

  // Prefer the even spread; it's what you see whenever there's room.
  if (consider(attempt(byHash, input, base, { kind: "spread", seed: 0 }))) return best!;
  // Tightest packing we know. If even that is well short, nothing else will
  // fit everyone either -- stop so the caller can paginate.
  if (consider(attempt(packOrders[0], input, base, { kind: "pack", ring: PACK_RINGS[0] }))) {
    // It fits; see if a spread layout does too before settling for packed.
    for (let seed = 1; seed < SPREAD_SEEDS; seed++) {
      const spread = attempt(byHash, input, base, { kind: "spread", seed });
      if (spread.unplaced.length === 0) return spread;
    }
    return best!;
  }
  if (ids.length - best!.placed.size > Math.max(3, Math.ceil(ids.length * 0.2))) return best!;
  for (let seed = 1; seed < SPREAD_SEEDS; seed++) {
    if (consider(attempt(byHash, input, base, { kind: "spread", seed }))) return best!;
  }
  for (const order of packOrders) {
    for (const ring of PACK_RINGS) {
      if (order === packOrders[0] && ring === PACK_RINGS[0]) continue;
      if (consider(attempt(order, input, base, { kind: "pack", ring }))) return best!;
    }
  }
  // Last resort: the same packing on every grid cell rather than every other.
  consider(attempt(packOrders[0], input, base, { kind: "pack", ring: PACK_RINGS[0], fine: true }));
  return best ?? { placed: new Map(), unplaced: ids };
}

/**
 * Splits everyone into pages so every page fits without overlaps. Pages are
 * balanced (e.g. 16 + 16 rather than 28 + 4) and filled in the caller's order.
 */
export function layoutPages(input: LayoutInput): Map<string, Rect>[] {
  const ids = input.ids.filter((id) => input.sizes.has(id));
  if (ids.length === 0) return [];
  const first = layoutPage({ ...input, ids });
  if (first.unplaced.length === 0) return [first.placed];
  const capacity = first.placed.size;
  if (capacity === 0) return []; // nothing fits at all (stage too small)

  for (let pageCount = Math.ceil(ids.length / capacity); ; pageCount++) {
    const perPage = Math.ceil(ids.length / pageCount);
    const pages: Map<string, Rect>[] = [];
    let ok = true;
    for (let i = 0; i < ids.length && ok; i += perPage) {
      const res = layoutPage({ ...input, ids: ids.slice(i, i + perPage) });
      ok = res.unplaced.length === 0;
      pages.push(res.placed);
    }
    if (ok || perPage === 1) return pages.filter((p) => p.size > 0);
  }
}
