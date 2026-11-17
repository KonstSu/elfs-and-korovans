// Бой: удары ближнего боя, стрелы, урон по частям тела, отрубание конечностей.
(function (G) {
  const C = (G.Combat = { arrows: [], ARROW_SPEED: 60, ARROW_G: 2.5 });
  const I = G.Injuries;
  let arrowGeo;

  function getArrowGeo() {
    if (!arrowGeo) {
      arrowGeo = G.mergeGeos([
        { geo: new THREE.CylinderGeometry(0.018, 0.018, 0.85, 4), matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2), color: 0x6d4c41 },
        { geo: new THREE.ConeGeometry(0.04, 0.12, 4), matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0, 0.47), color: 0x9e9e9e },
        { geo: new THREE.BoxGeometry(0.1, 0.01, 0.14), matrix: new THREE.Matrix4().makeTranslation(0, 0, -0.36), color: 0xeeeeee },
      ]);
    }
    return arrowGeo;
  }

  C.damage = function (t, att, dmg, part, sever) {
    if (!t.alive) return;
    if (part === 'head') dmg *= 1.5;
    else if (part !== 'torso') dmg *= 0.75;
    dmg *= 1 - (t.armor || 0);
    t.hp -= dmg;
    G.FX.blood(t.chest(), 5);
    const res = I.applyHit(t.body, part, sever, Math.random);
    if (res.severed) t.severLimb(res.severed);
    if (res.severed || res.eye) t.syncModel();
    if (res.eye) G.FX.blood(t.headPos(), 8);
    if (t.isPlayer) {
      G.UI.hurt();
      if (res.severed) {
        G.UI.msg(res.prostheticBroken ? `Вам сломали протез (${I.NAMES[res.severed]})!`
          : `Вам отрубили ${I.ACC[res.severed]}! Перевяжите рану (H), иначе истечёте кровью!`, '#ff5252');
      }
      if (res.eye) G.UI.msg(res.prostheticBroken ? 'Вам разбили протез глаза!' : `Вам выкололи ${I.ACC[res.eye]}!`, '#ff5252');
    } else if (att && att.isPlayer) {
      if (res.severed && !res.prostheticBroken) G.UI.msg(`Вы отрубили ${I.ACC[res.severed]}: ${t.name}`, '#ffcc80');
      if (res.eye) G.UI.msg(`Вы выкололи глаз: ${t.name}`, '#ffcc80');
    }
    t.onDamaged(att);
    if (t.hp <= 0) t.die(att, 'hit');
  };

  C.meleeHit = function (att) {
    if (!att.alive) return;
    const w = att.weapon, fx = Math.sin(att.yaw), fz = Math.cos(att.yaw);
    const reach = w.range + 0.5 * att.scale;
    let best = null, bs = 1e9;
    for (const u of G.units) {
      if (u === att || !u.alive) continue;
      const dx = u.pos.x - att.pos.x, dz = u.pos.z - att.pos.z, d = Math.hypot(dx, dz);
      if (d > reach + (u.scale - 1) || Math.abs(u.pos.y - att.pos.y) > 2.5) continue;
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (dot < 0.3) continue;
      const hos = G.hostile(att, u);
      if (!att.isPlayer && !hos && u !== att.meleeTarget) continue;
      const score = d - dot * 1.5 - (hos ? 2 : 0);
      if (score < bs) { bs = score; best = u; }
    }
    if (!best) return;
    const dmg = w.dmg * G.rand(0.8, 1.2) * I.damageMul(att.body);
    C.damage(best, att, dmg, I.pickHitPart(Math.random), w.sever);
  };

  C.shoot = function (att, dir) {
    const w = att.weapon;
    const mesh = new THREE.Mesh(getArrowGeo(), G.mat(0xffffff, { vertexColors: true }));
    const pos = att.chest().addScaledVector(dir, 0.7);
    mesh.position.copy(pos);
    G.scene.add(mesh);
    C.arrows.push({ mesh, pos, vel: dir.clone().multiplyScalar(C.ARROW_SPEED), owner: att, dmg: w.dmg, sever: w.sever, life: 6, stuck: false });
    if (C.arrows.length > 120) {
      const old = C.arrows.shift();
      G.scene.remove(old.mesh);
    }
  };

  C.arrowCanHit = function (owner, u) {
    if (u === owner) return false;
    if (owner.isPlayer) return true;
    return G.hostile(owner, u, true);
  };

  function closestOnSeg(a, b, p) {
    const ab = b.clone().sub(a);
    const l2 = ab.lengthSq();
    const t = l2 > 0 ? G.clamp(p.clone().sub(a).dot(ab) / l2, 0, 1) : 0;
    return a.clone().addScaledVector(ab, t);
  }

  function partFromPoint(u, q) {
    if (u.mobility.mode === 'crawl') return I.pickHitPart(Math.random);
    const rel = (q.y - u.pos.y) / u.scale;
    const side = (q.x - u.pos.x) * Math.cos(u.yaw) - (q.z - u.pos.z) * Math.sin(u.yaw); // >0 — левая сторона
    if (rel > 1.78) return 'head';
    if (rel < 0.95) return side > 0 ? 'legL' : 'legR';
    if (Math.abs(side) > 0.28) return side > 0 ? 'armL' : 'armR';
    return 'torso';
  }

  C.update = function (dt) {
    for (let i = C.arrows.length - 1; i >= 0; i--) {
      const a = C.arrows[i];
      if (a.stuck) {
        a.life -= dt;
        if (a.life <= 0) { G.scene.remove(a.mesh); C.arrows.splice(i, 1); }
        continue;
      }
      const prev = a.pos.clone();
      a.vel.y -= C.ARROW_G * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.life -= dt;
      let hit = null, hitQ = null;
      for (const u of G.units) {
        if (!u.alive || !C.arrowCanHit(a.owner, u)) continue;
        if (u.pos.distanceToSquared(a.pos) > 64) continue;
        const r = 0.5 * u.scale;
        for (const c of u.hitSpheres()) {
          const q = closestOnSeg(prev, a.pos, c);
          if (q.distanceToSquared(c) < r * r) { hit = u; hitQ = q; break; }
        }
        if (hit) break;
      }
      if (hit) {
        C.damage(hit, a.owner, a.dmg * G.rand(0.85, 1.15) * I.damageMul(a.owner.body), partFromPoint(hit, hitQ), a.sever);
        G.scene.remove(a.mesh);
        C.arrows.splice(i, 1);
        continue;
      }
      const gy = G.World.height(a.pos.x, a.pos.z);
      let stuck = a.pos.y <= gy;
      if (!stuck) {
        for (const c of G.World.colliders) {
          if (a.pos.x > c.minX && a.pos.x < c.maxX && a.pos.z > c.minZ && a.pos.z < c.maxZ && a.pos.y < c.top) { stuck = true; break; }
        }
      }
      if (stuck || a.life <= 0) {
        a.stuck = true;
        a.life = 10;
        if (a.pos.y < gy) a.pos.y = gy + 0.1;
      }
      a.mesh.position.copy(a.pos);
      if (!a.stuck) a.mesh.lookAt(a.pos.x + a.vel.x, a.pos.y + a.vel.y, a.pos.z + a.vel.z);
    }
  };

  C.clear = function () {
    for (const a of C.arrows) G.scene.remove(a.mesh);
    C.arrows = [];
  };
})(window.G);
