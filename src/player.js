// Управление игроком и камерой (вид от третьего/первого лица).
(function (G) {
  const P = (G.PlayerCtl = { keys: {}, yaw: 0, pitch: -0.12, fp: false, attackHeld: false, interact: null, msgT: 0 });
  const TALKERS = {
    merchant: 'Торговать (лавка)', healer: 'Лекарь', commander: 'Поговорить с командиром',
    elder: 'Поговорить со старейшиной', emperor: 'Поговорить с императором',
  };

  P.init = function () {
    window.addEventListener('keydown', (e) => P.onKey(e));
    window.addEventListener('keyup', (e) => { P.keys[e.code] = false; });
    window.addEventListener('blur', () => { P.keys = {}; P.attackHeld = false; });
    document.addEventListener('mousemove', (e) => {
      if (!G.UI.locked || !G.running) return;
      P.yaw -= e.movementX * 0.0024;
      P.pitch = G.clamp(P.pitch - e.movementY * 0.0022, -1.25, 1.0);
    });
    G.renderer.domElement.addEventListener('mousedown', (e) => {
      if (!G.running) return;
      if (!G.UI.locked) { if (!G.UI.modalOpen) G.UI.lock(); return; }
      if (e.button === 0) P.attackHeld = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) P.attackHeld = false; });
  };

  function throttledMsg(text) {
    const now = performance.now();
    if (now - P.msgT < 1500) return;
    P.msgT = now;
    G.UI.msg(text, '#ffab40');
  }

  P.onKey = function (e) {
    if (!G.running) return;
    if (['F5', 'F9', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    P.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'Escape' && G.UI.modalOpen) { G.UI.closeModal(); return; }
    if (G.UI.modalOpen) { if (e.code === 'KeyI') G.UI.closeModal(); return; }
    if (e.code === 'KeyL' || e.code === 'F9') { G.Save.load(); return; }
    const p = G.player;
    if (!p || !p.alive) return;
    switch (e.code) {
      case 'Space': P.jump(); break;
      case 'KeyE': if (P.interact) P.interact.fn(); break;
      case 'KeyH': P.useBandage(); break;
      case 'KeyQ': P.usePotion(); break;
      case 'KeyI': G.UI.openInventory(); break;
      case 'KeyV': P.fp = !P.fp; break;
      case 'KeyM': G.UI.toggleMap(); break;
      case 'KeyR': G.Director.command('follow'); break;
      case 'KeyT': G.Director.command('attack'); break;
      case 'KeyG': G.Director.command('home'); break;
      case 'KeyK': case 'F5': G.Save.save(); break;
      default:
        if (e.code.startsWith('Digit')) {
          const n = +e.code.slice(5);
          const owned = G.WEAPON_ORDER.filter((w) => G.state.weapons.has(w));
          if (owned[n - 1]) { p.setWeapon(owned[n - 1]); G.UI.msg('Оружие: ' + G.WEAPONS[owned[n - 1]].name); }
        }
    }
  };

  P.jump = function () {
    const p = G.player, mob = p.mobility;
    if (!mob.canJump) { throttledMsg(mob.mode === 'crawl' ? 'Без ноги не попрыгаешь… Можно только ползти.' : 'В коляске не прыгают.'); return; }
    if (p.onGround) { p.vy = 7.5; p.onGround = false; }
  };

  P.useBandage = function () {
    const p = G.player, s = G.state;
    if (p.body.bleeding <= 0) { G.UI.msg('Кровотечения нет.'); return; }
    if (s.inv.bandage <= 0) { G.UI.msg('Нет бинтов! Купите в лавке или найдите у трупов.', '#ff8a65'); return; }
    s.inv.bandage--;
    G.Injuries.bandage(p.body);
    G.UI.msg('Вы перевязали рану. Кровь остановлена.', '#b9f6ca');
  };

  P.usePotion = function () {
    const p = G.player, s = G.state;
    if (s.inv.potion <= 0) { G.UI.msg('Нет зелий лечения.', '#ff8a65'); return; }
    s.inv.potion--;
    p.hp = Math.min(p.maxHp, p.hp + 50);
    G.UI.msg('Вы выпили зелье: +50 здоровья.' + (p.body.bleeding > 0 ? ' Но кровь всё ещё идёт!' : ''), '#b9f6ca');
  };

  P.forward = function () {
    return new THREE.Vector3(Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), Math.cos(P.yaw) * Math.cos(P.pitch));
  };

  // Точка, куда смотрит прицел: первый враг или земля на луче из камеры.
  P.aimPoint = function () {
    const cam = G.camera.position.clone(), f = P.forward();
    let best = 90;
    for (const u of G.units) {
      if (u.isPlayer || !u.alive) continue;
      const c = u.chest(), rel = c.clone().sub(cam), t = rel.dot(f);
      if (t < 1 || t > best) continue;
      if (rel.clone().addScaledVector(f, -t).lengthSq() < 0.8 * 0.8) best = t;
    }
    for (let t = 2; t < best; t += 1.5) {
      const q = cam.clone().addScaledVector(f, t);
      if (q.y < G.World.height(q.x, q.z)) { best = t; break; }
    }
    return cam.addScaledVector(f, best);
  };

  P.attack = function () {
    const p = G.player;
    if (p.attackCd > 0 || p.swingT >= 0) return;
    p.yaw = P.yaw;
    const w = p.weapon;
    if (w.ranged) {
      if (!G.Injuries.canUseBow(p.body)) { throttledMsg('Чтобы стрелять из лука, нужны обе руки! Смените оружие (1–6).'); return; }
      const from = p.chest(), to = P.aimPoint();
      const d = from.distanceTo(to), time = d / G.Combat.ARROW_SPEED;
      to.y += 0.5 * G.Combat.ARROW_G * time * time;
      G.Combat.shoot(p, to.sub(from).normalize());
      p.attackCd = w.cd;
      p.aimT = 0.3;
    } else p.startSwing();
  };

  P.update = function (dt) {
    const p = G.player;
    if (!p || !p.alive) return;
    const k = P.keys, fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let mx = 0, mz = 0;
    if (k.KeyW || k.ArrowUp) { mx += fx; mz += fz; }
    if (k.KeyS || k.ArrowDown) { mx -= fx; mz -= fz; }
    if (k.KeyD || k.ArrowRight) { mx -= fz; mz += fx; }
    if (k.KeyA || k.ArrowLeft) { mx += fz; mz -= fx; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      const run = k.ShiftLeft || k.ShiftRight;
      p.move(mx, mz, run ? 8.5 : 4.6, dt);
      if (!P.fp && p.swingT < 0 && p.aimT <= 0) p.yaw = G.angleLerp(p.yaw, Math.atan2(mx, mz), Math.min(1, dt * 12));
    }
    if (P.fp) p.yaw = P.yaw;
    if (P.attackHeld) P.attack();
    P.interact = P.findInteract();
  };

  P.findInteract = function () {
    const p = G.player;
    let best = null, bd = 1e9;
    const consider = (d2, label, fn) => { if (d2 < bd) { bd = d2; best = { label, fn }; } };
    for (const u of G.units) {
      if (!u.alive || u.isPlayer || !TALKERS[u.role]) continue;
      const d2 = u.pos.distanceToSquared(p.pos);
      if (d2 < 3.5 * 3.5 && !G.hostile(u, p)) consider(d2, TALKERS[u.role], () => G.UI.talk(u));
    }
    for (const c of G.corpses) {
      if (c.looted) continue;
      const d2 = c.pos.distanceToSquared(p.pos);
      if (d2 < 2.6 * 2.6) consider(d2 + 1, 'Обыскать труп: ' + c.name, () => G.Director.lootCorpse(c));
    }
    for (const cv of G.Director.caravans) {
      for (const cart of cv.carts) {
        if (cart.robbed) continue;
        const d2 = G.dist2(cart.x, cart.z, p.pos.x, p.pos.z);
        if (d2 < 4.5 * 4.5) consider(d2 - 2, 'Ограбить корован!', () => G.Director.robCart(cv, cart));
      }
    }
    const h = G.World.house;
    if (G.state.ownsHouse && h && G.dist2(h.dx, h.dz, p.pos.x, p.pos.z) < 9) consider(0, 'Отдохнуть в своём доме', () => G.Director.restAtHome());
    return best;
  };

  P.updateCamera = function (dt) {
    const p = G.player, cam = G.camera;
    if (!p) return;
    if (!p.alive) {
      P.yaw += dt * 0.25;
      const c = p.pos;
      cam.position.set(c.x - Math.sin(P.yaw) * 7, c.y + 5, c.z - Math.cos(P.yaw) * 7);
      cam.lookAt(c.x, c.y + 0.5, c.z);
      return;
    }
    const mode = p.mobility.mode;
    const headY = (mode === 'crawl' ? 0.55 : mode === 'wheelchair' ? 1.35 : 1.75) * p.scale;
    const f = P.forward();
    p.model.head.visible = !P.fp;
    if (P.fp) {
      cam.position.set(p.pos.x, p.pos.y + headY, p.pos.z).addScaledVector(f, 0.3);
    } else {
      const rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw);
      cam.position.set(p.pos.x + rx * 0.7, p.pos.y + headY + 0.35, p.pos.z + rz * 0.7).addScaledVector(f, -4.6 * p.scale);
      const gy = G.World.height(cam.position.x, cam.position.z) + 0.4;
      if (cam.position.y < gy) cam.position.y = gy;
    }
    cam.lookAt(cam.position.x + f.x, cam.position.y + f.y, cam.position.z + f.z);
  };
})(window.G);
