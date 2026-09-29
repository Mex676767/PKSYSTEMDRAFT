"""Scene painters. Each takes (t, c) where t is local time and c has .T (duration), .ls/.le (line start/end)."""
import glob, json, os
from PIL import Image
from gfx import *

REF_FRAMES = sorted(glob.glob(os.path.join(HERE, "assets", "ref", "*.jpg")))


def L(c, i):
    return c.ls[i] if i < len(c.ls) else c.T


def Ld(c, i):
    return c.le[i] - c.ls[i]


def tag(f, s, x, y, color=RED, alpha=1.0, size=30, fg=INK, anchor="l"):
    tw, th = measure(s, "sans_b", size)
    padx, pady = int(size * 0.55), int(size * 0.28)
    bw, bh = tw + padx * 2, th + pady * 2
    if anchor == "c":
        x -= bw / 2
    elif anchor == "r":
        x -= bw
    box(f, x, y, bw, bh, color, alpha, r=6)
    put(f, s, x + padx, y + pady, "sans_b", size, fg, alpha, "lt", shadow=0)
    return bw, bh


def kicker(f, s, t, t0=0.25, x=120, y=110, size=58):
    a = appear(t, t0, 0.8)
    box(f, x, y + 6, 8, size * 1.1, RED, a)
    put(f, s, x + 30, y, "serif_k", size, INK, a, "lt", dx=(1 - a) * -20)


def lower_third(f, t, t0, title, sub=None, x=120, y=640, size=64, color=RED):
    a = appear(t, t0, 0.7)
    tw, th = measure(title, "serif_k", size)
    box(f, x, y, 10, th + (60 if sub else 10), color, a)
    put(f, title, x + 34, y - 6, "serif_k", size, INK, a, dx=(1 - a) * -30)
    if sub:
        a2 = appear(t, t0 + 0.35, 0.7)
        put(f, sub, x + 36, y + th + 8, "sans", 34, MUTED, a2, dx=(1 - a2) * -30)


def note(f, s, alpha=1.0):
    put(f, s, W - 60, 118, "sans", 22, MUTED, alpha * 0.9, "rt", shadow=0.6)


def arrow(f, x0, y, x1, color=MUTED, a=1.0):
    line(f, x0, y, x1 - 10, y, color, 4, a)
    box(f, x1 - 18, y - 9, 4, 18, color, a)
    dot(f, x1 - 8, y, 16, color, a)


def cutout(f, name, x, y, h, alpha=1.0):
    im = _cut(name, h)
    paste_img(f, im, x, y, im.getchannel("A"), alpha)


import functools


@functools.lru_cache(8)
def _cut(name, h):
    im = load(name, "RGBA")
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def stat_card(f, x, y, w, h, a, big, label, sub=None, big_color=INK, big_size=76):
    box(f, x, y, w, h, (28, 27, 25), a * 0.92, r=14)
    box(f, x, y, w, 6, big_color if big_color != INK else RED, a, r=3)
    put(f, label, x + 36, y + 40, "sans_b", 32, MUTED, a)
    put(f, big, x + 34, y + 96, "serif_k", big_size, big_color, a, dy=(1 - a) * 16)
    if sub:
        put(f, sub, x + 36, y + h - 44, "sans", 28, MUTED, a, "lb", max_w=w - 70)


# ============================================================== opening

def s_title_open(t, c):
    f = shade(kb("u4", t / c.T, 1.14, 1.03, (0.5, 0.42), (0.5, 0.5)), 0.6)
    a = appear(t, 0.3, 1.3)
    put(f, "最优解笔记", W / 2, H / 2 - 30, "serif_k", 132, INK, a, "cb", dy=(1 - a) * 24, spacing=6)
    w = 380 * ease_io((t - 0.9) / 1.0)
    box(f, W / 2 - w / 2, H / 2 - 4, w, 5, RED, 1 if w > 0 else 0)
    a2 = appear(t, 1.4, 1.0)
    put(f, "一条裤子  ·  一张财报  ·  一个品牌的溢价", W / 2, H / 2 + 34, "sans", 36, MUTED, a2, "ct", spacing=2)
    return f


def s_phone_scroll(t, c):
    f = shade(kb("store_nyc", t / c.T, 1.05, 1.14, blur=16), 0.62)
    pw, ph = 460, 846
    px, py = 1180, (H - ph) // 2 - 10
    a = appear(t, 0.1, 0.8)
    oy = (1 - a) * 60
    box(f, px - 16, py - 16 + oy, pw + 32, ph + 32, (22, 22, 24), a, r=58)
    box(f, px - 16, py - 16 + oy, pw + 32, ph + 32, (70, 70, 74), a, r=58, outline=2)
    idx = min(len(REF_FRAMES) - 1, int(max(0.0, t - 0.4) * 1.5 * FPS)) if REF_FRAMES else 0
    if REF_FRAMES:
        fr = Image.open(REF_FRAMES[idx]).convert("RGB").resize((pw, ph))
        paste_img(f, fr, px, py + oy, _screen_mask(pw, ph), a)
    a1 = appear(t, 0.4, 0.8)
    put(f, "一条瑜伽裤", 180, 300, "sans_b", 44, MUTED, a1)
    put(f, "$100+", 172, 360, "serif_k", 190, GOLD, a1, dy=(1 - a1) * 20)
    a2 = appear(t, L(c, 1), 0.8)
    put(f, "你对它最基本的要求\n是什么？", 180, 640, "serif", 62, INK, a2, dy=(1 - a2) * 20)
    return f


@functools.lru_cache(2)
def _screen_mask(w, h):
    from gfx import _rmask
    return _rmask(w, h, 44, 255, 0)


def sage_bg():
    return solid_bg((74, 86, 72), (20, 24, 20))


def s_wishlist(t, c):
    f = sage_bg()
    cutout(f, "u1", 1060, 70 - 14 * clamp(t / c.T), 1060, appear(t, 0, 0.8))
    f = shade(f, 0.0, 0.8, 0.5)
    put(f, "一百多美元，至少要做到", 150, 250, "sans_b", 40, (205, 214, 200), appear(t, 0.1, 0.7))
    d = Ld(c, 0)
    for k, s in enumerate(["好看", "舒服", "不易走样"]):
        a = appear(t, L(c, 0) + k * d / 3.2, 0.6)
        put(f, s, 150, 330 + k * 150, "serif_k", 110, INK, a, dx=(1 - a) * -30)
        box(f, 130, 360 + k * 150, 6, 90, RED, a)
    return f


def s_squat_back(t, c):
    f = shade(kb("squat_back", t / c.T, 1.02, 1.12, (0.5, 0.35), (0.5, 0.45)), 0.3)
    a = appear(t, L(c, 0) + 0.9, 0.8)
    tag(f, "最基本的一条", 130, 560, RED, a)
    put(f, "深蹲时，不会透。", 126, 630, "serif_k", 96, INK, a, dy=(1 - a) * 20)
    note(f, "示意画面", 0.8)
    return f


