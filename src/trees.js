// Густой лес с LOD: вдали деревья — плоские картинки (спрайты), вблизи — трёхмерные модели.
(function (G) {
  const T = (G.Trees = { list: [], grid: new Map(), CELL: 8, NEAR: 60, FAR: 430, CAP: 1200, lx: 1e9, lz: 1e9 });
  const KINDS = [
    { id: 'pine', h: 7.4 },
    { id: 'leaf', h: 7.8 },
  ];
  const AVG_SCALE = 1.2;
  const key = (cx, cz) => cx * 100003 + cz;

  function spriteTexture(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    if (kind === 0) {
      x.fillStyle = '#5b3a1e';
      x.fillRect(58, 100, 12, 28);
      const layers = [[64, 8, 22, 58], [64, 32, 32, 80], [64, 56, 42, 108]];
      layers.forEach(([cx, top, half, bottom], i) => {
        x.fillStyle = ['#2c6e31', '#25612a', '#1f5223'][i];
        x.beginPath(); x.moveTo(cx, top); x.lineTo(cx - half, bottom); x.lineTo(cx + half, bottom); x.closePath(); x.fill();
        x.fillStyle = 'rgba(0,0,0,0.18)';
        x.beginPath(); x.moveTo(cx, top); x.lineTo(cx + half, bottom); x.lineTo(cx + 4, bottom); x.closePath(); x.fill();
      });
    } else {
      x.fillStyle = '#5b3a1e';
      x.fillRect(57, 70, 14, 58);
      const blobs = [[64, 46, 40, '#2f6326'], [84, 36, 26, '#3f7d30'], [44, 52, 26, '#356e2a'], [62, 26, 24, '#3f7d30']];
      for (const [bx, by, r, col] of blobs) {
        x.fillStyle = col;
        x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = 'rgba(0,0,0,0.15)';
      x.beginPath(); x.arc(78, 58, 30, 0, Math.PI * 2); x.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function tm(x, y, z) { return new THREE.Matrix4().makeTranslation(x, y, z); }

  T.build = function () {
    const rng = G.seeded(1337), W = G.World;
    const V = W.VILLAGE;
    const tooClose = (x, z, minD) => {
      const cx = Math.floor(x / T.CELL), cz = Math.floor(z / T.CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const arr = T.grid.get(key(cx + dx, cz + dz));
        if (!arr) continue;
        for (const t of arr) if (G.dist2(x, z, t.x, t.z) < minD * minD) return true;
      }
      return false;
    };
    const ok = (x, z, roadMargin) => {
      if (W.distToRoad(x, z) < roadMargin) return false;
      if (Math.hypot(x - V.x, z - V.z) < V.r + 2) return false;
      for (const id of ['town', 'palace', 'fort']) {
        const zn = W.ZONES[id];
        if (Math.hypot(x - zn.x, z - zn.z) < zn.r) return false;
      }
      if (W.insideCollider(x, z, 2)) return false;
      if (tooClose(x, z, 2.4)) return false;
      return true;
    };
    const add = (x, z, kind, s) => {
      const y = W.height(x, z);
      const t = { x, z, y, kind, s, r: 0.35 * s };
      t.m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0)),
        new THREE.Vector3(s, s * (0.9 + rng() * 0.25), s)
      );
      T.list.push(t);
      const k = key(Math.floor(x / T.CELL), Math.floor(z / T.CELL));
      if (!T.grid.has(k)) T.grid.set(k, []);
      T.grid.get(k).push(t);
    };

    const E = W.ZONES.elves;
    for (let i = 0; i < 3600; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 150;
      const x = E.x + Math.cos(a) * d * 1.05, z = E.z + Math.sin(a) * d;
      if (!ok(x, z, 5)) continue;
      add(x, z, rng() < 0.6 ? 0 : 1, 0.85 + rng() * 0.75);
    }
    for (let i = 0; i < 1800; i++) {
      const x = (rng() * 2 - 1) * 335, z = (rng() * 2 - 1) * 335;
      const h = W.height(x, z);
      if (h > 78) continue;
      const mountain = z < -110;
      if (rng() > (mountain ? 0.55 : 0.18)) continue;
      if (!ok(x, z, 7)) continue;
      add(x, z, mountain || rng() < 0.5 ? 0 : 1, 0.8 + rng() * 0.7);
    }

    const trunk = 0x5b3a1e;
    const pineGeo = G.mergeGeos([
      { geo: new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6), matrix: tm(0, 1.1, 0), color: trunk },
      { geo: new THREE.ConeGeometry(2.3, 3.6, 8), matrix: tm(0, 3.4, 0), color: 0x1f5223 },
      { geo: new THREE.ConeGeometry(1.7, 3.0, 8), matrix: tm(0, 5.0, 0), color: 0x25612a },
      { geo: new THREE.ConeGeometry(1.0, 2.2, 8), matrix: tm(0, 6.3, 0), color: 0x2c6e31 },
    ]);
    const leafGeo = G.mergeGeos([
      { geo: new THREE.CylinderGeometry(0.28, 0.4, 3.4, 6), matrix: tm(0, 1.7, 0), color: trunk },
      { geo: new THREE.IcosahedronGeometry(2.6, 0), matrix: tm(0, 5.0, 0), color: 0x356e2a },
      { geo: new THREE.IcosahedronGeometry(1.8, 0), matrix: tm(1.2, 6.0, 0.4), color: 0x3f7d30 },
      { geo: new THREE.IcosahedronGeometry(1.6, 0), matrix: tm(-1.1, 5.6, -0.6), color: 0x2f6326 },
    ]);
    const mat = G.mat(0xffffff, { vertexColors: true });
    T.meshes = [pineGeo, leafGeo].map((g) => {
      const m = new THREE.InstancedMesh(g, mat, T.CAP);
      m.count = 0;
      m.frustumCulled = false;
      G.scene.add(m);
      return m;
    });
    T.points = KINDS.map((k, i) => {
      const n = T.list.filter((t) => t.kind === i).length;
      const arr = new Float32Array(Math.max(1, n) * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const worldH = (k.h * AVG_SCALE) / 0.94; // высота квадратного спрайта в метрах
      const size = worldH / Math.tan(THREE.MathUtils.degToRad(35)); // для камеры с fov 70
      const pm = new THREE.PointsMaterial({ size, map: spriteTexture(i), alphaTest: 0.5, color: 0xe6e6e6, sizeAttenuation: true });
      const pts = new THREE.Points(geo, pm);
      pts.frustumCulled = false;
      G.scene.add(pts);
      return { pts, arr, geo, half: worldH / 2 };
    });
    T.update(0, 0, true);
  };

  T.update = function (cx, cz, force) {
    if (!force && G.dist2(cx, cz, T.lx, T.lz) < 4) return;
    T.lx = cx; T.lz = cz;
    const near2 = T.NEAR * T.NEAR, far2 = T.FAR * T.FAR;
    const n = [0, 0], f = [0, 0];
    for (const t of T.list) {
      const d2 = G.dist2(t.x, t.z, cx, cz);
      const k = t.kind;
      if (d2 < near2 && n[k] < T.CAP) {
        T.meshes[k].setMatrixAt(n[k]++, t.m);
      } else if (d2 < far2) {
        const p = T.points[k], i = f[k]++ * 3;
        p.arr[i] = t.x; p.arr[i + 1] = t.y + p.half; p.arr[i + 2] = t.z;
      }
    }
    for (let k = 0; k < 2; k++) {
      T.meshes[k].count = n[k];
      T.meshes[k].instanceMatrix.needsUpdate = true;
      T.points[k].geo.setDrawRange(0, f[k]);
      T.points[k].geo.attributes.position.needsUpdate = true;
    }
  };

  T.collide = function (pos, r) {
    const cx = Math.floor(pos.x / T.CELL), cz = Math.floor(pos.z / T.CELL);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = T.grid.get(key(cx + dx, cz + dz));
      if (!arr) continue;
      for (const t of arr) {
        const ddx = pos.x - t.x, ddz = pos.z - t.z, rr = r + t.r;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = t.x + (ddx / d) * rr;
          pos.z = t.z + (ddz / d) * rr;
        }
      }
    }
  };
})(window.G);
