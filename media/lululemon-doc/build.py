"""Assemble timeline from narration audio, render frames in parallel, mix audio, mux final mp4.

usage: python build.py preview [scene ...]   -> stills in out/preview/
       python build.py render                -> out/lululemon_doc.mp4
"""
import json, math, os, re, subprocess, sys, time
from multiprocessing import Pool
import numpy as np, soundfile as sf
from PIL import Image

from narration import SCENES
from gfx import W, H, FPS, INK, RED, MUTED, put, box, appear, clamp, grain
import scenes as S

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
FFMPEG = "ffmpeg"
XF = 0.5  # crossfade between scenes
GAP_LINE = 0.28
TAIL = 0.55
LEAD = {"title_open": 1.8, "ch1": 1.5, "ch2": 1.5, "ch3": 1.5, "ch4": 1.5, "ch5": 1.5, "main_title": 0.3}
TAIL_X = {"outro": 2.5, "high_expect": 0.4, "same_report": 0.4}
CREDITS_DUR = 9.0

CHAPTERS = {"ch1": "第一章 · 一条裤子", "ch2": "第二章 · 一张财报", "ch3": "第三章 · 一个对手",
            "ch4": "第四章 · 一次调整", "ch5": "尾声 · 值不值"}
LIGHT = {"premium_parts", "scale"}
NO_WM = {"title_open", "ch1", "ch2", "ch3", "ch4", "ch5", "outro", "credits"}


class Ctx:
    pass


def timeline():
    lines = json.load(open(os.path.join(HERE, "lines.json")))
    by = {}
    for x in lines:
        by.setdefault(x["scene"], []).append(x)
    out, t, chap = [], 0.0, ""
    for key, _ in SCENES:
        c = Ctx()
        c.key, c.start = key, t
        c.chapter = chap = CHAPTERS.get(key, chap)
        lt = LEAD.get(key, 0.15)
        c.ls, c.le, c.lines = [], [], []
        for x in by[key]:
            c.ls.append(lt)
            c.le.append(lt + x["dur"])
            c.lines.append(x)
            lt += x["dur"] + GAP_LINE
        c.T = lt - GAP_LINE + TAIL + TAIL_X.get(key, 0)
        t += c.T
        out.append(c)
    c = Ctx()
    c.key, c.start, c.T, c.ls, c.le, c.lines, c.chapter = "credits", t, CREDITS_DUR, [], [], [], ""
    out.append(c)
    return out


# ---------------------------------------------------------------- subtitles

_PUNCT_END = "，。；：、,."


def wlen(s):
    return sum(0.55 if ord(ch) < 128 else 1 for ch in s)


def split_cue(text, maxc=22):
    text = text.replace("——", "，")
    parts = [p for p in re.findall(r"[^，。；：？！]*[，。；：？！]?", text) if p.strip()]
    chunks, cur = [], ""
    for p in parts:
        if cur and wlen(cur) + wlen(p) > maxc:
            chunks.append(cur)
            cur = p
        else:
            cur += p
    if cur:
        chunks.append(cur)
    res = []
    for ch in chunks:
        while wlen(ch) > maxc + 5:
            # cut near the middle, never inside a Latin word
            target, acc, cut = wlen(ch) / 2, 0, 0
            for i, x in enumerate(ch):
                acc += 0.55 if ord(x) < 128 else 1
                if acc >= target and not (x.isascii() and x.isalnum() and i + 1 < len(ch) and ch[i + 1].isascii() and ch[i + 1].isalnum()):
                    cut = i + 1
                    break
            res.append(ch[:cut])
            ch = ch[cut:]
        res.append(ch)
    return [r.strip() for r in res if r.strip()]


def cues(tl):
    out = []
    for c in tl:
        for i, x in enumerate(c.lines):
            t0, t1 = c.start + c.ls[i], c.start + c.le[i]
            parts = split_cue(x["text"])
            n = sum(len(p) for p in parts)
            a = t0
            for p in parts:
                b = a + (t1 - t0) * len(p) / n
                disp = p.rstrip(_PUNCT_END).strip()
                if disp.count("“") != disp.count("”"):
                    disp = disp.replace("“", "").replace("”", "")
                out.append((a, b + 0.05, disp))
                a = b
    return out


def draw_sub(f, t, cue_list):
    for a, b, s in cue_list:
        if a - 0.05 <= t <= b:
            al = min(clamp((t - a + 0.05) / 0.12), clamp((b - t) / 0.12) if b - t < 0.12 else 1)
            put(f, s, W / 2, H - 62, "sans_b", 46, INK, al, "cb", shadow=0.7, stroke=3)
            return


