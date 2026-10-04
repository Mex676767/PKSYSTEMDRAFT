/* Deterministic motion engine.
   Every frame is a pure function of time t (seconds), so the same page works as a
   live preview (open the HTML) and as a frame-exact video source (render.cjs calls
   window.__seek(t) once per frame and screenshots the stage). */
(function () {
  const W = 1920, H = 1080;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = {
    lin: k => k,
    out: k => 1 - Math.pow(1 - k, 3),
    out5: k => 1 - Math.pow(1 - k, 5),
    in: k => k * k * k,
    in2: k => k * k,
    inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    sine: k => -(Math.cos(Math.PI * k) - 1) / 2,
    back: k => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  };
  // eased progress of t through [a, b]
  const prog = (t, a, b, e = ease.out) => e(clamp((t - a) / (b - a)));
  // 1 inside [a, b), with fades of length f on both sides
  const win = (t, a, b, f = 0.3) => Math.min(prog(t, a, a + f, ease.lin), 1 - prog(t, b - f, b, ease.lin));

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let x = s;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // stop-motion stepping: animate "on twos" (12 fps) instead of buttery 60
  const step = (t, fps = 12) => Math.floor(t * fps);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const $ = id => document.getElementById(id);

  function tf(el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o } = {}) {
    el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx ?? s},${sy ?? s})`;
    if (o !== undefined) el.style.opacity = o;
  }
  const show = (el, on) => { el.style.visibility = on ? 'visible' : 'hidden'; };

  /* ---------- hand-made marks ---------- */

  // jittered polyline through pts, smoothed with quadratic midpoints
  function wobble(pts, seed, amp = 3, seg = 28) {
    const r = rng(seed), out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / seg));
      const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
      for (let j = 0; j < n; j++) {
        const k = j / n, d = (r() - 0.5) * 2 * amp;
        out.push([lerp(x0, x1, k) + nx * d, lerp(y0, y1, k) + ny * d]);
      }
    }
    out.push(pts[pts.length - 1]);
    return smooth(out);
  }
  function smooth(p) {
    if (p.length < 3) return `M${p.map(q => q.join(',')).join('L')}`;
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      d += `Q${p[i][0].toFixed(1)},${p[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    const l = p[p.length - 1];
    return d + `L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
  }
  // a pen circle: a bit more than one turn, radius drifting, never closes cleanly
  function penCircle(cx, cy, rx, ry, seed, turns = 1.12) {
    const r = rng(seed), pts = [], n = 34, a0 = -2.2 + r() * 0.6;
    let drift = 0;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 * turns;
      drift += (r() - 0.5) * 0.035;
      const k = 1 + drift + (i / n) * 0.06;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smooth(pts);
  }
  // torn-paper clip-path for a w x h card
  function torn(w, h, seed, amp = 4, gap = 14, edges = 'tlbr') {
    const r = rng(seed), p = [];
    const j = e => (edges.includes(e) ? (r() - 0.5) * 2 * amp : 0);
    for (let x = 0; x < w; x += gap) p.push([x, Math.max(0, j('t') + amp * edges.includes('t'))]);
    for (let y = 0; y < h; y += gap) p.push([w - Math.max(0, j('r') + amp * edges.includes('r')), y]);
    for (let x = w; x > 0; x -= gap) p.push([x, h - Math.max(0, j('b') + amp * edges.includes('b'))]);
    for (let y = h; y > 0; y -= gap) p.push([Math.max(0, j('l') + amp * edges.includes('l')), y]);
    return `polygon(${p.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
  }
  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(parent, tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  // stroke draw-on for paths that have pathLength="1"
  function draw(path, k) {
    path.style.strokeDasharray = '1 1';
    path.style.strokeDashoffset = String(1 - clamp(k));
    path.style.opacity = k <= 0 ? 0 : 1;
  }

  /* ---------- surfaces ---------- */

  function paperTexture(base = [236, 229, 213], seed = 7, fibers = 1800) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = `rgb(${base})`;
    g.fillRect(0, 0, W, H);
    // large soft mottling
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = r() * H, rad = 120 + r() * 380;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < 0.5;
      gr.addColorStop(0, dark ? 'rgba(90,70,40,0.035)' : 'rgba(255,255,250,0.05)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // fibres
    g.lineCap = 'round';
    for (let i = 0; i < fibers; i++) {
      const x = r() * W, y = r() * H, len = 4 + r() * 22, a = r() * Math.PI;
      g.strokeStyle = r() < 0.6 ? `rgba(80,60,30,${0.04 + r() * 0.06})` : `rgba(255,255,255,${0.1 + r() * 0.15})`;
      g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    // fine tooth
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 14;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.9);
  }

  function grainFrames(n = 6, seed = 99, w = 960, h = 540) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d'), r = rng(seed), frames = [];
    for (let f = 0; f < n; f++) {
      const img = g.createImageData(w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = r() * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      frames.push(img);
    }
    return frames;
  }

  /* ---------- player ---------- */

  function mount({ duration, render, grain = 0.08, weave = 0.7, dust = true, flicker = 0.025, chapters = [] }) {
    const stage = $('stage'), world = $('world');
    const params = new URLSearchParams(location.search);
    const renderMode = params.has('render');
    document.body.classList.toggle('render', renderMode);

    const gc = document.createElement('canvas');
    gc.width = 960; gc.height = 540;
    gc.className = 'fx-grain';
    gc.style.opacity = grain;
    const gctx = gc.getContext('2d');
    const frames = grain > 0 ? grainFrames() : [];
    const vign = document.createElement('div');
    vign.className = 'fx-vignette';
    const flick = document.createElement('div');
    flick.className = 'fx-flicker';
    const dustSvg = document.createElementNS(NS, 'svg');
    dustSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    dustSvg.setAttribute('class', 'fx-dust');
    stage.append(vign, flick, gc, dustSvg);

    function frame(t) {
      t = clamp(t, 0, duration - 1e-4);
      render(t);
      const s = step(t, 12);
      if (weave) world.style.transform = `translate(${((hash(s) - 0.5) * 2 * weave).toFixed(2)}px,${((hash(s + 91) - 0.5) * 2 * weave).toFixed(2)}px)`;
      if (frames.length) gctx.putImageData(frames[step(t, 24) % frames.length], 0, 0);
      flick.style.opacity = (hash(step(t, 24) * 3.1) * flicker).toFixed(3);
      if (dust) {
        // a speck or a hair now and then, held for two frames
        const k = step(t, 12);
        dustSvg.innerHTML = '';
        if (hash(k * 7.7) < 0.22) {
          const x = hash(k * 1.3) * W, y = hash(k * 2.9) * H;
          if (hash(k * 5.1) < 0.7) svgEl(dustSvg, 'circle', { cx: x, cy: y, r: 0.8 + hash(k) * 1.8, fill: 'rgba(20,18,15,.55)' });
          else svgEl(dustSvg, 'path', { d: wobble([[x, y], [x + 18 + hash(k) * 30, y + (hash(k * 3) - 0.5) * 40]], k, 4, 8), stroke: 'rgba(20,18,15,.35)', 'stroke-width': 1.1, fill: 'none' });
        }
      }
      cur = t;
      if (!renderMode) {
        scrub.value = t;
        clock.textContent = `${t.toFixed(1)}s / ${duration}s` + chapterAt(t);
      }
    }
    const chapterAt = t => { let c = ''; for (const [a, name] of chapters) if (t >= a) c = '  ·  ' + name; return c; };

    let cur = 0, playing = !renderMode, last = 0, scrub, clock, btn;
    if (!renderMode) {
      const bar = document.createElement('div');
      bar.className = 'player';
      bar.innerHTML = `<button type="button" aria-label="Play or pause">❚❚</button><input type="range" min="0" max="${duration}" step="0.01" value="0" aria-label="Timeline"><span></span>`;
      document.body.appendChild(bar);
      [btn, scrub, clock] = bar.children;
      const toggle = () => { playing = !playing; btn.textContent = playing ? '❚❚' : '▶'; if (playing && cur >= duration - 0.05) cur = 0; };
      btn.onclick = toggle;
      scrub.oninput = () => { frame(+scrub.value); };
      addEventListener('keydown', e => {
        if (e.code === 'Space') { e.preventDefault(); toggle(); }
        if (e.code === 'ArrowRight') frame(cur + 1);
        if (e.code === 'ArrowLeft') frame(cur - 1);
      });
      const fit = () => {
        const s = Math.min(innerWidth / W, (innerHeight - 56) / H);
        stage.style.transform = `scale(${s})`;
        stage.style.left = `${(innerWidth - W * s) / 2}px`;
        stage.style.top = `${Math.max(0, (innerHeight - 56 - H * s) / 2)}px`;
      };
      addEventListener('resize', fit);
      fit();
      const loop = now => {
        if (playing) {
          const dt = last ? (now - last) / 1000 : 0;
          frame(cur + dt);
          if (cur >= duration - 0.05) { playing = false; btn.textContent = '▶'; }
        }
        last = now;
        requestAnimationFrame(loop);
      };
      document.fonts.ready.then(() => { frame(0); requestAnimationFrame(loop); });
    }
    window.__duration = duration;
    window.__seek = frame;
    window.__ready = document.fonts.ready.then(() => { frame(0); return true; });
  }

  window.E = { W, H, clamp, lerp, ease, prog, win, rng, hash, step, fmt, $, tf, show, wobble, smooth, penCircle, torn, svgEl, draw, paperTexture, mount };
})();
