"""Small PIL toolkit for the documentary: cached text sprites, Ken Burns backgrounds, shapes."""
import functools, math, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1920, 1080, 30

BG = (15, 14, 13)
INK = (242, 238, 232)
DARK = (30, 28, 26)
MUTED = (168, 162, 154)
RED = (214, 36, 52)
SAGE = (150, 176, 146)
GOLD = (214, 176, 98)
CREAM = (243, 237, 226)

FONT_FILES = {
    "sans": "NotoSansSC-Regular.otf",
    "sans_b": "NotoSansSC-Bold.otf",
    "sans_k": "NotoSansSC-Black.otf",
    "serif": "NotoSerifSC-Bold.otf",
    "serif_k": "NotoSerifSC-Black.otf",
    "serif_r": "NotoSerifSC-Regular.otf",
}


@functools.lru_cache(None)
def font(key, size):
    return ImageFont.truetype(os.path.join(HERE, "..", "fonts", FONT_FILES[key]), size)


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def appear(t, t0, d=0.6):
    return ease((t - t0) / d)


def lerp(a, b, e):
    return a + (b - a) * e


# ---------------------------------------------------------------- text

_NO_START = set("，。、；：？！）》」』”’,.;:?!)%")
_TOKEN = re.compile(r"[A-Za-z0-9$¥.,%+\-'’&:/]+|\s+|.", re.S)


def wrap(s, fnt, max_w):
    out = []
    for para in s.split("\n"):
        line = ""
        for tok in _TOKEN.findall(para):
            cand = line + tok
            if line and fnt.getlength(cand) > max_w and tok[0] not in _NO_START and not tok.isspace():
                out.append(line.rstrip())
                line = tok.lstrip()
            else:
                line = cand
        out.append(line.rstrip())
    return out


