// Dump the page's sound-effect cues and scene starts (used by audio.py).
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(__dirname, 'doc.html') + '?render=1'); await p.evaluate(() => window.__ready);
  console.log(JSON.stringify(await p.evaluate(() => ({ sfx: window.__sfx, sections: window.__sections, dur: window.__duration }))));
  await b.close();
})();