def s_getlow_intro(t, c):
    f = shade(kb("squat_front", t / c.T, 1.04, 1.14, (0.4, 0.4), (0.55, 0.4)), 0.35)
    lower_third(f, t, L(c, 0) + 0.4, "Get Low 训练裤", "Lululemon · 2026", y=560)
    a = appear(t, L(c, 1) + 0.4, 0.7)
    tag(f, "消费者反映：弯腰、深蹲时会透", 154, 760, (40, 38, 36), a, 32)
    note(f, "示意画面", 0.8)
    return f


def s_why_company(t, c):
    f = shade(kb("store_nyc", t / c.T, 1.0, 1.1, (0.3, 0.5), (0.6, 0.45)), 0.5)
    a = appear(t, 0.2, 0.8)
    put(f, "“不就是一条裤子\n出了问题吗？”", 150, 300, "serif_k", 84, INK, a, dy=(1 - a) * 20)
    a2 = appear(t, L(c, 1), 0.7)
    tag(f, "上市公司", 154, 600, RED, a2, 34)
    put(f, "NASDAQ: LULU", 330, 604, "sans_b", 40, INK, a2)
    return f


def s_two_questions(t, c):
    f = Image.new("RGB", (W, H), BG)
    left = kb("u2", t / c.T, 1.02, 1.1, (0.62, 0.3), (0.6, 0.32), size=(W // 2, H))
    right = kb("nasdaq", t / c.T, 1.05, 1.15, (0.5, 0.5), (0.45, 0.4), size=(W // 2, H))
    f.paste(left, (0, 0))
    f.paste(right, (W // 2, 0))
    rd = 0.8 - 0.35 * appear(t, L(c, 1) - 0.2, 0.8)
    ld = 0.3 + 0.3 * appear(t, L(c, 1) - 0.2, 0.8)
    lm = Image.new("L", (W, H), 0)
    lm.paste(int(ld * 255), (0, 0, W // 2, H))
    lm.paste(int(rd * 255), (W // 2, 0, W, H))
    f = Image.composite(Image.new("RGB", (W, H), (8, 8, 8)), f, lm)
    f = shade(f, 0.0, 1.0, 0.3)
    box(f, W // 2 - 1, 0, 2, H, INK, 0.5)
    a = appear(t, 0.2, 0.7)
    tag(f, "消费者", 110, 150, SAGE, a, 32, fg=DARK)
    put(f, "这个价格\n还值不值？", 110, 560, "serif_k", 80, INK, a, dy=(1 - a) * 20)
    a2 = appear(t, L(c, 1), 0.7)
    tag(f, "投资者", W // 2 + 110, 150, GOLD, a2, 32, fg=DARK)
    put(f, "大家以后还愿不愿意\n一直付这个价格？", W // 2 + 110, 560, "serif_k", 72, INK, a2, dy=(1 - a2) * 20)
    a3 = appear(t, L(c, 1) + 0.8, 0.8)
    if a3 > 0:
        logo, m = rounded_image("u3", 220, 150, 14)
        paste_img(f, logo, W - 330, 120, m, a3 * 0.95)
    return f


def s_same_report(t, c):
    f = solid_bg()
    a = appear(t, 0.1, 0.8)
    cx, cy, pw, ph = W // 2, 470, 560, 660
    x0, y0 = cx - pw // 2, cy - ph // 2 + (1 - a) * 40
    box(f, x0 + 14, y0 + 18, pw, ph, (0, 0, 0), a * 0.5, r=10)
    box(f, x0, y0, pw, ph, CREAM, a, r=10)
    put(f, "季度财报", x0 + 50, y0 + 50, "serif_k", 54, DARK, a, shadow=0)
    box(f, x0 + 50, y0 + 130, 120, 5, RED, a)
    for k in range(7):
        box(f, x0 + 50, y0 + 175 + k * 40, [440, 400, 460, 380, 420, 300, 440][k], 12, (205, 198, 186), a, r=6)
    for k, (s, col, fromx) in enumerate([("这个价格还值不值？", SAGE, -500), ("还愿不愿意一直付这个价格？", GOLD, W + 200)]):
        e = ease_io((t - 0.6 - k * 0.5) / 1.4)
        tw, _ = measure(s, "sans_b", 34)
        tx = lerp(fromx, cx - (tw + 38) / 2, e)
        ty = lerp(260 + k * 520, y0 + 470 + k * 78, e)
        tag(f, s, tx, ty, col, appear(t, 0.6 + k * 0.5, 0.4), 34, fg=DARK)
    return f


def s_main_title(t, c):
    f = shade(kb("u4", t / c.T, 1.04, 1.16, (0.5, 0.5), (0.52, 0.42)), 0.58)
    a = appear(t, 0.2, 1.0)
    put(f, "品牌溢价，还剩多少？", W / 2, 330, "serif_k", 118, INK, a, "cb", dy=(1 - a) * 24)
    w = 300 * ease_io((t - 0.8) / 0.9)
    box(f, W / 2 - w / 2, 362, w, 5, RED, 1 if w > 0 else 0)
    a1 = appear(t, L(c, 1) + 0.3, 0.7)
    tag(f, "A", 520, 460, SAGE, a1, 34, fg=DARK)
    put(f, "一次可以修复的低谷", 600, 458, "serif", 54, INK, a1, dx=(1 - a1) * 20)
    a2 = appear(t, L(c, 2) + 0.2, 0.7)
    tag(f, "B", 520, 570, RED, a2, 34)
    put(f, "让人心甘情愿付高价的理由，正在变弱", 600, 568, "serif", 54, INK, a2, dx=(1 - a2) * 20)
    return f


# ============================================================== chapter cards

def chapter(t, c, bg, num, title, sub):
    f = shade(kb(bg, t / c.T, 1.08, 1.16, blur=6), 0.72, 0.6)
    a = appear(t, 0.15, 0.8)
    put(f, num, W / 2, 380, "sans_b", 36, RED, a, "cb", spacing=10)
    a2 = appear(t, 0.35, 0.9)
    put(f, title, W / 2, 400, "serif_k", 150, INK, a2, "ct", dy=(1 - a2) * 30, spacing=12)
    w = 220 * ease_io((t - 0.7) / 0.8)
    box(f, W / 2 - w / 2, 610, w, 4, RED, 1 if w > 0 else 0)
    put(f, sub, W / 2, 640, "sans", 38, MUTED, appear(t, 0.9, 0.8), "ct", spacing=3)
    return f


def s_ch1(t, c):
    return chapter(t, c, "yogahands", "第 一 章", "一条裤子", "高价，买到的是什么")


def s_ch2(t, c):
    f = chapter(t, c, "nasdaq", "第 二 章", "一张财报", "2026 财年第二季度")
    a = appear(t, L(c, 1) + 0.2, 0.7)
    tag(f, "压力确实存在", W / 2, 740, RED, a, 36, anchor="c")
    return f


def s_ch3(t, c):
    return chapter(t, c, "alo_store", "第 三 章", "一个对手", "Alo 来了")


def s_ch4(t, c):
    f = chapter(t, c, "store_asia", "第 四 章", "一次调整", "现在下结论，还太早")
    return f


def s_ch5(t, c):
    return chapter(t, c, "u4", "尾 声", "值不值", "回到开头的问题")


# ============================================================== chapter 1

def s_why_expensive(t, c):
    f = shade(kb("warrior", t / c.T, 1.02, 1.12, (0.5, 0.5), (0.4, 0.45)), 0.4)
    kicker(f, "为什么能卖得贵？", t)
    a = appear(t, L(c, 1) + 0.3, 0.7)
    put(f, "布料 + 缝纫 = 裤子", 150, 660, "serif", 58, INK, a)
    put(f, "这样的选择，市场上多得很", 150, 750, "sans", 38, MUTED, appear(t, L(c, 1) + 1.2, 0.7))
    return f


def s_premium_parts(t, c):
    f = Image.new("RGB", (W, H), CREAM)
    s = 1 + 0.04 * clamp(t / c.T)
    im = _scale_img(round(900 * s))
    paste_img(f, im, 70 - (im.width - 900) / 2, 100 - (im.height - 900) / 2, None, appear(t, 0, 0.6))
    f = shade(f, 0.0, 0.35, 0.25)
    a = appear(t, 0.2, 0.7)
    put(f, "多花的钱，换来了什么？", 1030, 170, "serif_k", 60, DARK, a, shadow=0)
    box(f, 1032, 262, 90 * a, 5, RED, a)
    d1 = Ld(c, 1)
    times = [L(c, 1) + 0.2, L(c, 1) + d1 * 0.33, L(c, 1) + d1 * 0.58, L(c, 2)]
    for k, s_ in enumerate(["舒服的面料", "合适的剪裁", "运动时的表现", "一个我喜欢的品牌"]):
        ak = appear(t, times[k], 0.6)
        put(f, f"0{k + 1}", 1032, 330 + k * 125, "serif_k", 44, RED, ak, shadow=0)
        put(f, s_, 1120, 322 + k * 125, "sans_b", 54, DARK, ak, shadow=0, dx=(1 - ak) * 24)
    return f


@functools.lru_cache(64)
def _scale_img(sz):
    return load("u5").resize((sz, sz), Image.BILINEAR)


def s_good_business(t, c):
    f = shade(kb("store_asia", t / c.T, 1.03, 1.13, (0.4, 0.5), (0.6, 0.5)), 0.55)
    kicker(f, "这样的生意，有个好处", t)
    d = Ld(c, 1)
    steps = [("体验持续满意", L(c, 1) + 0.2), ("下次第一个想到你", L(c, 1) + d * 0.5), ("不用靠降价说服", L(c, 2) + 0.2)]
    x = 140
    for k, (s_, t0) in enumerate(steps):
        a = appear(t, t0, 0.6)
        tw, th = measure(s_, "sans_b", 42)
        box(f, x, 520, tw + 70, 100, (24, 23, 22), a * 0.9, r=12)
        box(f, x, 520, tw + 70, 100, SAGE if k < 2 else GOLD, a, r=12, outline=2)
        put(f, s_, x + 35, 544, "sans_b", 42, INK, a, shadow=0)
        x += tw + 70
        if k < 2:
            arrow(f, x + 16, 570, x + 84, MUTED, appear(t, steps[k + 1][1] - 0.2, 0.4))
            x += 100
    return f


def s_high_expect(t, c):
    f = solid_bg((40, 30, 30), (10, 9, 9))
    a = appear(t, 0.05, 0.6)
    put(f, "高价", 560, H / 2 - 60, "serif_k", 190, INK, a, "cm", dy=(1 - a) * 20)
    a2 = appear(t, 0.45, 0.6)
    put(f, "＝", 860, H / 2 - 60, "serif_k", 140, MUTED, a2, "cm")
    a3 = appear(t, 0.85, 0.6)
    put(f, "高期待", 1260, H / 2 - 60, "serif_k", 190, RED, a3, "cm", dy=(1 - a3) * 20)
    return f


def s_timeline(t, c):
    f = solid_bg((30, 29, 27), (10, 10, 9))
    kicker(f, "Get Low：一次下架与重新上线", t, 0.1, size=52)
    x = 150
    nodes = [("定位", "面向训练场景的裤子", L(c, 0) + 0.3),
             ("消费者反映透光", "暂时从官网撤下这个系列", L(c, 1) + 0.3),
             ("重新上线", "页面增加穿着建议", L(c, 2) + 0.2)]
    for k, (h_, s_, t0) in enumerate(nodes):
        a = appear(t, t0, 0.6)
        y = 300 + k * 200
        if k:
            line(f, x + 12, y - 170, x + 12, y - 10, (90, 86, 80), 3, 1, appear(t, t0 - 0.3, 0.5))
        dot(f, x + 12, y + 22, 28, RED if k == 1 else INK, a)
        put(f, h_, x + 60, y - 4, "serif_k", 50, INK, a, dx=(1 - a) * 20)
        put(f, s_, x + 62, y + 68, "sans", 36, MUTED, a, dx=(1 - a) * 20)
    # illustrative product page
    a = appear(t, L(c, 2), 0.8)
    cx, cy, cw, ch = 1100, 170, 660, 740
    oy = (1 - a) * 30
    box(f, cx, cy + oy, cw, ch, (248, 246, 242), a, r=16)
    ph_im, m = rounded_image("squat_front", cw - 60, 330, 10)
    paste_img(f, ph_im, cx + 30, cy + 30 + oy, m, a)
    put(f, "Get Low 训练裤", cx + 34, cy + 385 + oy, "sans_k", 44, DARK, a, shadow=0)
    box(f, cx + 34, cy + 455 + oy, 220, 14, (215, 210, 202), a, r=7)
    a2 = appear(t, L(c, 3), 0.6)
    box(f, cx + 30, cy + 500 + oy, cw - 60, 170, (252, 236, 236), a2, r=10)
    box(f, cx + 30, cy + 500 + oy, 8, 170, RED, a2)
    put(f, "穿着建议", cx + 60, cy + 518 + oy, "sans_b", 32, RED, a2, shadow=0)
    put(f, "· 选大一码", cx + 60, cy + 568 + oy, "sans_b", 34, DARK, a2, shadow=0)
    put(f, "· 搭配肤色无痕内裤", cx + 60, cy + 615 + oy, "sans_b", 34, DARK, a2, shadow=0)
    put(f, "示意图，非官网截图", cx + cw - 30, cy + ch - 22 + oy, "sans", 22, (140, 134, 126), a, "rb", shadow=0)
    return f


def s_two_views(t, c):
    f = shade(kb("squat_back", t / c.T, 1.08, 1.14, blur=22), 0.72)
    box(f, W // 2 - 1, 180, 2, 640, INK, 0.35)
    a = appear(t, 0.2, 0.7)
    tag(f, "品牌视角", 160, 220, SAGE, a, 32, fg=DARK)
    put(f, "帮助顾客\n找到合适的穿法", 160, 320, "serif_k", 72, INK, a, dy=(1 - a) * 20)
    a2 = appear(t, L(c, 1), 0.7)
    tag(f, "顾客视角", W // 2 + 120, 220, RED, a2, 32)
    a3 = appear(t, L(c, 2) + 0.2, 0.7)
    put(f, "训练之前，\n为什么还得先研究\n怎么搭内裤？", W // 2 + 120, 320, "serif_k", 72, INK, a3, dy=(1 - a3) * 20)
    return f


def s_caveat(t, c):
    f = shade(kb("store_asia", t / c.T, 1.1, 1.16, blur=14), 0.76)
    a = appear(t, 0.1, 0.6)
    tag(f, "注意", W / 2, 250, GOLD, a, 34, fg=DARK, anchor="c")
    put(f, "并不是所有裤子都会透", W / 2, 360, "serif_k", 84, INK, a, "ct", dy=(1 - a) * 20)
    a2 = appear(t, L(c, 1) + 0.2, 0.7)
    put(f, "一款产品收到投诉", W / 2 - 60, 560, "sans_b", 46, MUTED, a2, "rt")
    put(f, "≠", W / 2, 548, "sans_b", 60, GOLD, a2, "ct")
    put(f, "整个品牌质量下降", W / 2 + 60, 560, "sans_b", 46, MUTED, a2, "lt")
    return f


def s_scale(t, c):
    f = kb("u5", t / c.T, 1.0, 1.1, (0.5, 0.55), (0.5, 0.45))
    f = shade(f, 0.05, 0.4, 0.3)
    a = appear(t, L(c, 1) + 0.5, 0.7)
    tag(f, "不只是一次公关麻烦", W / 2, 60, DARK, a, 32, anchor="c")
    a2 = appear(t, L(c, 2) + 0.2, 0.8)
    box(f, W / 2 - 560, 760, 1120, 110, CREAM, a2 * 0.92, r=14)
    put(f, "“品牌溢价”到底买到了什么？", W / 2, 815, "serif_k", 62, DARK, a2, "cm", shadow=0)
    return f


def s_bridge(t, c):
    f = shade(kb("store_hk", t / c.T, 1.02, 1.1, (0.5, 0.35), (0.5, 0.5)), 0.55)
    a = appear(t, L(c, 1) + 0.5, 0.8)
    put(f, "这种犹豫，\n出现在销售数字里了吗？", W / 2, H / 2 - 40, "serif_k", 86, INK, a, "cm", align="center",
        dy=(1 - a) * 20)
    return f


# ============================================================== chapter 2

def grid_bg():
    f = solid_bg((30, 30, 32), (9, 9, 10))
    for y in range(120, H, 90):
        box(f, 0, y, W, 1, (255, 255, 255), 0.04)
    return f


def s_q2_bars(t, c):
    f = grid_bg()
    kicker(f, "2026 财年第二季度 · 同比变化", t, 0.1, size=52)
    note(f, "来源：Lululemon 2026 财年第二季度财报", appear(t, 0.5, 0.8))
    base = 330
    box(f, 300, base, 1320, 3, INK, appear(t, 0.2, 0.6))
    items = [("全球营收", 4, (160, 70, 70)), ("全球同店销售", 9, (190, 50, 56)), ("美洲同店销售", 12, RED)]
    for k, (lab, v, col) in enumerate(items):
        cx = 560 + k * 400
        t0 = L(c, k) + 0.3
        a = appear(t, t0, 0.5)
        g = ease_io((t - t0) / 1.0)
        put(f, lab, cx, base - 24, "sans_b", 38, INK, a, "cb")
        h = 36 * v * g
        box(f, cx - 110, base + 3, 220, h, col, a)
        if a > 0:
            put(f, f"−{v * g:.0f}%" if g < 1 else f"−{v}%", cx, base + 16 + h, "serif_k", 76, col if k else (210, 110, 110), a, "ct")
    return f


def store_icon(f, x, y, col, a, w=70):
    box(f, x, y + 18, w, 50, col, a, r=4)
    box(f, x - 6, y, w + 12, 22, col, a, r=4)
    box(f, x + w / 2 - 10, y + 40, 20, 28, (20, 20, 20), a)


def s_comp_explain(t, c):
    f = grid_bg()
    kicker(f, "什么是同店销售？", t, 0.1)
    a1 = appear(t, L(c, 1) + 0.1, 0.6)
    box(f, 140, 330, 560, 330, (30, 30, 30), a1 * 0.9, r=14)
    box(f, 140, 330, 560, 330, SAGE, a1, r=14, outline=2)
    for k in range(6):
        store_icon(f, 190 + (k % 3) * 170, 390 + (k // 3) * 110, SAGE, appear(t, L(c, 1) + 0.1 + k * 0.08, 0.4))
    put(f, "营业一段时间的门店", 420, 610, "sans_b", 34, INK, a1, "cm", shadow=0)
    d1 = Ld(c, 1)
    a2 = appear(t, L(c, 1) + d1 * 0.55, 0.6)
    put(f, "+", 760, 495, "sans_b", 80, MUTED, a2, "cm")
    box(f, 820, 330, 360, 330, (30, 30, 30), a2 * 0.9, r=14)
    box(f, 820, 330, 360, 330, SAGE, a2, r=14, outline=2)
    box(f, 915, 400, 170, 110, SAGE, a2, r=8)
    box(f, 930, 413, 140, 84, (30, 30, 30), a2, r=4)
    box(f, 885, 512, 230, 12, SAGE, a2, r=6)
    put(f, "符合口径的线上业务", 1000, 610, "sans_b", 34, INK, a2, "cm", shadow=0)
    a3 = appear(t, L(c, 2), 0.6)
    put(f, "=", 1235, 495, "sans_b", 80, MUTED, a3, "cm")
    box(f, 1290, 400, 480, 190, RED, a3, r=14)
    put(f, "同店销售", 1530, 460, "serif_k", 66, INK, a3, "cm", shadow=0)
    put(f, "原有生意有没有增长", 1530, 540, "sans", 32, INK, a3, "cm", shadow=0)
    a4 = appear(t, L(c, 2) + 1.0, 0.6)
    store_icon(f, 1400, 710, (90, 88, 84), a4)
    put(f, "新开门店：不计入", 1500, 752, "sans_b", 34, MUTED, a4, "lm")
    return f


def s_why_comp(t, c):
    f = shade(kb("store_nyc", t / c.T, 1.12, 1.2, (0.2, 0.3), (0.35, 0.35)), 0.62)
    kicker(f, "为什么投资者这么在意它？", t, 0.2, size=54)
    rows = [("继续开新店", "总销售额撑起来", SAGE, L(c, 1) + 0.2), ("原有生意", "卖得越来越吃力？", RED, L(c, 2) + 0.2)]
    for k, (a_, b_, col, t0) in enumerate(rows):
        a = appear(t, t0, 0.6)
        y = 330 + k * 130
        tag(f, a_, 150, y, col, a, 38, fg=DARK if col == SAGE else INK)
        arrow(f, 460, y + 34, 540, MUTED, a)
        put(f, b_, 570, y + 4, "sans_b", 46, INK, a, dx=(1 - a) * 20)
    a3 = appear(t, L(c, 3) + 0.2, 0.7)
    put(f, "新店开完之后，顾客还会不会持续回来？", 150, 660, "serif_k", 64, GOLD, a3, dy=(1 - a3) * 16)
    return f


def s_china_swing(t, c):
    f = shade(kb("store_hk", t / c.T, 1.1, 1.18, (0.5, 0.4), (0.5, 0.5), blur=14), 0.78)
    kicker(f, "中国大陆 · 同店销售（固定汇率）", t, 0.1, size=52)
    base = 600
    box(f, 520, base, 880, 3, INK, appear(t, 0.2, 0.5))
    for k, (lab, v, col, t0) in enumerate([("2026 Q1", 13, SAGE, L(c, 1) + 0.6), ("2026 Q2", -8, RED, L(c, 2) + 0.4)]):
        cx = 760 + k * 400
        a = appear(t, t0, 0.5)
        g = ease_io((t - t0) / 1.0)
        h = abs(v) * 20 * g
        if v > 0:
            box(f, cx - 100, base - h, 200, h, col, a)
            put(f, f"+{abs(v) * g:.0f}%", cx, base - h - 12, "serif_k", 74, col, a, "cb")
            put(f, lab, cx, base + 20, "sans_b", 34, MUTED, a, "ct")
        else:
            box(f, cx - 100, base + 3, 200, h, col, a)
            put(f, f"−{abs(v) * g:.0f}%", cx, base + h + 14, "serif_k", 74, col, a, "ct")
            put(f, lab, cx, base - 20, "sans_b", 34, MUTED, a, "cb")
    return f


def china_cards(f, t, la, ra, left_note=0, right_note=0):
    for k, (a, head, sub, val, col, nt, ntxt) in enumerate([
        (la, "中国大陆营收", "报告汇率", "+4%", SAGE, left_note, "看整个市场的营收\n受汇率和新店影响"),
        (ra, "中国大陆同店销售", "固定汇率", "−8%", RED, right_note, "看原有门店和线上的表现\n按固定汇率计算")]):
        x = 250 + k * 760
        if a <= 0:
            continue
        box(f, x, 190 + (1 - a) * 30, 660, 360, (26, 25, 24), a * 0.94, r=16)
        box(f, x, 190 + (1 - a) * 30, 660, 6, col, a, r=3)
        put(f, head, x + 44, 226 + (1 - a) * 30, "sans_b", 42, INK, a)
        tag(f, sub, x + 44, 292 + (1 - a) * 30, (60, 58, 55), a, 26)
        put(f, val, x + 40, 350 + (1 - a) * 30, "serif_k", 130, col, a)
        if nt > 0:
            put(f, ntxt, x + 44, 580, "sans", 34, MUTED, nt, dy=(1 - nt) * 12)


def s_china_both(t, c):
    f = shade(kb("store_hk", t / c.T, 1.18, 1.22, blur=16), 0.8)
    china_cards(f, t, appear(t, L(c, 1) + 0.2, 0.7), appear(t, L(c, 2) + 0.9, 0.7))
    a = appear(t, L(c, 2) + 1.8, 0.6)
    put(f, "哪个是真的？", W / 2, 700, "serif_k", 84, GOLD, a, "ct", dy=(1 - a) * 16)
    return f


def s_china_explain(t, c):
    f = shade(kb("store_hk", 1 + t / c.T, 1.18, 1.22, blur=16), 0.8)
    china_cards(f, t, 1, 1, appear(t, L(c, 1) + 0.2, 0.6), appear(t, L(c, 2) + 0.2, 0.6))
    a0 = appear(t, 0.2, 0.5)
    tag(f, "两个都是真的，只是回答不同的问题", W / 2, 100, SAGE, a0, 34, fg=DARK, anchor="c")
    for k, (l, r, t0) in enumerate([("同店 −8%", "中国全部销售 −8%", L(c, 3) + 0.2), ("营收 +4%", "市场毫无压力", L(c, 4) + 0.2)]):
        a = appear(t, t0, 0.6)
        y = 740 + k * 80
        put(f, l, W / 2 - 60, y, "sans_b", 44, INK, a, "rt")
        put(f, "≠", W / 2, y - 8, "sans_b", 54, RED, a, "ct")
        put(f, r, W / 2 + 60, y, "sans_b", 44, INK, a, "lt")
    return f


def s_pitfall(t, c):
    f = grid_bg()
    a = appear(t, 0.1, 0.7)
    put(f, "看财报最容易踩的坑", W / 2, 220, "serif_k", 72, INK, a, "ct")
    box(f, W / 2 - 60, 330, 120, 5, RED, a)
    for k, (l, r, col, t0) in enumerate([("看到好数字", "坏数字不存在", SAGE, L(c, 1)), ("看到坏数字", "整家公司没有生意", RED, L(c, 2))]):
        a2 = appear(t, t0 + 0.2, 0.6)
        y = 450 + k * 150
        tag(f, l, W / 2 - 80, y, col, a2, 42, fg=DARK if col == SAGE else INK, anchor="r")
        put(f, "≠", W / 2, y - 4, "sans_b", 70, GOLD, a2, "ct")
        put(f, r, W / 2 + 80, y + 4, "serif_k", 62, INK, a2, "lt")
    return f


def s_eps(t, c):
    f = shade(kb("nasdaq", t / c.T, 1.1, 1.2, blur=10), 0.74)
    a = appear(t, 0.2, 0.7)
    put(f, "第二季度每股收益（EPS）", W / 2, 250, "sans_b", 42, MUTED, a, "ct")
    g = ease_io((t - L(c, 1)) / 1.4)
    if g > 0:
        put(f, f"${2.92 * g:.2f}", W / 2, 330, "serif_k", 220, GOLD, appear(t, L(c, 1), 0.3), "ct")
    a3 = appear(t, L(c, 2) + 0.2, 0.6)
    tag(f, "仍然盈利", W / 2, 650, SAGE, a3, 40, fg=DARK, anchor="c")
    return f


def s_refund(t, c):
    f = shade(kb("port", t / c.T, 1.02, 1.12, (0.3, 0.5), (0.6, 0.5)), 0.58)
    kicker(f, "一项特别的收入影响", t, 0.2)
    a = appear(t, L(c, 1) + 0.2, 0.7)
    box(f, 120, 540, 12, 190, GOLD, a)
    put(f, "关税退税", 160, 530, "sans_b", 40, MUTED, a)
    put(f, "约 1.345 亿美元", 160, 580, "serif_k", 92, INK, a, dx=(1 - a) * -20)
    a2 = appear(t, L(c, 2) + 0.4, 0.7)
    tag(f, "连同相关利息 → 每股收益 + 约 0.86 美元", 160, 740, GOLD, a2, 36, fg=DARK)
    return f


def s_eps_split(t, c):
    f = grid_bg()
    kicker(f, "把 2.92 美元拆开看", t, 0.1)
    x0, y0, total_w, h = 260, 420, 1400, 130
    a = appear(t, 0.2, 0.6)
    wa = total_w * 2.06 / 2.92
    sep = 36 * ease_io((t - L(c, 0) - 1.6) / 0.8)
    box(f, x0, y0, wa, h, (120, 128, 118), a, r=8)
    box(f, x0 + wa + sep, y0, total_w - wa, h, GOLD, a, r=8)
    put(f, "EPS  $2.92", x0, y0 - 20, "sans_b", 40, INK, a, "lb")
    a2 = appear(t, L(c, 0) + 1.8, 0.6)
    put(f, "$2.06", x0 + wa / 2, y0 + h / 2, "serif_k", 64, INK, a2, "cm", shadow=0.3)
    put(f, "$0.86", x0 + wa + sep + (total_w - wa) / 2, y0 + h / 2, "serif_k", 64, DARK, a2, "cm", shadow=0)
    put(f, "其余部分", x0 + wa / 2, y0 + h + 24, "sans_b", 34, MUTED, a2, "ct")
    put(f, "关税退税及利息影响", x0 + wa + sep + (total_w - wa) / 2, y0 + h + 24, "sans_b", 34, GOLD, a2, "ct")
    put(f, "注：简单相减，仅作示意", x0 + total_w + sep, y0 + h + 80, "sans", 24, MUTED, a2, "rt")
    a3 = appear(t, L(c, 1) + 0.3, 0.6)
    tag(f, "只看标题里的 EPS  →  容易高估日常经营的表现", W / 2, 760, RED, a3, 38, anchor="c")
    return f


def s_refund_note(t, c):
    f = shade(kb("port", 1 + t / c.T, 1.12, 1.2, blur=12), 0.76)
    d0 = Ld(c, 0)
    rows = [("退税是真钱", SAGE, L(c, 0) + 0.2), ("公司也不是“全靠退税撑着”", SAGE, L(c, 0) + d0 * 0.5),
            ("但不能假设：每季都会再来一次", RED, L(c, 2))]
    for k, (s_, col, t0) in enumerate(rows):
        a = appear(t, t0, 0.6)
        y = 300 + k * 140
        dot(f, 250, y + 40, 26, col, a)
        put(f, s_, 300, y, "serif_k", 64, INK if k < 2 else GOLD, a, dx=(1 - a) * 20)
    return f


def s_bridge2(t, c):
    f = shade(kb("u2", t / c.T, 1.0, 1.08, (0.7, 0.3), (0.72, 0.35)), 0.5)
    a = appear(t, L(c, 2) + 0.3, 0.7)
    put(f, "不买运动服了？", 120, 340, "serif_k", 92, INK, a, dy=(1 - a) * 20)
    a2 = appear(t, L(c, 3) + 0.2, 0.7)
    put(f, "还是，有了别的选择？", 120, 480, "serif_k", 92, GOLD, a2, dy=(1 - a2) * 20)
    return f


# ============================================================== chapter 3

def s_alo_tmall(t, c):
    f = shade(kb("alo_store", t / c.T, 1.02, 1.12, (0.4, 0.5), (0.55, 0.45)), 0.45)
    lower_third(f, t, L(c, 0) + 0.3, "Alo · 天猫官方旗舰店", "2026 年 8 月 · 正式开售", y=150, size=60)
    a = appear(t, L(c, 2) + 0.2, 0.7)
    x, y = 1040, 400
    box(f, x, y, 760, 440, (18, 17, 16), a * 0.85, r=18)
    put(f, "预售尾款支付开启后 1 分钟", x + 50, y + 50, "sans_b", 36, MUTED, a)
    put(f, "> ¥1000 万", x + 44, y + 110, "serif_k", 130, GOLD, a, dy=(1 - a) * 20)
    put(f, "店铺成交额", x + 50, y + 300, "sans_b", 40, INK, a)
    put(f, "数据来源：天猫公布", x + 50, y + 370, "sans", 26, MUTED, a)
    return f


def s_alo_caveat(t, c):
    f = shade(kb("parcel", t / c.T, 1.05, 1.15, blur=12), 0.76)
    a = appear(t, 0.1, 0.6)
    tag(f, "注意口径", W / 2, 150, GOLD, a, 32, fg=DARK, anchor="c")
    put(f, "预售尾款开启后 · 1 分钟成交额", W / 2, 240, "serif_k", 70, INK, a, "ct")
    for k, (s_, t0) in enumerate([("不是一分钟利润", L(c, 1)), ("也不是一分钟凭空找到的新顾客", L(c, 2) + 0.2)]):
        a2 = appear(t, t0, 0.6)
        y = 440 + k * 130
        dot(f, 470, y + 36, 26, RED, a2)
        put(f, s_, 520, y, "serif", 60, INK, a2, dx=(1 - a2) * 20)
    return f


def s_alo_means(t, c):
    f = shade(kb("alo_store", t / c.T, 1.14, 1.2, blur=18), 0.78)
    box(f, W // 2 - 1, 200, 2, 600, INK, 0.3)
    a = appear(t, L(c, 0) + 0.6, 0.6)
    tag(f, "能说明", 160, 200, SAGE, a, 36, fg=DARK)
    a1 = appear(t, L(c, 1) + 0.3, 0.6)
    put(f, "开售前，聚集了一批\n愿意付钱的人", 160, 300, "serif_k", 66, INK, a1, dy=(1 - a1) * 16)
    a2 = appear(t, L(c, 2) + 0.2, 0.6)
    tag(f, "不能说明", W // 2 + 120, 200, RED, a2, 36)
    for k, (s_, t0) in enumerate([("半年后的复购率", L(c, 3) + 0.2), ("Lululemon 的顾客\n全部转去了 Alo", L(c, 4) + 0.3)]):
        ak = appear(t, t0, 0.6)
        put(f, s_, W // 2 + 120, 300 + k * 150, "serif_k", 62, INK, ak, dy=(1 - ak) * 16)
    return f


def s_alo_premium(t, c):
    f = shade(kb("alo_store", t / c.T, 1.2, 1.3, (0.8, 0.4), (0.7, 0.5)), 0.55)
    a = appear(t, L(c, 0) + 0.4, 0.6)
    tag(f, "不是便宜平替", 130, 200, RED, a, 40)
    a2 = appear(t, L(c, 1) + 0.2, 0.6)
    put(f, "同样在卖高价的运动生活方式", 130, 300, "sans_b", 50, INK, a2)
    a3 = appear(t, L(c, 2) + 0.6, 0.8)
    put(f, "争夺同一笔预算：", 130, 480, "serif", 58, MUTED, a3)
    put(f, "“我愿意为喜欢的东西\n多花一点”", 130, 560, "serif_k", 84, GOLD, a3, dy=(1 - a3) * 16)
    return f


def s_compare(t, c):
    f = Image.new("RGB", (W, H), BG)
    f.paste(kb("store_nyc", t / c.T, 1.1, 1.18, (0.35, 0.5), (0.45, 0.5), size=(W // 2, H)), (0, 0))
    f.paste(kb("alo_store", t / c.T, 1.1, 1.18, (0.5, 0.5), (0.4, 0.5), size=(W // 2, H)), (W // 2, 0))
    f = shade(f, 0.55)
    box(f, W // 2 - 1, 0, 2, H, INK, 0.5)
    a = appear(t, 0.1, 0.6)
    put(f, "lululemon", W // 4, 150, "sans_k", 76, INK, a, "ct")
    put(f, "Alo", 3 * W // 4, 150, "sans_k", 76, INK, a, "ct")
    dot(f, W // 2, 190, 110, RED, a)
    put(f, "VS", W // 2, 190, "sans_k", 44, INK, a, "cm", shadow=0)
    put(f, "把运动服带进日常生活", W // 4, 270, "sans", 38, MUTED, appear(t, L(c, 0) + 0.3, 0.6), "ct")
    put(f, "从运动场景走向街头", 3 * W // 4, 270, "sans", 38, MUTED, appear(t, L(c, 1) + 0.3, 0.6), "ct")
    d3 = Ld(c, 3)
    for k, (s_, t0) in enumerate([("谁穿起来更好？", L(c, 3)), ("谁更符合现在的审美？", L(c, 3) + d3 * 0.45),
                                  ("谁让我觉得钱花得值？", L(c, 4) + 0.3)]):
        ak = appear(t, t0, 0.5)
        tag(f, s_, W / 2, 470 + k * 110, CREAM, ak, 44, fg=DARK, anchor="c")
    return f


def s_second_order(t, c):
    f = grid_bg()
    for k, (who, what, col, t0) in enumerate([("对 Lululemon", "一个竞争信号", RED, L(c, 0) + 0.3),
                                               ("对 Alo 自己", "下一场考试的起点", SAGE, L(c, 1) + 0.2)]):
        a = appear(t, t0, 0.6)
        y = 230 + k * 140
        put(f, who, 560, y, "sans_b", 46, MUTED, a, "rt")
        box(f, 600, y + 8, 8, 60, col, a)
        put(f, what, 640, y - 6, "serif_k", 68, INK, a, dx=(1 - a) * 20)
    a2 = appear(t, L(c, 2) + 0.2, 0.6)
    box(f, 240, 580, 1440, 190, (30, 29, 27), a2 * 0.95, r=16)
    put(f, "第一单", 330, 620, "sans_b", 40, MUTED, a2)
    put(f, "靠期待", 330, 672, "serif_k", 64, INK, a2)
    arrow(f, 700, 690, 820, MUTED, appear(t, L(c, 2) + 1.2, 0.5))
    a3 = appear(t, L(c, 2) + 1.4, 0.6)
    put(f, "第二单、第三单", 880, 620, "sans_b", 40, MUTED, a3)
    put(f, "靠产品兑现", 880, 672, "serif_k", 64, GOLD, a3)
    return f


# ============================================================== chapter 4

def s_ch4_body(t, c):
    return s_ch4(t, c)


def s_assets(t, c):
    f = shade(kb("warrior", t / c.T, 1.1, 1.18, blur=12), 0.74)
    kicker(f, "底气还在", t, 0.2)
    cards = [(L(c, 0) + 0.2, "盈利", "仍在赚钱", "第二季度每股收益 $2.92", SAGE, 76),
             (L(c, 1) + 0.3, "现金及现金等价物", "≈ 13.9 亿美元", "截至第二季度末", GOLD, 64),
             (L(c, 2) + 0.2, "新品", "力量训练系列", "今年推出", INK, 62)]
    for k, (t0, lab, big, sub, col, bs) in enumerate(cards):
        a = appear(t, t0, 0.6)
        stat_card(f, 150 + k * 560, 320 + (1 - a) * 30, 500, 380, a, big, lab, sub, col, bs)
    return f


def s_new_ceo(t, c):
    f = shade(kb("store_nyc", t / c.T, 1.2, 1.28, (0.7, 0.4), (0.6, 0.45), blur=14), 0.72)
    a = appear(t, L(c, 0) + 0.2, 0.6)
    tag(f, "新任 CEO · 2026 年 9 月上任", 150, 250, RED, a, 34)
    a1 = appear(t, L(c, 0) + 0.6, 0.8)
    put(f, "Heidi O'Neill", 144, 330, "serif_k", 120, INK, a1, dy=(1 - a1) * 20)
    box(f, 152, 500, 160 * a1, 5, RED, a1)
    a2 = appear(t, L(c, 1) + 0.2, 0.6)
    put(f, "多年运动服饰行业经验", 152, 540, "sans_b", 46, MUTED, a2)
    # product / brand / customer triangle
    t0 = L(c, 2) + 0.3
    pts = [(1420, 300, "产品"), (1230, 640, "品牌"), (1610, 640, "顾客")]
    for k in range(3):
        x0, y0, _ = pts[k]
        x1, y1, _ = pts[(k + 1) % 3]
        line(f, x0, y0, x1, y1, GOLD, 4, 1, ease_io((t - t0 - 0.4 - k * 0.2) / 0.6))
    for k, (x, y, s_) in enumerate(pts):
        ak = appear(t, t0 + k * 0.15, 0.5)
        dot(f, x, y, 150, (28, 27, 25), ak)
        dot(f, x, y, 150, GOLD, ak, outline=3)
        put(f, s_, x, y, "serif_k", 46, INK, ak, "cm", shadow=0)
    return f


def s_coach(t, c):
    f = shade(kb("runners", t / c.T, 1.02, 1.12, (0.4, 0.5), (0.6, 0.5)), 0.5)
    kicker(f, "换 CEO，像换球队教练", t, 0.2)
    for k, (a_, b_, col, t0) in enumerate([("宣布人选那天", "让人期待", GOLD, L(c, 1) + 0.2), ("比赛结果", "上场之后才知道", INK, L(c, 2) + 0.2)]):
        a = appear(t, t0, 0.6)
        y = 520 + k * 130
        tag(f, a_, 150, y, (35, 34, 32), a, 38)
        arrow(f, 470, y + 34, 550, MUTED, a)
        put(f, b_, 580, y, "serif_k", 60, col, a, dx=(1 - a) * 20)
    return f


def s_watchlist(t, c):
    f = grid_bg()
    kicker(f, "接下来几个季度，看这四件事", t, 0.2)
    items = [("新品", "有没有带来稳定的购买？"), ("老顾客", "会不会回来？"), ("同店销售", "能不能改善？"), ("利润", "改善之后，还守得住吗？")]
    for k, (h_, s_) in enumerate(items):
        a = appear(t, L(c, k + 1), 0.5)
        y = 290 + k * 135
        box(f, 160, y, 64, 64, GOLD, a, r=10, outline=4)
        put(f, h_, 270, y - 2, "serif_k", 56, INK, a, dx=(1 - a) * 20)
        put(f, s_, 520, y + 6, "sans_b", 46, MUTED, a, dx=(1 - a) * 20)
    return f


def s_founder(t, c):
    f = shade(kb("store_hk", t / c.T, 1.2, 1.3, (0.5, 0.2), (0.5, 0.3), blur=12), 0.74)
    a = appear(t, 0.2, 0.7)
    tag(f, "创始人", 150, 170, RED, a, 34)
    put(f, "Chip Wilson", 144, 240, "serif_k", 110, INK, a, dy=(1 - a) * 20)
    put(f, "曾对公司方向提出挑战", 152, 400, "sans_b", 42, MUTED, appear(t, 0.9, 0.6))
    for k, (d_, s_, t0) in enumerate([("2026 年 5 月", "与公司达成合作协议", L(c, 1) + 0.2),
                                      ("董事会", "迎来两名新成员，其中一位曾任 On 联席 CEO", L(c, 2) + 0.2)]):
        ak = appear(t, t0, 0.6)
        y = 510 + k * 100
        dot(f, 170, y + 26, 22, GOLD, ak)
        put(f, d_, 210, y, "sans_b", 40, GOLD, ak)
        put(f, s_, 470, y, "sans", 40, INK, ak)
    a3 = appear(t, L(c, 4) + 0.3, 0.7)
    tag(f, "董事会换了新人  ≠  下一条裤子自动更好穿", 150, 740, (240, 236, 228), a3, 40, fg=DARK)
    return f


# ============================================================== ending

def s_verdict_pants(t, c):
    f = sage_bg()
    cutout(f, "u1", 1120, 80 - 16 * clamp(t / c.T), 1030, appear(t, 0, 0.8))
    f = shade(f, 0.0, 0.8, 0.5)
    a = appear(t, L(c, 1), 0.7)
    put(f, "如果你问的是裤子", 150, 220, "serif_k", 76, INK, a)
    d2 = Ld(c, 2)
    for k, s_ in enumerate(["面料", "版型", "运动时的表现"]):
        ak = appear(t, L(c, 2) + k * d2 * 0.28, 0.5)
        tag(f, s_, 150 + [0, 190, 380][k], 380, CREAM, ak, 44, fg=DARK)
    a2 = appear(t, L(c, 3) + 0.3, 0.7)
    put(f, "穿了半年之后，\n还愿不愿意再买一条？", 150, 530, "serif_k", 68, GOLD, a2, dy=(1 - a2) * 16)
    return f


def s_verdict_stock(t, c):
    f = shade(kb("nasdaq", t / c.T, 1.0, 1.1, (0.5, 0.5), (0.55, 0.45)), 0.6)
    kicker(f, "如果你问的是股票", t, 0.2)
    put(f, "不只看股价多高、今天跌了多少", 150, 210, "sans", 40, MUTED, appear(t, L(c, 0) + 1.5, 0.6))
    for k, (h_, s_, t0) in enumerate([("经营压力", "暂时的？还是顾客选择真的变了？", L(c, 1) + 0.2),
                                      ("新团队", "办法能否一步步反映在产品和财报里？", L(c, 2) + 0.2)]):
        a = appear(t, t0, 0.6)
        y = 380 + k * 170
        tag(f, h_, 150, y, GOLD, a, 40, fg=DARK)
        put(f, s_, 150, y + 80, "serif", 54, INK, a, dx=(1 - a) * 20)
    return f


def s_judgement(t, c):
    f = grid_bg()
    kicker(f, "一个谨慎的判断", t, 0.2)
    rows = [("压力", "销售和竞争压力，确实存在", RED, L(c, 1) + 0.2),
            ("底气", "仍有盈利、现金和调整空间", SAGE, L(c, 2) + 0.2),
            ("答案", "能否重新获得增长：尚未揭晓", GOLD, L(c, 3) + 0.2)]
    for k, (h_, s_, col, t0) in enumerate(rows):
        a = appear(t, t0, 0.6)
        y = 300 + k * 150
        tag(f, h_, 150, y, col, a, 42, fg=DARK if col != RED else INK)
        put(f, s_, 330, y - 4, "serif_k", 66, INK, a, dx=(1 - a) * 20)
    return f


def s_quote(t, c):
    f = shade(kb("u4", t / c.T, 1.1, 1.16, blur=18), 0.8, 0.6)
    rows = [("一条裤子的价格，可以由公司决定；", INK, L(c, 1), 250),
            ("但它值不值这个价，最后由穿它的人决定。", GOLD, L(c, 2), 350),
            ("一只股票的价格，每天都在市场上变化；", INK, L(c, 3), 540),
            ("但长期能支撑它的，还是顾客愿不愿意继续买单。", GOLD, L(c, 4), 640)]
    for s_, col, t0, y in rows:
        a = appear(t, t0 + 0.1, 0.9)
        put(f, s_, W / 2, y, "serif_k", 60, col, a, "ct", dy=(1 - a) * 14)
    return f


def s_outro(t, c):
    f = shade(kb("u4", t / c.T, 1.02, 1.1, (0.5, 0.5), (0.5, 0.4), blur=6), 0.7)
    a = appear(t, 0.1, 0.8)
    put(f, "最优解笔记", W / 2, 260, "serif_k", 110, INK, a, "cb", spacing=6)
    put(f, "Lara", W / 2, 290, "sans", 36, MUTED, a, "ct", spacing=4)
    for k, (h_, s_, t0) in enumerate([("穿过的人", "穿久之后，哪些差别是真的？", L(c, 1) + 0.3),
                                      ("关注股票的人", "哪个经营指标改善，你才相信它在恢复？", L(c, 2) + 0.3)]):
        ak = appear(t, t0, 0.6)
        y = 430 + k * 130
        box(f, 360, y, 1200, 100, (24, 23, 22), ak * 0.9, r=14)
        put(f, h_, 400, y + 50, "sans_b", 34, GOLD, ak, "lm", shadow=0)
        put(f, s_, 660, y + 50, "sans_b", 40, INK, ak, "lm", shadow=0)
    a3 = appear(t, L(c, 3) + 0.2, 0.6)
    tag(f, "评论区见 · 下期再见", W / 2, 720, RED, a3, 38, anchor="c")
    return f


CREDIT_NAMES = {
    "store_nyc": "Lululemon 门店", "store_hk": "Lululemon 香港门店", "store_asia": "Lululemon 门店",
    "alo_store": "Alo Yoga 门店", "squat_front": "健身房深蹲", "squat_back": "健身房深蹲",
    "warrior": "瑜伽", "yogahands": "瑜伽", "nasdaq": "Nasdaq MarketSite", "port": "集装箱码头",
    "parcel": "快递三轮车", "runners": "城市跑者",
}


def s_credits(t, c):
    f = solid_bg((24, 23, 22), (8, 8, 8))
    a = appear(t, 0.2, 0.8)
    put(f, "图片与资料来源", 150, 110, "serif_k", 52, INK, a)
    try:
        cr = json.load(open(os.path.join(HERE, "..", "web", "credits.json")))
    except Exception:
        cr = {}
    used = [k for k in CREDIT_NAMES if k in cr and os.path.exists(os.path.join(HERE, "..", "web", k + ".jpg"))]
    y = 210
    for k in used:
        v = cr[k]
        put(f, f"{CREDIT_NAMES[k]}  ·  {v['artist'][:38]}  ·  {v['license']}  ·  Wikimedia Commons", 150, y,
            "sans", 25, MUTED, a, shadow=0)
        y += 42
    y += 20
    for s_ in ["其余图片及参考画面由创作者提供；“Get Low 页面”为示意图，非官网截图。",
               "数据：Lululemon 2026 财年第二季度财报及公司公告；天猫公布的开售数据。",
               "旁白为 AI 合成语音。本片仅供信息交流，不构成任何投资建议。"]:
        put(f, s_, 150, y, "sans", 27, INK, a, shadow=0)
        y += 48
    return f


PAINTERS = {k[2:]: v for k, v in globals().items() if k.startswith("s_") and callable(v)}