# ---------------------------------------------------------------- frames

_TL = None
_CUES = None


def _init():
    global _TL, _CUES
    _TL = timeline()
    _CUES = cues(_TL)


def scene_at(t):
    for i in range(len(_TL) - 1, -1, -1):
        if t >= _TL[i].start:
            return i
    return 0


def paint(i, t):
    c = _TL[i]
    return S.PAINTERS[c.key](t - c.start, c)


def frame_at(t, n):
    i = scene_at(t)
    c = _TL[i]
    f = paint(i, t)
    lt = t - c.start
    if i > 0 and lt < XF:
        prev = paint(i - 1, t)
        f = Image.blend(prev, f, (lt / XF) ** 0.9)
    total = _TL[-1].start + _TL[-1].T
    if c.key not in NO_WM:
        a = clamp(lt / 0.6) if _TL[i - 1].key in NO_WM else 1
        light = c.key in LIGHT
        box(f, 60, 58, 6, 34, RED, 0.9 * a)
        put(f, "最优解笔记", 80, 56, "serif_k", 28, (40, 36, 32) if light else INK, 0.85 * a, shadow=0 if light else 0.6)
        if c.chapter:
            put(f, c.chapter, W - 60, 60, "sans_b", 24, (110, 104, 96) if light else MUTED, 0.8 * a, "rt",
                shadow=0 if light else 0.6)
    draw_sub(f, t, _CUES)
    fade = min(clamp(t / 0.8), clamp((total - t) / 1.5))
    if fade < 1:
        f = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), f, fade)
    return grain(f, n)


def render_chunk(args):
    k, n0, n1 = args
    if _TL is None:
        _init()
    path = os.path.join(OUT, "chunks", f"c{k:03d}.mp4")
    if os.path.exists(path + ".done"):
        return path
    p = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                          "-pix_fmt", "yuv420p", "-g", str(FPS * 4), path], stdin=subprocess.PIPE)
    for n in range(n0, n1):
        p.stdin.write(frame_at(n / FPS, n).tobytes())
    p.stdin.close()
    p.wait()
    open(path + ".done", "w").close()
    return path


# ---------------------------------------------------------------- audio

def build_audio(tl, total):
    sr = 24000
    n = int(math.ceil(total * sr)) + sr
    voice = np.zeros(n, np.float32)
    for c in tl:
        for i, x in enumerate(c.lines):
            s, r = sf.read(os.path.join(HERE, x["wav"]), dtype="float32")
            assert r == sr
            o = int((c.start + c.ls[i]) * sr)
            voice[o:o + len(s)] += s[: n - o]
    pk = np.abs(voice).max()
    voice *= 0.89 / pk
    music = ambient(n, sr, tl)
    # duck music under narration
    env = np.abs(voice)
    win = int(0.25 * sr)
    env = np.convolve(env, np.ones(win) / win, "same")
    env = np.clip(env / 0.03, 0, 1)
    k = int(0.6 * sr)
    env = np.convolve(env, np.ones(k) / k, "same")
    gain = 0.5 - 0.32 * np.clip(env, 0, 1)
    mix = voice + music * gain
    # global fade
    fi, fo = int(0.8 * sr), int(2.0 * sr)
    mix[:fi] *= np.linspace(0, 1, fi)
    end = int(total * sr)
    mix[end - fo:end] *= np.linspace(1, 0, fo)
    mix[end:] = 0
    mix = np.clip(mix, -0.98, 0.98)
    path = os.path.join(OUT, "mix.wav")
    sf.write(path, mix[: end + int(0.1 * sr)], sr)
    return path


