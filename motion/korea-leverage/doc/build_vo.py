"""Scratch voice-over + timeline for full.html.
Generates one TTS clip per narration line (Chinese voice, Korean words spliced in with a
Korean voice), lays the lines out on a timeline, and writes:
  timeline.js  (line + caption timings the animation is cued from)
  captions.srt (subtitles)    vo.wav (the mixed narration track)
The TTS voice is a placeholder for timing; replace vo.wav with a human read when you have one
(keep the line starts from captions.srt, or re-time narration.json).
"""
import asyncio, json, re, subprocess, pathlib, certifi, os
certifi.where = lambda: os.environ.get("SSL_CERT_FILE", certifi.__file__.replace("core.py", "cacert.pem"))
import edge_tts

HERE = pathlib.Path(__file__).parent
FF = os.environ.get("FFMPEG", "ffmpeg")
ZH, KO, RATE = "zh-CN-XiaoyiNeural", "ko-KR-SunHiNeural", "+13%"
VO = HERE / "vo"; VO.mkdir(exist_ok=True)

async def say(text, voice, out):
    if out.exists() and out.stat().st_size > 0: return
    c = edge_tts.Communicate(text, voice, rate=RATE if voice == ZH else "+0%")
    await c.save(str(out))

def dur(p):
    o = subprocess.run([FF, "-i", str(p)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", o).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)

async def main():
    lines = json.load(open(HERE / "narration.json"))
    for i, l in enumerate(lines):
        wav = VO / f"{l['k']}.wav"
        if wav.exists(): continue
        # drop fragments that are only punctuation (nothing to speak, TTS returns no audio)
        parts = [p for p in re.split(r"(【ko:.*?】)", l.get("tts", l["t"])) if p.strip("，。：；？！、—“” ")]
        clips = []
        for j, p in enumerate(parts):
            m = re.match(r"【ko:(.*?)】", p)
            out = VO / f"{l['k']}_{j}.mp3"
            await say(m.group(1) if m else p, KO if m else ZH, out)
            clips.append(out)
        args = sum([["-i", str(c)] for c in clips], [])
        # TTS clips carry ~0.5 s of silence at each end; trim it so spliced Korean words sit in the sentence
        trim = "silenceremove=start_periods=1:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_threshold=-48dB,areverse"
        fc = "".join(f"[{k}:a]aresample=48000,{trim},apad=pad_dur={0.06 if len(clips) > 1 else 0.02}[c{k}];" for k in range(len(clips)))
        fc += "".join(f"[c{k}]" for k in range(len(clips))) + f"concat=n={len(clips)}:v=0:a=1[a]"
        subprocess.run([FF, "-y", "-loglevel", "error", *args, "-filter_complex", fc, "-map", "[a]", "-ac", "1", str(wav)], check=True)
    t, prev, TL, caps = 0.8, None, [], []
    for i, l in enumerate(lines):
        if prev and l["s"] != prev: t += 0.9
        t += l.get("pre", 0)
        d = dur(VO / f"{l['k']}.wav")
        TL.append({"k": l["k"], "s": l["s"], "t0": round(t, 3), "t1": round(t + d, 3), "text": l["t"]})
        # captions: split at punctuation into chunks of <= 20 chars, timed by length
        chunks, buf = [], ""
        for piece in re.split(r"(?<=[，。：；？！—])", l["t"]):
            if buf and len(buf) + len(piece) > 20: chunks.append(buf); buf = piece
            else: buf += piece
        if buf: chunks.append(buf)
        total, acc = sum(len(c) for c in chunks), 0
        for c in chunks:
            a = t + d * acc / total; acc += len(c)
            caps.append({"t0": round(a, 3), "t1": round(t + d * acc / total, 3), "text": c.strip("，—")})
        t += d + 0.48 + l.get("pad", 0); prev = l["s"]
    total = round(t + 0.5, 2)
    (HERE / "timeline.js").write_text("window.TL = " + json.dumps({"dur": total, "lines": TL, "caps": caps}, ensure_ascii=False) + ";\n", encoding="utf-8")
    fmt = lambda x: f"{int(x//3600):02d}:{int(x%3600//60):02d}:{int(x%60):02d},{int(round(x%1*1000)) % 1000:03d}"
    (HERE / "captions.srt").write_text("".join(f"{k+1}\n{fmt(c['t0'])} --> {fmt(c['t1'])}\n{c['text']}\n\n" for k, c in enumerate(caps)), encoding="utf-8")
    args = sum([["-i", str(VO / f"{l['k']}.wav")] for l in lines], [])
    fc = "".join(f"[{i}:a]adelay={int(x['t0']*1000)}:all=1[d{i}];" for i, x in enumerate(TL))
    fc += "".join(f"[d{i}]" for i in range(len(TL))) + f"amix=inputs={len(TL)}:normalize=0,apad=whole_dur={total}[a]"
    subprocess.run([FF, "-y", "-loglevel", "error", *args, "-filter_complex", fc, "-map", "[a]", "-ar", "48000", "-ac", "2", str(HERE / "vo.wav")], check=True)
    print(f"{len(lines)} lines, {len(caps)} captions, {total}s")

asyncio.run(main())
