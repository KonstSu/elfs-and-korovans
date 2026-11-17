// Эффекты: брызги крови, лужи, отрубленные конечности (3Д-обломки, которые остаются лежать).
(function (G) {
  const FX = (G.FX = { parts: [], decals: [], debris: [] });
  let pGeo, pMat, dGeo, dMat;
  function init() {
    if (pGeo) return;
    pGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    pMat = new THREE.MeshBasicMaterial({ color: 0x9b0000 });
    dGeo = new THREE.CircleGeometry(1, 10);
    dGeo.rotateX(-Math.PI / 2);
    dMat = new THREE.MeshBasicMaterial({
      color: 0x5a0000, transparent: true, opacity: 0.8, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
  }

  FX.blood = function (pos, n) {
    init();
    for (let i = 0; i < n; i++) {
      if (FX.parts.length > 400) break;
      const m = new THREE.Mesh(pGeo, pMat);
      m.position.copy(pos);
      G.scene.add(m);
      FX.parts.push({ m, v: new THREE.Vector3(G.rand(-2.5, 2.5), G.rand(0.5, 4), G.rand(-2.5, 2.5)), life: 1.5 });
    }
  };

  FX.drip = function (pos) {
    init();
    const m = new THREE.Mesh(pGeo, pMat);
    m.position.set(pos.x + G.rand(-0.2, 0.2), pos.y + 1, pos.z + G.rand(-0.2, 0.2));
    G.scene.add(m);
    FX.parts.push({ m, v: new THREE.Vector3(0, -1, 0), life: 2, decal: 1 });
  };

  FX.decal = function (x, z, s) {
    init();
    const m = new THREE.Mesh(dGeo, dMat);
    m.position.set(x, G.World.height(x, z) + 0.05, z);
    m.scale.setScalar(s);
    G.scene.add(m);
    FX.decals.push(m);
    if (FX.decals.length > 200) G.scene.remove(FX.decals.shift());
  };

  FX.addDebris = function (obj) {
    obj.rotation.order = 'YXZ';
    obj.userData.v = new THREE.Vector3(G.rand(-2.5, 2.5), G.rand(2.5, 5), G.rand(-2.5, 2.5));
    obj.userData.spin = new THREE.Vector3(G.rand(-9, 9), G.rand(-9, 9), G.rand(-9, 9));
    obj.userData.rest = false;
    FX.debris.push(obj);
    if (FX.debris.length > 70) G.scene.remove(FX.debris.shift());
  };

  FX.update = function (dt) {
    for (let i = FX.parts.length - 1; i >= 0; i--) {
      const p = FX.parts[i];
      p.v.y -= 14 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.life -= dt;
      const gy = G.World.height(p.m.position.x, p.m.position.z);
      if (p.m.position.y < gy || p.life <= 0) {
        if (Math.random() < (p.decal || 0.25)) FX.decal(p.m.position.x, p.m.position.z, G.rand(0.2, 0.5));
        G.scene.remove(p.m);
        FX.parts.splice(i, 1);
      }
    }
    for (const d of FX.debris) {
      const u = d.userData;
      if (u.rest) continue;
      u.v.y -= 16 * dt;
      d.position.addScaledVector(u.v, dt);
      d.rotation.x += u.spin.x * dt;
      d.rotation.y += u.spin.y * dt;
      d.rotation.z += u.spin.z * dt;
      const gy = G.World.height(d.position.x, d.position.z);
      if (d.position.y < gy + 0.15 && u.v.y < 0) {
        d.position.y = gy + 0.15;
        u.rest = true;
        d.rotation.set(Math.PI / 2, Math.random() * Math.PI * 2, 0);
        FX.decal(d.position.x, d.position.z, 0.7);
      }
    }
  };

  FX.clear = function () {
    for (const p of FX.parts) G.scene.remove(p.m);
    for (const d of FX.decals) G.scene.remove(d);
    for (const d of FX.debris) G.scene.remove(d);
    FX.parts = []; FX.decals = []; FX.debris = [];
  };
})(window.G);
