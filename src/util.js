// Общие помощники: случайные числа, шум для рельефа, кэш материалов, слияние геометрии.
window.G = window.G || {};
(function (G) {
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.smooth = (e0, e1, x) => {
    const t = G.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  G.angleLerp = (a, b, t) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  G.dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

  // Детерминированный генератор, чтобы мир всегда был одинаковым (важно для сохранений).
  G.seeded = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function hash(ix, iz) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  G.noise2 = function (x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
    return G.lerp(G.lerp(a, b, ux), G.lerp(c, d, ux), uz);
  };
  G.fbm = function (x, z) {
    let s = 0, amp = 0.5, f = 1;
    for (let i = 0; i < 4; i++) {
      s += amp * G.noise2(x * f, z * f);
      f *= 2.03;
      amp *= 0.5;
    }
    return s / 0.9375;
  };

  const matCache = {};
  G.mat = function (color, extra) {
    const key = color + '|' + (extra ? JSON.stringify(extra) : '');
    if (!matCache[key]) matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
    return matCache[key];
  };
  const boxCache = {};
  G.box = function (w, h, d, color) {
    const k = w + 'x' + h + 'x' + d;
    if (!boxCache[k]) boxCache[k] = new THREE.BoxGeometry(w, h, d);
    return new THREE.Mesh(boxCache[k], G.mat(color));
  };

  // Сливает несколько геометрий в одну с цветами вершин — меньше вызовов отрисовки.
  G.mergeGeos = function (parts) {
    const pos = [], nor = [], col = [];
    const c = new THREE.Color();
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (p.matrix) g.applyMatrix4(p.matrix);
      const pa = g.attributes.position.array, na = g.attributes.normal.array;
      c.set(p.color);
      for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
      for (let i = 0; i < pa.length / 3; i++) col.push(c.r, c.g, c.b);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  };

  G.textSprite = function (text, color, size) {
    color = color || '#ffe9a8';
    size = size || 1;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = 'bold 44px Georgia, serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 40;
    c.width = w;
    c.height = 72;
    ctx.font = font;
    ctx.fillStyle = 'rgba(30,20,10,0.78)';
    ctx.fillRect(0, 0, w, 72);
    ctx.strokeStyle = '#c79a3c';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, 68);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 38);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false }));
    s.scale.set((w / 72) * 1.1 * size, 1.1 * size, 1);
    return s;
  };
})(window.G);
