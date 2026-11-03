/* Acid motion poster studies. Typography remains editable HTML. No dependencies. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const instances = new Set();
  let raf = 0;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (document.hidden) return;
    let running = false;
    instances.forEach(instance => { if (instance.tick(now)) running = true; });
    if (running) wake();
  }
  const palettes = {
    1: { bg: '#0a0d0b', chrome: [210, 219, 205], tint: [192, 255, 49] },
    2: { bg: '#20113b', chrome: [222, 220, 246], tint: [111, 247, 237] },
    3: { bg: '#e9eadc', chrome: [30, 35, 27], tint: [181, 235, 31] },
    4: { bg: '#100d12', chrome: [222, 219, 227], tint: [255, 73, 177] },
    5: { bg: '#1738d7', chrome: [255, 158, 83], tint: [255, 105, 34] }
  };
  function rotate(p, rx, ry, rz) {
    let [x, y, z] = p;
    let ny = y * Math.cos(rx) - z * Math.sin(rx);
    z = y * Math.sin(rx) + z * Math.cos(rx); y = ny;
    let nx = x * Math.cos(ry) + z * Math.sin(ry);
    z = -x * Math.sin(ry) + z * Math.cos(ry); x = nx;
    nx = x * Math.cos(rz) - y * Math.sin(rz);
    y = x * Math.sin(rz) + y * Math.cos(rz);
    return [nx, y, z];
  }
  class AcidPoster {
    constructor(element, options = {}) {
      if (!element) throw new Error('AcidPoster requires a poster element.');
      if (element.acidPoster) return element.acidPoster;
      this.element = element;
      this.mode = clamp(Math.round(Number(options.mode || element.dataset.acidMode) || 1), 1, 5);
      this.canvas = element.querySelector('.acid-canvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'acid-canvas';
        element.prepend(this.canvas);
      }
      this.canvas.setAttribute('aria-hidden', 'true');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      if (!this.ctx) return;
      this.mini = element.classList.contains('acid-mini');
      this.paused = !!options.paused;
      element.dataset.acidPaused = String(this.paused);
      this.visible = true;
      this.phase = Number(options.phase) || this.mode * .31;
      this.x = this.y = this.targetX = this.targetY = this.energy = 0;
      this.last = 0; this.lastDraw = 0; this.dirty = true; this.destroyed = false;
      this.handlers = [];
      element.dataset.acidMode = String(this.mode);
      element.acidPoster = this;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(element);
      this.visibilityObserver = new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        this.last = 0;
        if (this.visible) { this.dirty = true; wake(); }
      }, { rootMargin: '60px 0px' });
      this.visibilityObserver.observe(element);
      this.listen('pointermove', event => {
        const b = element.getBoundingClientRect();
        this.targetX = clamp((event.clientX - b.left) / b.width * 2 - 1, -1, 1);
        this.targetY = clamp((event.clientY - b.top) / b.height * 2 - 1, -1, 1);
        if (this.dragging) this.energy = Math.min(.85, this.energy + .035);
        this.dirty = true; wake();
      });
      this.listen('pointerleave', () => {
        this.targetX = this.targetY = 0; this.dragging = false; this.dirty = true; wake();
      });
      this.listen('pointerdown', event => {
        if (event.target.closest('button,a,input,select,textarea')) return;
        this.dragging = true; this.energy = .85; this.dirty = true; wake();
      });
      this.listen('pointerup', () => { this.dragging = false; });
      this.listen('pointercancel', () => { this.dragging = false; });
      this.listen('keydown', event => {
        if (event.target.closest('button,a,input,select,textarea')) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); this.energy = .85; this.dirty = true; wake();
        }
      });
      this.resize();
      instances.add(this); wake();
    }
    listen(name, fn) { this.element.addEventListener(name, fn); this.handlers.push([name, fn]); }
    resize() {
      if (this.destroyed || !this.ctx) return;
      const rect = this.element.getBoundingClientRect();
      this.w = Math.max(1, rect.width); this.h = Math.max(1, rect.height);
      this.dpr = Math.min(devicePixelRatio || 1, this.mini ? 1 : 1.7);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.dirty = true; wake();
    }
    setMode(mode) {
      this.mode = clamp(Math.round(Number(mode) || 1), 1, 5);
      this.element.dataset.acidMode = String(this.mode);
      this.energy = .5; this.dirty = true; this.last = 0; wake(); return this;
    }
    setPaused(paused) {
      this.paused = !!paused;
      if (this.paused) this.energy = 0;
      this.element.dataset.acidPaused = String(this.paused);
      this.last = 0; this.dirty = true; wake(); return this;
    }
    destroy() {
      this.destroyed = true;
      this.resizeObserver.disconnect(); this.visibilityObserver.disconnect();
      this.handlers.forEach(([name, fn]) => this.element.removeEventListener(name, fn));
      delete this.element.acidPoster; instances.delete(this);
    }
    tick(now) {
      if (!this.visible || this.destroyed || !this.ctx) return false;
      const moving = !this.paused && !motionPreference.matches;
      const unsettled = Math.abs(this.targetX - this.x) + Math.abs(this.targetY - this.y) > .001 || this.energy > .002;
      if (!moving && !unsettled && !this.dirty) return false;
      const interval = this.mini ? 90 : 33;
      if (now - this.lastDraw < interval) return true;
      const dt = this.last ? Math.min(.12, (now - this.last) / 1000) : .033;
      this.last = now; this.lastDraw = now;
      if (moving) this.phase += dt * .31;
      const easing = 1 - Math.exp(-dt * 5);
      this.x += (this.targetX - this.x) * easing;
      this.y += (this.targetY - this.y) * easing;
      this.energy *= Math.exp(-dt * 2.2);
      if (motionPreference.matches) { this.energy = 0; this.x = this.targetX; this.y = this.targetY; }
      this.applyType(); this.draw(); this.dirty = false;
      return moving || unsettled;
    }
    applyType() {
      const el = this.element, t = this.phase;
      el.style.setProperty('--acid-px', this.x.toFixed(4));
      el.style.setProperty('--acid-py', this.y.toFixed(4));
      el.style.setProperty('--acid-drift', Math.sin(t * .7).toFixed(4));
      el.style.setProperty('--acid-turn', Math.cos(t * .43).toFixed(4));
      el.style.setProperty('--acid-breathe', (1 + Math.sin(t * .65) * .018).toFixed(4));
      el.style.setProperty('--acid-pulse', this.energy.toFixed(4));
    }
    mesh(form, opts) {
      const g = this.ctx, w = this.w, h = this.h;
      const U = this.mini ? (opts.uMini || 44) : (opts.u || 96);
      const V = this.mini ? (opts.vMini || 12) : (opts.v || 24);
      const vertices = [], faces = [];
      const scale = Math.min(w, h) * opts.scale;
      const cx = w * opts.cx, cy = h * opts.cy;
      for (let i = 0; i <= U; i++) {
        const row = [];
        for (let j = 0; j <= V; j++) {
          const p = rotate(form(i / U, j / V), opts.rx, opts.ry, opts.rz);
          const projection = 4 / (4 - p[2]);
          row.push({ x: cx + p[0] * scale * projection, y: cy + p[1] * scale * projection, p });
        }
        vertices.push(row);
      }
      for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
        const a = vertices[i][j], b = vertices[i + 1][j], c = vertices[i + 1][j + 1], d = vertices[i][j + 1];
        const u = b.p.map((n, k) => n - a.p[k]), v = d.p.map((n, k) => n - a.p[k]);
        let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
        const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
        const light = Math.abs(nx * -.35 + ny * -.57 + nz * .74);
        const sharp = Math.pow(Math.abs(nx * .12 + ny * -.2 + nz * .97), 17);
        const bands = .5 + .5 * Math.sin(nz * 9 + ny * 3 + this.phase * .26);
        const intensity = .12 + light * .5 + bands * .29 + sharp * .6;
        const rim = Math.pow(1 - Math.abs(nz), 2);
        const base = opts.chrome, tint = opts.tint;
        const col = base.map((n, k) => clamp(Math.round(n * intensity + tint[k] * rim * .24), 0, 255));
        faces.push({ points: [a, b, c, d], z: (a.p[2] + b.p[2] + c.p[2] + d.p[2]) / 4, color: `rgb(${col.join(',')})` });
      }
      faces.sort((a, b) => a.z - b.z);
      g.lineWidth = .55;
      for (const face of faces) {
        g.beginPath(); face.points.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
        g.fillStyle = g.strokeStyle = face.color; g.fill(); g.stroke();
      }
    }
    draw() {
      const g = this.ctx, w = this.w, h = this.h, t = this.phase, x = this.x, y = this.y, e = this.energy;
      const palette = palettes[this.mode];
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = palette.bg; g.fillRect(0, 0, w, h);
      if (this.mode === 1) this.orbit(t, x, y, e);
      if (this.mode === 2) this.bloom(t, x, y, e);
      if (this.mode === 3) this.optical(t, x, y, e);
      if (this.mode === 4) this.thorns(t, x, y, e);
      if (this.mode === 5) this.ribbons(t, x, y, e);
      this.grain();
    }
    orbit(t, x, y, e) {
      const g = this.ctx, w = this.w, h = this.h, size = Math.min(w, h);
      const halo = g.createRadialGradient(w * .57, h * .5, size * .05, w * .57, h * .5, size * .55);
      halo.addColorStop(0, '#c5ff2919'); halo.addColorStop(1, '#c5ff2900');
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w * .52, h * .51); g.rotate(-.35 + t * .08);
      g.strokeStyle = '#d2ff5a50'; g.lineWidth = .65;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, 0, size * (.48 + i * .014), size * (.13 + i * .018), 0, 0, TAU); g.stroke(); }
      g.restore();
      this.mesh((a, b) => {
        const u = a * TAU, v = b * TAU;
        const spike = Math.pow(Math.max(0, Math.cos(u * 12 + t * .12)), 18);
        const tube = .12 + spike * (.22 + e * .06);
        const major = .70 + Math.sin(u * 3 - t * .2) * .035;
        return [(major + tube * Math.cos(v)) * Math.cos(u), (major + tube * Math.cos(v)) * Math.sin(u), tube * Math.sin(v) + .085 * Math.sin(u * 3 + t * .2)];
      }, { scale: .49, cx: .53 + x * .025, cy: .50 + y * .015, rx: .9 + y * .2, ry: -.25 + t * .15 + x * .28, rz: -.42, chrome: [215, 224, 214], tint: [173, 255, 38], u: 132, v: 22 });
    }
    bloom(t, x, y, e) {
      const g = this.ctx, w = this.w, h = this.h, size = Math.min(w, h);
      const light = g.createRadialGradient(w * .53, h * .43, 0, w * .53, h * .43, size * .65);
      light.addColorStop(0, '#c2c0ff46'); light.addColorStop(.5, '#6838a724'); light.addColorStop(1, '#25113c00');
      g.fillStyle = light; g.fillRect(0, 0, w, h);
      this.mesh((a, b) => {
        const u = a * TAU, v = b * Math.PI;
        const petal = Math.sin(v) * Math.cos(u * 5 + t * .18);
        const r = .72 + .18 * petal + .06 * Math.cos(v * 5 + t * .3) + e * .04 * Math.sin(u * 8);
        return [r * Math.sin(v) * Math.cos(u), r * Math.sin(v) * Math.sin(u), r * Math.cos(v) * .56 + .1 * Math.sin(u * 5) * Math.sin(v)];
      }, { scale: .61, cx: .57 + x * .035, cy: .44 + y * .025, rx: .7 + y * .2, ry: -.3 + x * .25, rz: -.5 + t * .1, chrome: [209, 198, 244], tint: [104, 255, 232], u: 112, v: 34, vMini: 16 });
      g.save(); g.translate(w * .57, h * .44); g.rotate(t * .06);
      g.strokeStyle = '#a0f7ea77'; g.lineWidth = .75; g.setLineDash([size * .008, size * .018]);
      g.beginPath(); g.ellipse(0, 0, size * .52, size * .52, 0, .15, TAU - .45); g.stroke();
      g.restore();
    }
    optical(t, x, y, e) {
      const g = this.ctx, w = this.w, h = this.h, size = Math.min(w, h);
      g.fillStyle = '#b9ea29'; g.fillRect(w * .48, h * .13, w * .52, h * .68);
      g.save(); g.translate(w * (.56 + x * .025), h * (.49 + y * .02)); g.rotate(-.26 + Math.sin(t * .12) * .07);
      const lines = this.mini ? 60 : 105;
      for (let k = 0; k < lines; k++) {
        const r = size * (.055 + k / lines * .68);
        g.beginPath();
        for (let j = 0; j <= 170; j++) {
          const a = j / 170 * TAU;
          const wave = size * (.032 + e * .01) * Math.sin(a * 3 + k * .035 + t * .35);
          const px = Math.cos(a) * (r + wave), py = Math.sin(a) * (r * .69 + wave) + size * .065 * Math.sin(a * 2 + t * .25);
          j ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.strokeStyle = k % 3 === 0 ? '#10170df0' : '#172012c9'; g.lineWidth = k % 3 === 0 ? 1.1 : .55; g.stroke();
      }
      g.restore();
      // A second quiet line field gives the optical interference its offset structure.
      g.save(); g.translate(w * .56, h * .49); g.rotate(.08 + x * .015);
      g.strokeStyle = '#e9eadc88'; g.lineWidth = .7;
      for (let i = -35; i < 36; i++) { g.beginPath(); const z = i * size * .013; g.moveTo(-size, z); g.bezierCurveTo(-size * .2, z + size * .12, size * .3, z - size * .12, size, z); g.stroke(); }
      g.restore();
    }
    thorns(t, x, y, e) {
      const g = this.ctx, w = this.w, h = this.h, size = Math.min(w, h);
      const glow = g.createRadialGradient(w * .57, h * .52, 0, w * .57, h * .52, size * .65);
      glow.addColorStop(0, '#ff2b9f22'); glow.addColorStop(1, '#ff2b9f00'); g.fillStyle = glow; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w * (.57 + x * .025), h * (.50 + y * .02)); g.rotate(-.18 + Math.sin(t * .3) * .07 + x * .11); g.scale(size * .48, size * .48);
      for (let layer = 0; layer < 2; layer++) for (let k = 0; k < 6; k++) {
        g.save(); g.rotate(k / 6 * TAU + layer * .45 + t * .025 * (layer ? -1 : 1));
        const extension = .92 + Math.sin(t * .35 + k) * .025 + e * .03;
        const path = new Path2D();
        path.moveTo(-.12, .23); path.bezierCurveTo(-.3, -.04, -.49, -.23, -.33, -.62);
        path.bezierCurveTo(-.29, -.43, -.18, -.33, .015, -extension);
        path.bezierCurveTo(.08, -.43, .36, -.47, .50, -.60);
        path.bezierCurveTo(.33, -.18, .12, -.14, .10, .24);
        path.bezierCurveTo(.06, .13, .015, .05, -.12, .23); path.closePath();
        const gradient = g.createLinearGradient(-.3 + x * .05, 0, .24 + x * .05, 0);
        gradient.addColorStop(0, '#261c2d'); gradient.addColorStop(.19, '#d8d3e4'); gradient.addColorStop(.28, '#777183'); gradient.addColorStop(.43, '#16101e'); gradient.addColorStop(.56, '#f6edf6'); gradient.addColorStop(.66, '#4a3e52'); gradient.addColorStop(.88, '#9b86a6'); gradient.addColorStop(1, '#ff59b5');
        g.fillStyle = gradient; g.fill(path); g.strokeStyle = layer ? '#d2afdb80' : '#f46ab6a0'; g.lineWidth = .0025; g.stroke(path);
        g.beginPath(); g.moveTo(.015, -extension); g.bezierCurveTo(-.03, -.4, -.2, -.14, -.10, .17); g.strokeStyle = '#fff3ff90'; g.lineWidth = .003; g.stroke();
        g.restore();
      }
      g.restore();
    }
    ribbons(t, x, y, e) {
      const g = this.ctx, w = this.w, h = this.h;
      const shade = g.createLinearGradient(0, 0, w, h); shade.addColorStop(0, '#091c9a'); shade.addColorStop(.5, '#163fe6'); shade.addColorStop(1, '#1a31bd'); g.fillStyle = shade; g.fillRect(0, 0, w, h);
      const ribbon = (a, b) => {
        const u = a, v = b * 2 - 1, twist = u * Math.PI * 3.3 + t * .23;
        return [(u - .5) * 2.4, .22 * Math.sin(u * TAU - t * .25) + v * .18 * Math.cos(twist), v * .18 * Math.sin(twist) + e * .025 * Math.sin(u * 10)];
      };
      this.mesh(ribbon, { scale: .64, cx: .50 + x * .025, cy: .44 + y * .025, rx: .05 + y * .2, ry: x * .16, rz: -.60 + Math.sin(t * .17) * .06, chrome: [255, 150, 87], tint: [255, 132, 36], u: 130, v: 14, vMini: 8 });
      this.mesh((a, b) => { const p = ribbon(a, b); return [p[0] * 1.08, p[1] * .65 + .34, p[2] * .65 - .1]; }, { scale: .58, cx: .52 - x * .02, cy: .58 - y * .02, rx: -.1, ry: -.15, rz: -.60, chrome: [230, 236, 238], tint: [124, 190, 255], u: 100, v: 10, vMini: 6 });
    }
    grain() {
      const g = this.ctx, w = this.w, h = this.h;
      g.save(); g.globalAlpha = this.mode === 3 ? .08 : .035; g.fillStyle = this.mode === 3 ? '#1b2512' : '#ffffff';
      const step = this.mini ? 23 : 19;
      for (let y = 6; y < h; y += step) for (let x = 7; x < w; x += step) {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        if (n - Math.floor(n) > .78) g.fillRect(x + n % 7, y + n % 5, .75, .75);
      }
      g.restore();
    }
    static initAll(scope = document) {
      const elements = [...scope.querySelectorAll('.acid-poster[data-acid-mode]')];
      if (scope.matches && scope.matches('.acid-poster[data-acid-mode]')) elements.unshift(scope);
      return elements.map(element => element.acidPoster || new AcidPoster(element));
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
    else { instances.forEach(instance => { instance.last = 0; }); wake(); }
  });
  motionPreference.addEventListener('change', () => { instances.forEach(instance => { instance.last = 0; instance.dirty = true; }); wake(); });
  window.AcidPoster = AcidPoster;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => AcidPoster.initAll(), { once: true });
  else AcidPoster.initAll();
})();
