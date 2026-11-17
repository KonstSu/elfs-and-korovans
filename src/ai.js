// Поведение NPC: поиск врагов, бой, стрельба, следование за игроком, марш в набег, охрана корована.
(function (G) {
  const AI = (G.AI = {});
  const CIVIL = new Set(['villager', 'merchant', 'healer']);

  function findTarget(u, range) {
    let best = null, bd = range * range;
    const p = G.player;
    const follow = u.ai.order && u.ai.order.type === 'follow';
    for (const o of G.units) {
      if (o === u || !o.alive) continue;
      const d2 = o.pos.distanceToSquared(u.pos);
      if (d2 >= bd) continue;
      const defend = follow && p && p.alive && o !== p && (o.ai.target === p || o.hates.has(p.id));
      if (G.hostile(u, o) || defend) { bd = d2; best = o; }
    }
    if (best && follow && !G.hostile(u, best)) u.hates.add(best.id); // защищаем своего командира
    return best;
  }
  AI.findTarget = findTarget;

  function steer(u, x, z, speed, dt, stopAt) {
    const dx = x - u.pos.x, dz = z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < (stopAt || 0.5)) return d;
    u.yaw = G.angleLerp(u.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
    u.move(dx / d, dz / d, speed, dt);
    return d;
  }

  function shootAt(u, t, d) {
    const from = u.chest(), to = t.chest();
    const time = d / G.Combat.ARROW_SPEED;
    to.y += 0.5 * G.Combat.ARROW_G * time * time;
    to.x += (Math.random() - 0.5) * d * 0.07;
    to.y += (Math.random() - 0.5) * d * 0.04;
    to.z += (Math.random() - 0.5) * d * 0.07;
    G.Combat.shoot(u, to.sub(from).normalize());
    u.attackCd = u.weapon.cd * G.rand(1.4, 2.2);
    u.aimT = 0.35;
  }

  function wander(u, dt) {
    const ai = u.ai;
    ai.wanderT -= dt;
    if (ai.wanderT <= 0) {
      ai.wanderT = G.rand(3, 8);
      if (Math.random() < 0.45 || u.home.r < 1.5) ai.wx = null;
      else {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * u.home.r;
        ai.wx = u.home.x + Math.cos(a) * r;
        ai.wz = u.home.z + Math.sin(a) * r;
      }
    }
    if (ai.wx != null) {
      if (steer(u, ai.wx, ai.wz, 1.9, dt, 1) < 1) ai.wx = null;
    } else if (u.home.r < 1.5) {
      if (steer(u, u.home.x, u.home.z, 2.2, dt, 0.8) < 0.8 && u.homeYaw != null) u.yaw = G.angleLerp(u.yaw, u.homeYaw, Math.min(1, dt * 3));
    }
  }

  function separate(u) {
    for (const o of G.units) {
      if (o === u || !o.alive) continue;
      const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.81 && d2 > 1e-4) {
        const d = Math.sqrt(d2), push = (0.9 - d) * 0.5;
        u.pos.x += (dx / d) * push;
        u.pos.z += (dz / d) * push;
      }
    }
  }

  AI.update = function (u, dt) {
    const ai = u.ai;
    ai.think -= dt;
    if (ai.think <= 0) {
      ai.think = 0.3 + Math.random() * 0.3;
      const t = ai.target;
      if (!t || !t.alive || !G.hostile(u, t) || t.pos.distanceToSquared(u.pos) > 50 * 50) {
        ai.target = findTarget(u, ai.aggro);
      } else {
        const n = findTarget(u, 6);
        if (n && n !== t && n.pos.distanceToSquared(u.pos) < t.pos.distanceToSquared(u.pos) * 0.5) ai.target = n;
      }
    }
    const t = ai.target;
    if (t) {
      const dx = t.pos.x - u.pos.x, dz = t.pos.z - u.pos.z, d = Math.hypot(dx, dz) || 0.01;
      if (CIVIL.has(u.role)) {
        if (d < 30) { u.yaw = Math.atan2(-dx, -dz); u.move(-dx / d, -dz / d, 5.5, dt); }
        separate(u);
        return;
      }
      u.yaw = G.angleLerp(u.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));
      if (u.weapon.ranged) {
        if (!G.Injuries.canUseBow(u.body)) u.setWeapon('dagger');
        else {
          if (d > 26) u.move(dx / d, dz / d, 6, dt);
          else if (d < 6) u.move(-dx / d, -dz / d, 4.5, dt);
          if (d < 38 && u.attackCd <= 0) shootAt(u, t, d);
          separate(u);
          return;
        }
      }
      if (d > u.weapon.range * 0.8 + (t.scale - 1) * 0.5) u.move(dx / d, dz / d, 6, dt);
      else if (u.attackCd <= 0) { u.meleeTarget = t; u.startSwing(); }
    } else {
      const o = ai.order;
      if (o && o.type === 'follow') {
        const p = G.player;
        if (!p || !p.alive) ai.order = null;
        else {
          const d = Math.hypot(p.pos.x - u.pos.x, p.pos.z - u.pos.z);
          if (d > 4.5) steer(u, p.pos.x, p.pos.z, d > 12 ? 8 : 4.8, dt);
        }
      } else if (o && o.type === 'march') {
        const pt = o.pts[0];
        if (!pt) ai.order = null;
        else if (steer(u, pt.x, pt.z, 5.2, dt, 5) < 5) {
          o.pts.shift();
          if (!o.pts.length) { ai.order = null; u.home = { x: pt.x, z: pt.z, r: 16 }; }
        }
      } else if (o && o.type === 'escort') {
        const e = o.caravan.escortPoint(o.idx);
        if (!e || o.caravan.done) ai.order = null;
        else {
          const d = Math.hypot(e.x - u.pos.x, e.z - u.pos.z);
          if (d > 1.2) steer(u, e.x, e.z, d > 5 ? 6 : 3.4, dt);
          else u.yaw = G.angleLerp(u.yaw, e.yaw, Math.min(1, dt * 4));
        }
      } else wander(u, dt);
    }
    separate(u);
  };
})(window.G);
