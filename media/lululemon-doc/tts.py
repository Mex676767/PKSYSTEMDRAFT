import json, os, re, sys, hashlib
import numpy as np, soundfile as sf
from narration import SCENES
from tts_lib import synth
VOICE = "zf_002"
os.makedirs("audio", exist_ok=True)
out = []
for key, lines in SCENES:
    for i, ln in enumerate(lines):
        disp, _, spoken = ln.partition("|")
        spoken = spoken or disp
        spoken = spoken.replace("——", "，").replace("“", "").replace("”", "")
        h = hashlib.md5((VOICE + spoken).encode()).hexdigest()[:10]
        fn = f"audio/{key}_{i}_{h}.wav"
        if not os.path.exists(fn):
            s, sr, ph = synth(spoken, VOICE)
            # trim leading/trailing near-silence
            nz = np.where(np.abs(s) > 0.01)[0]
            s = s[max(0, nz[0] - 600): nz[-1] + 1200]
            sf.write(fn, s, sr)
        d = sf.info(fn).duration
        out.append({"scene": key, "i": i, "text": disp.strip(), "wav": fn, "dur": d})
        print(f"{d:5.2f}s {disp}", flush=True)
json.dump(out, open("lines.json", "w"), ensure_ascii=False, indent=1)
print("total", sum(x["dur"] for x in out))
