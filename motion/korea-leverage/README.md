# 韩国年轻人五倍杠杆：动画

> **以完整版为准**：`full/` 里是核实后的完整版（约 5 分 48 秒，带旁白和字幕）。
> 核实记录与来源见 [`full/FACTCHECK.md`](full/FACTCHECK.md)。下面两支早期短片仍按原稿数字制作，其中几处已经证实有误（如“倒欠券商”“散户一月买 40 万亿”“14 年攒首付”）。

## 完整版

| 文件 | 说明 |
|---|---|
| `full/out/korea_leverage_full.mp4` | 成片：1080p30，Vox 纸艺风格加数据插图，烧录中文字幕，AI 临时配音 |
| `full/narration.json` | 逐句旁白（已核实）。改词后运行 `build_vo.py`，配音、时间轴和字幕会一起重算 |
| `full/captions.srt` | 字幕 |
| `full/vo.m4a` | 旁白音轨 |
| `full/full.html` | 动画源文件；所有动作都按旁白里的句子和关键词对齐 |

```bash
cd full && SSL_CERT_FILE=<CA 证书> FFMPEG=ffmpeg python3 build_vo.py   # 生成配音和时间轴（需要 pip install edge-tts）
cd .. && NODE_PATH=$(npm root -g) node render.cjs full/full.html full/out/video.mp4 30
ffmpeg -i full/out/video.mp4 -i full/vo.m4a -c:v copy -c:a aac -shortest full/out/korea_leverage_full.mp4
```

## 早期短片（未核实版）

| 文件 | 风格 | 时长 |
|---|---|---|
| `vox.html` → `out/vox_korea_leverage.mp4` | Vox 式纸艺拼贴解说（paper cut-out explainer） | 2:03 |
| `newsroom.html` → `out/newsroom_korea_leverage.mp4` | 通讯社 / 报纸图表部式数据动画 | 1:37 |

两支片子都是 1920×1080、30fps，**无配音、无音乐**：画面节拍按稿件五个环节排好，下面的分镜表给出每段对应的台词，配音时可直接对轨；需要拉长时，在每场末尾多停几秒即可。

## 预览与导出

- **预览**：直接用浏览器打开 `vox.html` / `newsroom.html`。空格键播放/暂停，←/→ 键前后跳 1 秒，底部滑条可拖动。
- **导出**：每一帧都是时间 `t` 的纯函数，导出时逐帧截图再编码，不存在掉帧或时序漂移。

```bash
# 需要 Node + Playwright（Chromium）和 ffmpeg
NODE_PATH=$(npm root -g) node render.cjs vox.html out/vox_korea_leverage.mp4 30
NODE_PATH=$(npm root -g) node render.cjs newsroom.html out/newsroom_korea_leverage.mp4 30
# 只导出一段，例如 56–66 秒：
NODE_PATH=$(npm root -g) node render.cjs vox.html out/s5.mp4 30 56 66
```

- **改文字后**：如果新增了汉字，需要重新生成字体子集（Noto Serif SC / Noto Sans SC / Noto Sans KR / Barlow Condensed / IBM Plex Mono，均为 OFL 开源字体，从 Google Fonts 下载 TTF 到一个目录）：
  `python3 build_fonts.py <字体目录>`

## 文件结构

- `engine.js`：确定性时间轴、纸张纹理、胶片颗粒、手绘笔触（抖动线、笔圈）、撕纸边缘、播放器
- `base.css`：画布与播放器样式
- `fonts.css`：自动生成的字体子集（内嵌 base64，离线可用）
- `STORYBOARD.md`：分镜、对白对轨表、去“AI 感”的做法、事实核查清单
