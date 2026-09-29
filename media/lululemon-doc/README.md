# 《最优解笔记》Lululemon 纪录片：build pipeline

A narrated 1080p Chinese explainer video (about 12 minutes) on Lululemon's Get Low controversy, its fiscal 2026 Q2 results, competition from Alo, and the company's leadership changes. Everything is generated from code: TTS narration, Ken Burns photo moves, data charts, lower-thirds, burned-in subtitles and an ambient music bed.

## Files

- `narration.py`: the script, split into scenes and lines. Use `显示文本|朗读文本` when the spoken form must differ from the subtitle (numbers, English names).
- `tts.py`, `tts_lib.py`: offline narration using Kokoro v1.1-zh (voice `zf_002`) with a small phoneme table for English names.
- `scenes.py`: one painter function per scene.
- `gfx.py`: text sprites, shapes and Ken Burns helpers built on PIL.
- `build.py`: builds the timeline from narration lengths, renders frames in parallel into ffmpeg, mixes the audio and muxes the final MP4.
- `assets/`: the creator-supplied images (`1`–`5`); `assets/ref/` holds frames extracted from the supplied screen recording (not committed).
- `web/credits.json`: the Wikimedia Commons photos used, with author and license. The image files themselves are not committed; download them into `../web/` by the keys listed there.

## Build

```sh
python tts.py                # -> audio/*.wav, lines.json
python build.py info         # print the scene timeline
python build.py preview      # stills in out/preview/
python build.py srt          # out/subtitles.srt
python build.py render       # out/lululemon_doc.mp4
```

Requires Python with `kokoro-onnx`, `misaki[zh]`, `soundfile`, `pillow`, `numpy`, plus `ffmpeg` on PATH. The fonts are Noto Sans SC and Noto Serif SC, placed in `../fonts/`. The Kokoro model files `kokoro-v1.1-zh.onnx`, `voices-v1.1-zh.bin` and `config-zh.json` go in `../voices/`.

The figures come from the script: Lululemon's fiscal 2026 Q2 report and Tmall's published launch data. The video is for information only and is not investment advice.
