"""Synthesise the music bed and sound effects, then mix them under the narration.

Everything here is generated from sine waves and noise, so there is nothing licensed in the
track. Cue times come from the page itself (cues.json, written by cues.cjs), so the sound stays
locked to the animation if the narration is re-timed.

usage: FFMPEG=ffmpeg python3 audio.py   ->  mix.wav (48 kHz stereo)
"""
import json, os, subprocess, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
FF = os.environ.get("FFMPEG", "ffmpeg")
cues = json.load(open(os.path.join(HERE, "cues.json")))
DUR = cues["dur"] + 1.0
N = int(DUR * SR)
rng = np.random.default_rng(7)


def read_wav(path):
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def env(n, a, r):
    """attack/release envelope over n samples (a, r in seconds)"""
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x, alpha):
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += alpha * (x[i] - acc); y[i] = acc
    return y


def fft_lowpass(x, cutoff_hz):
    """zero everything above cutoff (fast for long tracks)"""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[f > cutoff_hz] = 0
    return np.fft.irfft(X, len(x))


def moving_avg(x, n):
    c = np.cumsum(np.insert(x, 0, 0.0))
    y = (c[n:] - c[:-n]) / n
    return np.concatenate([np.full(n // 2, y[0]), y, np.full(len(x) - len(y) - n // 2, y[-1])])


def tone(freqs, dur, amp=1.0, decay=None):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * t) for f in freqs) / len(freqs)
    if decay: s *= np.exp(-t / decay)
    return amp * s


def noise(dur):
    return rng.standard_normal(int(dur * SR))


# ---------------------------------------------------------------- sound effects
def sfx_slam():
    t = np.arange(int(0.45 * SR)) / SR
    body = np.sin(2 * np.pi * (70 - 30 * t) * t) * np.exp(-t / 0.09)
    click = lowpass(noise(0.45), 0.25) * np.exp(-t / 0.018)
    return 0.9 * body + 0.5 * click

def sfx_paper():
    n = noise(0.38); n = n - lowpass(n, 0.08)
    return 0.35 * n * env(len(n), 0.04, 0.25) * np.hanning(len(n)) ** 0.5

def sfx_whoosh():
    d = 0.7; n = noise(d); t = np.arange(len(n)) / SR
    a = 0.02 + 0.25 * np.sin(np.pi * t / d)      # sweep the filter open then closed
    y = np.empty_like(n); acc = 0.0
    for i in range(len(n)):
        acc += a[i] * (n[i] - acc); y[i] = acc
    return 0.6 * y * np.sin(np.pi * t / d) ** 2

def sfx_boom():
    t = np.arange(int(2.2 * SR)) / SR
    return 0.9 * np.sin(2 * np.pi * (48 - 8 * t) * t) * np.exp(-t / 0.6) + 0.25 * lowpass(noise(2.2), 0.02) * np.exp(-t / 0.4)

def sfx_hum():
    t = np.arange(int(2.6 * SR)) / SR
    return 0.18 * (np.sin(2 * np.pi * 100 * t) + 0.5 * np.sin(2 * np.pi * 200 * t) + 0.25 * np.sin(2 * np.pi * 300 * t)) * env(len(t), 0.4, 1.2)

def sfx_coin():
    return tone([1760, 2637], 0.5, 0.5, decay=0.12)

def sfx_tick():
    t = np.arange(int(0.05 * SR)) / SR
    return 0.5 * np.sin(2 * np.pi * 1300 * t) * np.exp(-t / 0.008)

def sfx_alert():
    a = tone([880], 0.14, 0.35) * env(int(0.14 * SR), 0.005, 0.03)
    b = tone([660], 0.14, 0.35) * env(int(0.14 * SR), 0.005, 0.03)
    gap = np.zeros(int(0.05 * SR))
    return np.concatenate([a, gap, b, gap, a, gap, b])

def sfx_cash():
    return np.concatenate([sfx_tick(), np.zeros(int(0.03 * SR)), tone([2093, 2637, 3136], 0.6, 0.45, decay=0.18)])

def sfx_ring():
    t = np.arange(int(0.9 * SR)) / SR
    burst = 0.3 * (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) / 2 * (np.sin(2 * np.pi * 20 * t) > 0) * env(len(t), 0.01, 0.05)
    return np.concatenate([burst, np.zeros(int(0.35 * SR)), burst])

SFX = {k[4:]: v() for k, v in globals().items() if k.startswith("sfx_")}
GAIN = {"slam": 0.55, "paper": 0.5, "whoosh": 0.45, "boom": 0.45, "hum": 0.5, "coin": 0.35, "tick": 0.4, "alert": 0.35, "cash": 0.35, "ring": 0.4}

fx = np.zeros(N)
for at, kind in cues["sfx"]:
    s = SFX[kind] * GAIN[kind]; i = int(at * SR)
    fx[i:i + len(s)] += s[: max(0, N - i)]

# ---------------------------------------------------------------- music bed
# A-minor progression for the tense chapters, warmer C-major for the people chapter and the close.
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
MINOR = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]      # Am F C G
WARM = [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]]       # C G Am F
TENSE = {"Z0", "A2", "B1", "B4", "C2", "D2", "D3", "F3"}
WARMS = {"E1", "E2", "E3", "E4", "E5", "F2", "F4"}
secs = cues["sections"] + [["END", DUR]]
bar = 3.2
music = np.zeros(N)
pulse = np.zeros(N)
t_all = np.arange(N) / SR
for (sid, a), (_, b) in zip(secs[:-1], secs[1:]):
    prog_ = WARM if sid in WARMS else MINOR
    k = int(a // bar)
    while k * bar < b:
        s0, s1 = max(a, k * bar), min(b, (k + 1) * bar)
        i0, i1 = int(s0 * SR), int(s1 * SR)
        tt = t_all[i0:i1]
        chord = prog_[k % 4]
        pad = sum(np.sin(2 * np.pi * NOTE(m) * tt) + 0.3 * np.sin(2 * np.pi * NOTE(m + 12) * tt + 0.7) for m in chord) / 6
        pad += 0.6 * np.sin(2 * np.pi * NOTE(chord[0] - 12) * tt)
        e_ = env(i1 - i0, 0.6, 0.6)
        music[i0:i1] += 0.07 * pad * e_
        if sid in TENSE:  # soft heartbeat pulse on each beat
            beat = bar / 4
            for j in range(4):
                bi = int((k * bar + j * beat) * SR)
                if i0 <= bi < i1:
                    tb = np.arange(int(0.25 * SR)) / SR
                    thump = np.sin(2 * np.pi * 55 * tb) * np.exp(-tb / 0.07)
                    pulse[bi:bi + len(thump)] += 0.14 * thump[: max(0, N - bi)]
        k += 1
music = fft_lowpass(music + pulse, 1600)
# fade in/out
music[: int(2 * SR)] *= np.linspace(0, 1, int(2 * SR))
music[-int(4 * SR):] *= np.linspace(1, 0, int(4 * SR))

# ---------------------------------------------------------------- ducking + mix
vo = read_wav(os.path.join(HERE, "vo.wav"))
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
win = int(0.05 * SR)
rms = np.sqrt(moving_avg(vo ** 2, win))
duck = np.where(rms > 0.01, 0.35, 1.0)
duck = moving_avg(duck, int(0.25 * SR))   # ~0.25 s glide
mix = vo + music * duck + fx
mix /= max(1e-9, np.abs(mix).max()) / 0.95
stereo = np.stack([mix, mix], axis=1)
with wave.open(os.path.join(HERE, "mix_raw.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
subprocess.run([FF, "-y", "-v", "error", "-i", os.path.join(HERE, "mix_raw.wav"), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-ar", "48000", os.path.join(HERE, "mix.wav")], check=True)
os.remove(os.path.join(HERE, "mix_raw.wav"))
print(f"mix.wav: {DUR:.1f}s, {len(cues['sfx'])} effects")
