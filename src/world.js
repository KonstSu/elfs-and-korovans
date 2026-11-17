// Мир: рельеф, 4 зоны, дороги, постройки (дворец, старый форт, деревня эльфов, город людей).
(function (G) {
  const W = (G.World = {});
  W.HALF = 350;
  W.ZONES = {
    town: { id: 'town', x: 0, z: 210, r: 70, flat: 1.5, name: 'Зона людей (нейтрал)' },
    palace: { id: 'palace', x: 230, z: -30, r: 85, flat: 3, name: 'Зона императора' },
    elves: { id: 'elves', x: -220, z: -30, r: 135, flat: null, name: 'Лес эльфов' },
    fort: { id: 'fort', x: 0, z: -250, r: 58, flat: 46, name: 'Горы Злого (старый форт)' },
  };
  W.VILLAGE = { x: -220, z: -30, r: 34, flat: 1 };
  W.ROADS = [
    [[0, 210], [-40, 90], [20, 10], [120, -25], [178, -30], [230, -30]], // путь корованов
    [[-40, 90], [-130, 40], [-220, -30]],
    [[20, 10], [15, -120], [0, -250]],
  ];
  W.colliders = [];

  function rawHeight(x, z) {
    let h = G.fbm(x * 0.012, z * 0.012) * 10 - 3;
    const m = G.smooth(-110, -230, z); // горы на севере
    h += m * (30 + G.fbm(x * 0.02 + 50, z * 0.02) * 55);
    const e = Math.max(Math.abs(x), Math.abs(z));
    h += G.smooth(300, 345, e) * 40; // край карты
    return h;
  }

  W.height = function (x, z) {
    let h = rawHeight(x, z);
    for (const k in W.ZONES) {
      const zn = W.ZONES[k];
      if (zn.flat == null) continue;
      const d = Math.hypot(x - zn.x, z - zn.z);
      if (d < zn.r) h = G.lerp(h, zn.flat, G.smooth(zn.r, zn.r * 0.6, d));
    }
    const v = W.VILLAGE;
    const dv = Math.hypot(x - v.x, z - v.z);
    if (dv < v.r * 1.6) h = G.lerp(h, v.flat, G.smooth(v.r * 1.6, v.r, dv));
    return h;
  };

  function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const t = G.clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  }
  W.distToRoad = function (x, z) {
    let m = 1e9;
    for (const r of W.ROADS) {
      for (let i = 0; i < r.length - 1; i++) m = Math.min(m, segDist(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]));
    }
    return m;
  };
  W.zoneAt = function (x, z) {
    for (const k in W.ZONES) {
      const zn = W.ZONES[k];
      if (Math.hypot(x - zn.x, z - zn.z) < zn.r * 1.2) return zn;
    }
    return null;
  };
  W.insideCollider = function (x, z, pad) {
    pad = pad || 0;
    for (const c of W.colliders) {
      if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  };

  // Цвет земли (используется и для рельефа, и для мини-карты).
  W.groundColor = function (x, z, h) {
    let r = 0.36, g = 0.56, b = 0.24;
    const E = W.ZONES.elves;
    const f = G.smooth(165, 110, Math.hypot(x - E.x, z - E.z));
    r = G.lerp(r, 0.17, f); g = G.lerp(g, 0.37, f); b = G.lerp(b, 0.13, f);
    const T = W.ZONES.town;
    const t = G.smooth(60, 35, Math.hypot(x - T.x, z - T.z));
    r = G.lerp(r, 0.58, t * 0.7); g = G.lerp(g, 0.52, t * 0.7); b = G.lerp(b, 0.36, t * 0.7);
    const P = W.ZONES.palace;
    if (Math.abs(x - P.x) < 45 && Math.abs(z - P.z) < 45) { r = 0.72; g = 0.69; b = 0.6; }
    const rock = G.smooth(22, 40, h);
    r = G.lerp(r, 0.46, rock); g = G.lerp(g, 0.44, rock); b = G.lerp(b, 0.41, rock);
    const snow = G.smooth(70, 86, h);
    r = G.lerp(r, 0.93, snow); g = G.lerp(g, 0.94, snow); b = G.lerp(b, 0.97, snow);
    const road = G.smooth(4.2, 2.6, W.distToRoad(x, z));
    r = G.lerp(r, 0.5, road); g = G.lerp(g, 0.4, road); b = G.lerp(b, 0.27, road);
    const n = (G.noise2(x * 0.15, z * 0.15) - 0.5) * 0.08;
    return [r + n, g + n, b + n];
  };

  // ---------- Сбор статической геометрии в один меш ----------
  const batch = [];
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  function B(geo, x, y, z, color, ry, sx, sy, sz) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)),
      new THREE.Vector3(sx || 1, sy || 1, sz || 1)
    );
    batch.push({ geo, matrix: m, color });
  }
  function box(x, y, z, w, h, d, color, collide) {
    B(BOX, x, y + h / 2, z, color, 0, w, h, d);
    if (collide !== false) W.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h });
  }
  function cyl(x, y, z, rt, rb, h, color, seg, collide) {
    B(new THREE.CylinderGeometry(rt, rb, h, seg || 10), x, y + h / 2, z, color);
    if (collide) W.colliders.push({ minX: x - rb, maxX: x + rb, minZ: z - rb, maxZ: z + rb, top: y + h });
  }
  function cone(x, y, z, r, h, color, seg, ry) {
    B(new THREE.ConeGeometry(r, h, seg || 8), x, y + h / 2, z, color, ry);
  }
  function dome(x, y, z, r, color) {
    B(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, y, z, color);
  }
  function sign(text, x, y, z, color) {
    const s = G.textSprite(text, color);
    s.position.set(x, y, z);
    G.scene.add(s);
    return s;
  }
  function flag(x, y, z, color) {
    cyl(x, y, z, 0.08, 0.08, 4, 0x5d4037, 5);
    box(x + 0.9, y + 3, z, 1.6, 1, 0.08, color, false);
  }

  function doorFace(hx, hz, half, cx, cz, color) {
    const dx = cx - hx, dz = cz - hz;
    if (Math.abs(dx) > Math.abs(dz)) {
      const s = Math.sign(dx);
      box(hx + s * (half + 0.05), W.height(hx, hz), hz, 0.15, 2.3, 1.3, color, false);
      return { x: hx + s * (half + 1.2), z: hz };
    }
    const s = Math.sign(dz);
    box(hx, W.height(hx, hz), hz + s * (half + 0.05), 1.3, 2.3, 0.15, color, false);
    return { x: hx, z: hz + s * (half + 1.2) };
  }

  function buildPalace() {
    const Z = W.ZONES.palace, px = Z.x, pz = Z.z, y = Z.flat, S = 45, H = 7, T = 2, st = 0xd9d0bb;
    box(px, y, pz - S, 2 * S + T, H, T, st);
    box(px, y, pz + S, 2 * S + T, H, T, st);
    box(px + S, y, pz, T, H, 2 * S, st);
    const seg = S - 6;
    box(px - S, y, pz - S + seg / 2, T, H, seg, st);
    box(px - S, y, pz + S - seg / 2, T, H, seg, st);
    for (let i = -S; i <= S; i += 4) {
      box(px + i, y + H, pz - S, 1.3, 1, T + 0.2, st, false);
      box(px + i, y + H, pz + S, 1.3, 1, T + 0.2, st, false);
      box(px + S, y + H, pz + i, T + 0.2, 1, 1.3, st, false);
      if (Math.abs(i) > 7) box(px - S, y + H, pz + i, T + 0.2, 1, 1.3, st, false);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = px + sx * S, tz = pz + sz * S;
      cyl(tx, y, tz, 3.5, 3.8, 12, 0xcfc6b0, 12);
      W.colliders.push({ minX: tx - 3.8, maxX: tx + 3.8, minZ: tz - 3.8, maxZ: tz + 3.8, top: y + 12 });
      cone(tx, y + 12, tz, 4.6, 5, 0xa1302a, 12);
      flag(tx, y + 17, tz, 0xc62828);
    }
    // привратные башни
    for (const sz of [-1, 1]) {
      const tx = px - S, tz = pz + sz * 7.5;
      cyl(tx, y, tz, 2.2, 2.4, 10, 0xcfc6b0, 10, true);
      cone(tx, y + 10, tz, 3, 3.5, 0xa1302a, 10);
    }
    // главный корпус с золотым куполом
    const kx = px + 12;
    box(kx, y, pz, 26, 14, 30, 0xefe6cf);
    box(kx, y + 14, pz, 18, 4, 22, 0xe3d6b5, false);
    dome(kx, y + 18, pz, 7.5, 0xe0b030);
    cone(kx, y + 25, pz, 0.7, 4, 0xe0b030, 8);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      cyl(kx + sx * 12, y, pz + sz * 14, 1.8, 1.8, 18, 0xefe6cf, 10);
      dome(kx + sx * 12, y + 18, pz + sz * 14, 2, 0xe0b030);
    }
    box(kx - 13.1, y, pz, 0.3, 5.5, 4, 0x5d3a1a, false);
    box(kx - 15, y, pz, 4, 0.5, 7, 0xcfc6b0, false);
    for (const sz of [-8, 8]) box(kx - 13.1, y + 4, pz + sz, 0.2, 7, 2.4, 0xb71c1c, false);
    // фонтан
    cyl(px - 24, y, pz + 20, 3.2, 3.4, 0.9, 0xbdb5a0, 14, true);
    cyl(px - 24, y + 0.1, pz + 20, 2.8, 2.8, 0.85, 0x4f8fc0, 14);
    cyl(px - 24, y, pz + 20, 0.4, 0.5, 3, 0xbdb5a0, 8);
    sign('Дворец императора', px - S - 4, y + 9, pz);
  }

  function buildFort() {
    const F = W.ZONES.fort, fx = F.x, fz = F.z, y = F.flat, S = 26, H = 7, T = 2.2, st = 0x6d6760, st2 = 0x57524c;
    box(fx, y, fz - S, 2 * S + T, H, T, st);
    box(fx - S, y, fz - 13, T, H, 26, st);
    box(fx - S, y, fz + 13, T, 3.5, 26, st2); // обрушенная часть
    box(fx + S, y, fz - 14, T, H, 24, st);
    box(fx + S, y, fz + 17, T, H, 18, st);
    for (let i = 0; i < 5; i++) box(fx + S + G.rand(-1.5, 1.5), y, fz + 1 + i * 1.5, 1.2, G.rand(0.4, 1.2), 1.2, st2, false);
    const seg = S - 6;
    box(fx - 6 - seg / 2, y, fz + S, seg, H, T, st);
    box(fx + 6 + seg / 2, y, fz + S, seg, H, T, st);
    for (const [sx, sz, broken] of [[-1, -1, false], [1, -1, true], [-1, 1, false], [1, 1, false]]) {
      const tx = fx + sx * S, tz = fz + sz * S;
      const h = broken ? 5 : 10;
      cyl(tx, y, tz, 3, 3.3, h, st2, 10);
      W.colliders.push({ minX: tx - 3.3, maxX: tx + 3.3, minZ: tz - 3.3, maxZ: tz + 3.3, top: y + h });
      if (!broken) {
        cone(tx, y + h, tz, 3.8, 4, 0x2e2622, 10);
        flag(tx, y + h + 4, tz, 0x111111);
      }
    }
    box(fx, y, fz - 14, 18, 9, 10, st2);
    box(fx, y, fz - 8.95, 2.4, 3.2, 0.2, 0x2b1d14, false);
    // трон Злого
    box(fx, y, fz - 6.5, 1.8, 1, 1.4, 0x4a148c, false);
    box(fx, y, fz - 7.2, 1.8, 3, 0.3, 0x311b92, false);
    // черепа на кольях у ворот
    for (const sx of [-9, -7, 7, 9]) {
      cyl(fx + sx, y, fz + S + 4, 0.06, 0.06, 2.2, 0x4e342e, 5);
      box(fx + sx, y + 2.2, fz + S + 4, 0.35, 0.35, 0.35, 0xe8e2d0, false);
    }
    // костёр
    for (let i = 0; i < 4; i++) B(BOX, fx + 8, y + 0.15, fz + 4, 0x4e342e, i * 0.8, 1.6, 0.25, 0.25);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 7), new THREE.MeshBasicMaterial({ color: 0xff8f00 }));
    fire.position.set(fx + 8, y + 0.9, fz + 4);
    G.scene.add(fire);
    W.fire = fire;
    sign('Старый форт Злого', fx, y + 9.5, fz + S + 2, '#ff8a80');
  }

  function buildVillage() {
    const V = W.VILLAGE;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const hx = V.x + Math.cos(a) * 22, hz = V.z + Math.sin(a) * 22;
      const y = W.height(hx, hz);
      box(hx, y, hz, 6, 3.6, 6, 0x8b5a2b);
      for (const hy of [0.9, 1.9, 2.9]) box(hx, y + hy, hz, 6.1, 0.12, 6.1, 0x5d3a1a, false);
      cone(hx, y + 3.6, hz, 5.2, 3.2, 0x4e342e, 4, Math.PI / 4);
      doorFace(hx, hz, 3, V.x, V.z, 0x3e2414);
    }
    // большой дуб с площадкой
    const ox = V.x + 5, oz = V.z + 3, oy = W.height(ox, oz);
    cyl(ox, oy, oz, 1.1, 1.5, 14, 0x5b3a1e, 10, true);
    B(new THREE.IcosahedronGeometry(7, 0), ox, oy + 15, oz, 0x2e6b2a);
    B(new THREE.IcosahedronGeometry(4.5, 0), ox + 4, oy + 12, oz - 2, 0x357a30);
    cyl(ox, oy + 8, oz, 4, 4, 0.3, 0x7b5533, 12);
    box(ox + 1.6, oy, oz + 0.9, 0.5, 8, 0.1, 0x7b5533, false);
    sign('Деревня эльфов', V.x, 6, V.z + 10, '#b9f6ca');
  }

  function buildTown() {
    const T = W.ZONES.town, y = T.flat;
    const houses = [[-28, -18], [-28, 2], [28, -18], [28, 2], [28, 22], [-8, 32], [10, 32], [20, -28], [-28, 22]];
    const roofs = [0x9c3d2e, 0x7a4a2a, 0x6b3e2e, 0x8d3b2a];
    houses.forEach(([rx, rz], i) => {
      const hx = T.x + rx, hz = T.z + rz;
      box(hx, y, hz, 7, 4.5, 7, 0xe0d6c0);
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(hx + cx * 3.45, y, hz + cz * 3.45, 0.35, 4.5, 0.35, 0x4e342e, false);
      cone(hx, y + 4.5, hz, 5.7, 3.4, roofs[i % roofs.length], 4, Math.PI / 4);
      const door = doorFace(hx, hz, 3.5, T.x, T.z, 0x4e342e);
      if (i === houses.length - 1) W.house = { x: hx, z: hz, dx: door.x, dz: door.z };
    });
    // лавка
    const sx = T.x - 12, sz = T.z + 2;
    box(sx, y, sz, 4.4, 1.1, 1.2, 0x6d4c41);
    for (const [px, pz] of [[-2.1, -1.6], [2.1, -1.6], [-2.1, 0.5], [2.1, 0.5]]) box(sx + px, y, sz + pz, 0.15, 2.8, 0.15, 0x4e342e, false);
    for (let i = 0; i < 6; i++) box(sx - 2.2 + 0.4 + i * 0.73, y + 2.8, sz - 0.55, 0.73, 0.15, 2.6, i % 2 ? 0xffffff : 0xc62828, false);
    box(sx + 1, y + 1.1, sz, 0.6, 0.5, 0.6, 0x8d6e63, false);
    sign('Лавка', sx, y + 4, sz);
    // лекарь
    const hx = T.x + 14, hz = T.z - 6;
    box(hx, y, hz, 7, 4.5, 7, 0xf2efe6);
    cone(hx, y + 4.5, hz, 5.7, 3.4, 0x2e7d32, 4, Math.PI / 4);
    box(hx, y, hz + 3.55, 1.3, 2.3, 0.15, 0x4e342e, false);
    sign('Лекарь', hx, y + 6.2, hz + 4, '#b9f6ca');
    // колодец
    cyl(T.x + 3, y, T.z + 9, 1.2, 1.2, 1, 0x9e9e9e, 12, true);
    box(T.x + 3, y + 2.4, T.z + 9, 2.8, 0.2, 0.6, 0x5d4037, false);
    sign('Город людей', T.x, y + 6, T.z - 12);
    W.house.sign = sign('Продаётся дом (400)', W.house.x, y + 7.6, W.house.z, '#ffd54f');
  }

  W.setHouseOwned = function (owned) {
    const h = W.house;
    if (!h) return;
    if (h.sign) G.scene.remove(h.sign);
    h.sign = sign(owned ? 'Ваш дом' : 'Продаётся дом (400)', h.x, W.ZONES.town.flat + 7.6, h.z, owned ? '#b9f6ca' : '#ffd54f');
  };

  function buildTerrain() {
    const N = 200;
    const geo = new THREE.PlaneGeometry(W.HALF * 2, W.HALF * 2, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position.array;
    const col = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], z = pos[i + 2];
      const h = W.height(x, z);
      pos[i + 1] = h;
      const c = W.groundColor(x, z, h);
      col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    G.scene.add(mesh);
  }

  W.build = function () {
    buildTerrain();
    buildPalace();
    buildFort();
    buildVillage();
    buildTown();
    const mesh = new THREE.Mesh(G.mergeGeos(batch), G.mat(0xffffff, { vertexColors: true }));
    G.scene.add(mesh);
    batch.length = 0;
  };

  // Картинка карты для мини-карты.
  W.mapImage = function (size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = ((px + 0.5) / size) * 700 - 350, z = ((py + 0.5) / size) * 700 - 350;
        const col = W.groundColor(x, z, W.height(x, z));
        const i = (py * size + px) * 4;
        img.data[i] = col[0] * 255; img.data[i + 1] = col[1] * 255; img.data[i + 2] = col[2] * 255; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const s = size / 700, t = (v) => (v + 350) * s;
    ctx.fillStyle = 'rgba(40,30,20,0.85)';
    for (const c2 of W.colliders) ctx.fillRect(t(c2.minX), t(c2.minZ), Math.max(1, (c2.maxX - c2.minX) * s), Math.max(1, (c2.maxZ - c2.minZ) * s));
    return c;
  };
})(window.G);
