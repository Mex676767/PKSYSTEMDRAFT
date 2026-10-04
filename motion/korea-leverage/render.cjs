// Frame-exact export: seeks the page to each frame time, screenshots the 1920x1080
// stage and pipes the frames into ffmpeg (H.264, yuv420p, 30 fps).
//
//   NODE_PATH=$(npm root -g) node render.cjs vox.html out/vox.mp4 [fps] [from] [to]
//
// FFMPEG env var overrides the ffmpeg binary (e.g. the one from `pip install imageio-ffmpeg`).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const [page_, out, fpsArg = '30', fromArg, toArg] = process.argv.slice(2);
  const fps = +fpsArg;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, page_) + '?render=1');
  await page.evaluate(() => window.__ready);
  const duration = await page.evaluate(() => window.__duration);
  const from = fromArg ? +fromArg : 0, to = toArg ? +toArg : duration;
  const total = Math.round((to - from) * fps);

  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = from + i / fps;
    await page.evaluate(t => window.__seek(t), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % (fps * 10) === 0) console.log(`${path.basename(out)}  ${t.toFixed(1)}s / ${to}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log(`done: ${out} (${total} frames)`);
})();