def ambient(n, sr, tl):
    """Slow minor-key pad with gentle reverb, plus a soft low hit on each chapter card."""
    t = np.arange(n) / sr
    chords = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67]]
    seg = 8.0
    out = np.zeros(n, np.float32)
    rng = np.random.default_rng(3)
    nseg = int(math.ceil(n / sr / seg)) + 1
    for s in range(nseg):
        ch = chords[s % 4]
        a, b = int((s * seg - 1.5) * sr), int(((s + 1) * seg + 1.5) * sr)
        a, b = max(a, 0), min(b, n)
        if a >= b:
            continue
        tt = t[a:b]
        L = b - a
        env = np.ones(L, np.float32)
        ramp = min(int(2.5 * sr), L // 2)
        env[:ramp] = np.sin(np.linspace(0, np.pi / 2, ramp)) ** 2
        env[-ramp:] = np.cos(np.linspace(0, np.pi / 2, ramp)) ** 2
        sig = np.zeros(L, np.float32)
        for m in ch:
            fq = 440 * 2 ** ((m - 69) / 12)
            for det, amp in ((0.0, 0.5), (0.18, 0.25), (-0.21, 0.25)):
                ph = rng.uniform(0, 2 * np.pi)
                sig += amp * np.sin(2 * np.pi * (fq + det) * tt + ph).astype(np.float32)
                sig += 0.12 * amp * np.sin(2 * np.pi * 2 * (fq + det) * tt + ph).astype(np.float32)
        bass = 440 * 2 ** ((ch[0] - 12 - 69) / 12)
        sig += 0.6 * np.sin(2 * np.pi * bass * tt).astype(np.float32)
        out[a:b] += sig * env
    # slow tremolo-ish movement and a touch of shimmer
    out *= (0.85 + 0.15 * np.sin(2 * np.pi * 0.07 * t)).astype(np.float32)
    # simple reverb: FFT convolution with decaying noise
    ir_len = int(2.2 * sr)
    ir = rng.normal(0, 1, ir_len).astype(np.float32) * np.exp(-np.linspace(0, 6, ir_len)).astype(np.float32)
    ir /= np.sqrt((ir ** 2).sum())
    m = 1 << int(math.ceil(math.log2(n + ir_len)))
    wet = np.fft.irfft(np.fft.rfft(out, m) * np.fft.rfft(ir, m), m)[:n].astype(np.float32)
    out = 0.55 * out + 0.9 * wet
    # gentle low-pass in the frequency domain to keep it soft
    spec = np.fft.rfft(out)
    fr = np.fft.rfftfreq(n, 1 / sr)
    spec *= 1 / np.sqrt(1 + (fr / 1400) ** 4)
    out = np.fft.irfft(spec, n).astype(np.float32)
    peak = np.abs(out).max() + 1e-6
    # chapter hits
    for c in tl:
        if c.key.startswith("ch") or c.key == "title_open":
            o = int(c.start * sr) + int(0.1 * sr)
            L = int(2.5 * sr)
            tt = np.arange(L) / sr
            fq = 55 * np.exp(-tt * 0.8)
            hit = np.sin(2 * np.pi * np.cumsum(fq) / sr) * np.exp(-tt * 2.2)
            out[o:o + L] += 0.9 * hit[: max(0, min(L, n - o))].astype(np.float32) * peak * 0.6
    out /= np.abs(out).max() + 1e-9
    return out * 0.32


# ---------------------------------------------------------------- main

def main():
    os.makedirs(os.path.join(OUT, "chunks"), exist_ok=True)
    _init()
    total = _TL[-1].start + _TL[-1].T
    mode = sys.argv[1] if len(sys.argv) > 1 else "render"
    if mode == "info":
        for c in _TL:
            print(f"{c.start:7.2f} {c.T:6.2f} {c.key}")
        print("total", total)
        return
    if mode == "preview":
        os.makedirs(os.path.join(OUT, "preview"), exist_ok=True)
        keys = sys.argv[2:] or [c.key for c in _TL]
        for c in _TL:
            if c.key not in keys:
                continue
            tp = c.start + (c.le[-1] if c.le else c.T * 0.6) - 0.3
            frame_at(tp, 0).save(os.path.join(OUT, "preview", f"{c.key}.jpg"), quality=85)
        return
    if mode == "srt":
        with open(os.path.join(OUT, "subtitles.srt"), "w") as fh:
            for k, (a, b, s) in enumerate(_CUES, 1):
                def ts(x):
                    return f"{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{int(x % 60):02d},{int(x * 1000 % 1000):03d}"
                fh.write(f"{k}\n{ts(a)} --> {ts(b)}\n{s}\n\n")
        return
    nframes = int(total * FPS)
    per = FPS * 12
    jobs = [(k, n0, min(n0 + per, nframes)) for k, n0 in enumerate(range(0, nframes, per))]
    t0 = time.time()
    with Pool(int(os.environ.get("JOBS", "4"))) as pool:
        for j, p in enumerate(pool.imap_unordered(render_chunk, jobs)):
            print(f"chunk {j + 1}/{len(jobs)} {time.time() - t0:.0f}s", flush=True)
    lst = os.path.join(OUT, "chunks.txt")
    with open(lst, "w") as fh:
        for k, _, _ in jobs:
            fh.write(f"file 'chunks/c{k:03d}.mp4'\n")
    audio = build_audio(_TL, total)
    final = os.path.join(OUT, "lululemon_doc.mp4")
    subprocess.check_call([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-i", audio,
                           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest",
                           "-movflags", "+faststart", final])
    print("done", final, time.time() - t0)


if __name__ == "__main__":
    main()