@functools.lru_cache(maxsize=6000)
def sprite(s, fk, size, color, shadow=0.55, stroke=0, stroke_color=(10, 10, 10), max_w=0, lh=1.32,
           align="left", spacing=0):
    fnt = font(fk, size)
    lines = wrap(s, fnt, max_w) if max_w else s.split("\n")
    asc, desc = fnt.getmetrics()
    line_h = int(size * lh)

    def lw(l):
        return fnt.getlength(l) + spacing * max(0, len(l) - 1)

    widths = [lw(l) for l in lines]
    tw = int(math.ceil(max(widths) if widths else 1)) + stroke * 2
    th = line_h * (len(lines) - 1) + asc + desc + stroke * 2
    pad = int(size * 0.6) if shadow else stroke + 4
    size_px = (tw + 2 * pad, th + 2 * pad)

    def draw(d, fill, dx=0, dy=0):
        sf = tuple(stroke_color) + (fill[3],)
        for i, l in enumerate(lines):
            x = pad + dx + stroke
            if align == "center":
                x += (tw - 2 * stroke - widths[i]) / 2
            elif align == "right":
                x += tw - 2 * stroke - widths[i]
            y = pad + dy + stroke + i * line_h
            if spacing:
                for ch in l:
                    d.text((x, y), ch, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=sf)
                    x += fnt.getlength(ch) + spacing
            else:
                d.text((x, y), l, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=sf)

    img = Image.new("RGBA", size_px, (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", size_px, (0, 0, 0, 0))
        draw(ImageDraw.Draw(sh), (0, 0, 0, int(255 * shadow)), 0, max(2, size // 16))
        img = sh.filter(ImageFilter.GaussianBlur(max(2, size / 9)))
    fg = Image.new("RGBA", size_px, (0, 0, 0, 0))
    draw(ImageDraw.Draw(fg), tuple(color) + (255,))
    img = Image.alpha_composite(img, fg)
    return img, pad, tw, th


_LUTS = [[(v * a) // 64 for v in range(256)] for a in range(65)]


def blit(frame, spr, x, y, alpha=1.0):
    a = int(round(clamp(alpha) * 64))
    if a <= 0:
        return
    mask = spr.getchannel("A")
    if a < 64:
        mask = mask.point(_LUTS[a])
    frame.paste(spr, (int(round(x)), int(round(y))), mask)


def put(frame, s, x, y, fk="sans", size=40, color=INK, alpha=1.0, anchor="lt", shadow=0.55, stroke=0,
        max_w=0, align="left", dx=0, dy=0, lh=1.32, spacing=0):
    """Draw text; anchor = horizontal (l/c/r) + vertical (t/m/b). Returns (w, h)."""
    spr, pad, tw, th = sprite(s, fk, size, tuple(color), shadow, stroke, (10, 10, 10), max_w, lh, align, spacing)
    ax = {"l": 0, "c": tw / 2, "r": tw}[anchor[0]]
    ay = {"t": 0, "m": th / 2, "b": th}[anchor[1]]
    if alpha > 0:
        blit(frame, spr, x - ax - pad + dx, y - ay - pad + dy, alpha)
    return tw, th


def measure(s, fk, size, max_w=0, lh=1.32):
    _, _, tw, th = sprite(s, fk, size, INK, 0, 0, (10, 10, 10), max_w, lh, "left", 0)
    return tw, th


# ---------------------------------------------------------------- shapes

@functools.lru_cache(maxsize=4000)
def _rmask(w, h, r, a, outline):
    m = Image.new("L", (max(1, w), max(1, h)), 0)
    d = ImageDraw.Draw(m)
    if outline:
        d.rounded_rectangle((0, 0, w - 1, h - 1), r, outline=a, width=outline)
    else:
        d.rounded_rectangle((0, 0, w - 1, h - 1), r, fill=a)
    return m


def box(frame, x, y, w, h, color, alpha=1.0, r=0, outline=0):
    a = int(255 * clamp(alpha)) // 4 * 4
    w, h = int(round(w)), int(round(h))
    if a <= 0 or w <= 0 or h <= 0:
        return
    r = min(r, w // 2, h // 2)
    x, y = int(round(x)), int(round(y))
    frame.paste(tuple(color), (x, y, x + w, y + h), _rmask(w, h, r, a, outline))


@functools.lru_cache(maxsize=256)
def _circle(d, a, outline):
    m = Image.new("L", (d * 4, d * 4), 0)
    dr = ImageDraw.Draw(m)
    if outline:
        dr.ellipse((0, 0, d * 4 - 1, d * 4 - 1), outline=a, width=outline * 4)
    else:
        dr.ellipse((0, 0, d * 4 - 1, d * 4 - 1), fill=a)
    return m.resize((d, d), Image.LANCZOS)


def dot(frame, cx, cy, d, color, alpha=1.0, outline=0):
    a = int(255 * clamp(alpha)) // 8 * 8
    if a <= 0:
        return
    d = int(d)
    frame.paste(tuple(color), (int(cx - d / 2), int(cy - d / 2), int(cx - d / 2) + d, int(cy - d / 2) + d),
                _circle(d, a, outline))


def line(frame, x0, y0, x1, y1, color, width=3, alpha=1.0, prog=1.0):
    prog = clamp(prog)
    if prog <= 0 or alpha <= 0:
        return
    x1, y1 = lerp(x0, x1, prog), lerp(y0, y1, prog)
    if alpha >= 0.99:
        ImageDraw.Draw(frame).line((x0, y0, x1, y1), fill=tuple(color), width=width)
        return
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).line((x0, y0, x1, y1), fill=int(255 * alpha), width=width)
    frame.paste(tuple(color), (0, 0), m)


# ---------------------------------------------------------------- images

ASSET_ALIASES = {
    "u1": "assets/1.webp", "u2": "assets/2.jpg", "u3": "assets/3.png", "u4": "assets/4.webp", "u5": "assets/5.webp",
}
FALLBACK = {"nasdaq": "u4", "port": "store_nyc", "parcel": "alo_store", "runners": "squat_front",
            "yogahands": "warrior"}


def asset_path(name):
    if name in ASSET_ALIASES:
        return os.path.join(HERE, ASSET_ALIASES[name])
    p = os.path.join(HERE, "..", "web", name + ".jpg")
    if os.path.exists(p) and os.path.getsize(p) > 1000:
        return p
    return asset_path(FALLBACK[name])


@functools.lru_cache(None)
def load(name, mode="RGB"):
    im = Image.open(asset_path(name))
    if mode == "RGBA":
        return im.convert("RGBA")
    if im.mode in ("RGBA", "P", "LA"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    return im.convert("RGB")


HEADROOM = 1.3


@functools.lru_cache(maxsize=24)
def cover_src(name, ow, oh, blur):
    im = load(name)
    iw, ih = im.size
    s = max(ow / iw, oh / ih) * HEADROOM
    im = im.resize((max(1, round(iw * s)), max(1, round(ih * s))), Image.LANCZOS)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur * HEADROOM))
    return im


def kb(name, u, z0=1.0, z1=1.1, p0=(0.5, 0.5), p1=(0.5, 0.5), blur=0, size=(W, H)):
    """Ken Burns: zoom from z0 to z1 while the focus point pans from p0 to p1 (0..1 of the free range)."""
    ow, oh = size
    src = cover_src(name, ow, oh, blur)
    sw, sh = src.size
    e = clamp(u, -0.2, 1.2)
    e = e * 0.85 + ease_io(e) * 0.15 if 0 <= e <= 1 else e
    z = lerp(z0, z1, e)
    ww, wh = ow * HEADROOM / z, oh * HEADROOM / z
    ww, wh = min(ww, sw), min(wh, sh)
    px, py = lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], e)
    x0 = (sw - ww) * clamp(px)
    y0 = (sh - wh) * clamp(py)
    return src.resize((ow, oh), Image.BILINEAR, box=(x0, y0, x0 + ww, y0 + wh))


_BLACK = None


@functools.lru_cache(maxsize=64)
def _shade_mask(dark, bottom, vig):
    y = np.linspace(0, 1, H)[:, None]
    yy = np.linspace(-1, 1, H)[:, None]
    x = np.linspace(-1, 1, W)[None, :]
    v = np.clip((np.sqrt(x ** 2 * 0.55 + yy ** 2 * 0.95) - 0.5) / 0.85, 0, 1) ** 1.6 * vig
    b = np.clip((y - 0.64) / 0.36, 0, 1) ** 1.5 * 0.7 * bottom
    m = 1 - (1 - dark) * (1 - v) * (1 - b)
    return Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8), "L")


def shade(frame, dark=0.4, bottom=1.0, vig=0.6):
    global _BLACK
    if _BLACK is None:
        _BLACK = Image.new("RGB", (W, H), (6, 6, 6))
    m = _shade_mask(round(dark * 40) / 40, round(bottom * 10) / 10, round(vig * 10) / 10)
    return Image.composite(_BLACK, frame, m)


@functools.lru_cache(maxsize=16)
def gradient(c0, c1, radial=True):
    if radial:
        yy = np.linspace(-1, 1, H)[:, None]
        xx = np.linspace(-1, 1, W)[None, :]
        r = np.clip(np.sqrt((xx * 0.8) ** 2 + (yy * 1.1) ** 2) / 1.3, 0, 1)
    else:
        r = np.repeat(np.linspace(0, 1, H)[:, None], W, 1)
    arr = np.array(c0)[None, None, :] * (1 - r[..., None]) + np.array(c1)[None, None, :] * r[..., None]
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def solid_bg(c0=(34, 32, 30), c1=(10, 10, 9)):
    return gradient(tuple(c0), tuple(c1)).copy()


@functools.lru_cache(maxsize=8)
def _grain(k):
    rng = np.random.default_rng(k)
    n = rng.normal(8, 3.2, (H, W)).clip(0, 16).astype(np.uint8)
    return Image.fromarray(np.repeat(n[..., None], 3, 2), "RGB")


def grain(frame, idx):
    return ImageChops.add(frame, _grain(idx % 6), 1.0, -8)


@functools.lru_cache(maxsize=32)
def rounded_image(name, w, h, r, mode="cover"):
    im = load(name)
    iw, ih = im.size
    s = max(w / iw, h / ih)
    im = im.resize((round(iw * s), round(ih * s)), Image.LANCZOS)
    x0, y0 = (im.width - w) // 2, (im.height - h) // 2
    im = im.crop((x0, y0, x0 + w, y0 + h))
    return im, _rmask(w, h, r, 255, 0)


def paste_img(frame, im, x, y, mask=None, alpha=1.0):
    a = int(round(clamp(alpha) * 64))
    if a <= 0:
        return
    if mask is None:
        mask = Image.new("L", im.size, 255) if im.mode != "RGBA" else im.getchannel("A")
    if a < 64:
        mask = mask.point(_LUTS[a])
    frame.paste(im, (int(round(x)), int(round(y))), mask)
