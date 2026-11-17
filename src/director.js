// Режиссёр мира: население зон, набеги, корованы, приказы командира/старейшины, команды Злого.
(function (G) {
  const D = (G.Director = { caravans: [], t: {} });

  const BASES = {
    elves: { x: -220, z: -30, r: 26, count: 10 },
    guard: { x: 205, z: -30, r: 18, count: 12 },
    villain: { x: 0, z: -243, r: 14, count: 12 },
    town: { x: 0, z: 210, r: 24, count: 7 },
  };
  D.BASES = BASES;
  const HOME_ZONE = { elves: 'elves', guard: 'palace', villain: 'fort' };
  const SPECIAL = new Set(['commander', 'emperor', 'elder', 'merchant', 'healer', 'boss', 'spy']);
  const ROLE_STATS = {
    warrior: { hp: 60, gold: [2, 12] },
    archer: { hp: 45, gold: [2, 10], weapon: 'bow' },
    commander: { hp: 140, armor: 0.25, weapon: 'sword', gold: [20, 40] },
    emperor: { hp: 90, armor: 0.1, weapon: 'sword', gold: [100, 200] },
    boss: { hp: 320, armor: 0.2, weapon: 'blackaxe', gold: [150, 300] },
    villager: { hp: 35, weapon: 'fists', gold: [1, 8] },
    merchant: { hp: 45, weapon: 'dagger', gold: [30, 60] },
    healer: { hp: 40, weapon: 'fists', gold: [10, 30] },
    caravan_guard: { hp: 75, armor: 0.1, weapon: 'sword', gold: [5, 20] },
    spy: { hp: 50, weapon: 'dagger', gold: [20, 40] },
    elder: { hp: 60, weapon: 'bow', gold: [5, 15] },
    partisan: { hp: 55, gold: [2, 10] },
    merc: { hp: 80, armor: 0.15, weapon: 'sword', gold: [0, 0] },
  };
  const RAID_NAMES = { guard: 'Солдаты дворца', villain: 'Войска Злого', elves: 'Партизаны-эльфы' };
  const ITEM_NAMES = { p_arm: 'протез руки', p_leg: 'протез ноги', p_eye: 'протез глаза', bandage: 'бинт', potion: 'зелье' };
  D.ITEM_NAMES = ITEM_NAMES;

  const VILLAIN_ROUTE = [{ x: 2, z: -215 }, { x: 15, z: -120 }, { x: 20, z: 10 }, { x: 120, z: -25 }, { x: 178, z: -30 }, { x: 210, z: -30 }];
  const RAID_ROUTES = {
    palace: { spawn: () => ({ x: 95 + G.rand(-10, 10), z: -25 + G.rand(-25, 25) }), pts: [{ x: 178, z: -30 }, { x: 205, z: -30 }] },
    elves: { spawn: (f) => (f === 'villain' ? { x: -170, z: -150 } : { x: -110, z: 20 + G.rand(-20, 20) }), pts: [{ x: -220, z: -30 }] },
    fort: { spawn: () => ({ x: 15 + G.rand(-6, 6), z: -125 }), pts: [{ x: 2, z: -218 }, { x: 0, z: -243 }] },
  };

  function weaponFor(f) {
    if (f === 'elves') return G.pick(['dagger', 'sword', 'sword']);
    if (f === 'guard') return G.pick(['sword', 'sword', 'axe']);
    if (f === 'villain') return G.pick(['axe', 'sword', 'axe']);
    return 'fists';
  }
  const clonePts = (pts) => pts.map((p) => ({ x: p.x, z: p.z }));

  function freePoint(x, z, r) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (!G.World.insideCollider(px, pz, 1)) return { x: px, z: pz };
    }
    return { x, z };
  }

  D.spawn = function (faction, role, x, z, extra) {
    const st = ROLE_STATS[role] || ROLE_STATS.warrior;
    const opts = Object.assign({
      faction, role, x, z, hp: st.hp, armor: st.armor || (faction === 'guard' ? 0.15 : 0),
      weapon: st.weapon || weaponFor(faction), gold: G.randInt(st.gold[0], st.gold[1]),
    }, extra || {});
    const u = new G.Unit(opts);
    if (Math.random() < 0.15) u.loot.push('bandage');
    if (Math.random() < 0.05) u.loot.push(G.pick(['p_arm', 'p_leg', 'p_eye']));
    G.units.push(u);
    return u;
  };

  function spawnAtBase(f) {
    const b = BASES[f];
    const p = freePoint(b.x, b.z, b.r);
    const n = G.units.filter((u) => u.base === f).length;
    let role = f === 'town' ? 'villager' : 'warrior';
    if ((f === 'elves' && n % 3 === 0) || (f === 'guard' && n % 5 === 0)) role = 'archer';
    return D.spawn(f, role, p.x, p.z, { homeX: b.x, homeZ: b.z, homeR: b.r, base: f });
  }

  D.findRole = (role) => G.units.find((u) => u.alive && u.role === role);

  const SPECIALS = {
    commander: () => D.spawn('guard', 'commander', 196, -16, { homeR: 1, yaw: -Math.PI / 2 }),
    emperor: () => D.spawn('guard', 'emperor', 222, -30, { homeR: 4, yaw: -Math.PI / 2 }),
    elder: () => D.spawn('elves', 'elder', -214, -26, { homeR: 1, yaw: 0 }),
    merchant: () => D.spawn('town', 'merchant', -12, 210.6, { homeR: 0.5, yaw: 0 }),
    healer: () => D.spawn('town', 'healer', 14, 205.2, { homeR: 0.5, yaw: 0 }),
    boss: () => D.spawn('villain', 'boss', 0, -254, { homeR: 4, yaw: 0, aggro: 22 }),
  };
  D.spawnSpecial = (role) => SPECIALS[role]();

  D.init = function (pf) {
    D.caravans = [];
    D.t = { caravan: 10, raid: 55, respawn: 25, background: 100, emperor: -1, boss: -1, commander: -1, specialCheck: 5 };
    for (const f of Object.keys(BASES)) for (let i = 0; i < BASES[f].count; i++) spawnAtBase(f);
    for (const r of ['commander', 'emperor', 'elder', 'merchant', 'healer']) D.spawnSpecial(r);
    if (pf !== 'villain') D.spawnSpecial('boss');
  };

  D.clear = function () {
    for (const c of D.caravans) c.removeMeshes();
    D.caravans = [];
  };

  D.update = function (dt) {
    const t = D.t;
    t.caravan -= dt;
    if (t.caravan <= 0) { t.caravan = G.rand(60, 90); if (D.caravans.length < 2) D.spawnCaravan(); }
    t.raid -= dt;
    if (t.raid <= 0) { t.raid = G.rand(80, 120); if (G.units.length < 120) D.playerRaid(); }
    t.background -= dt;
    if (t.background <= 0) { t.background = G.rand(120, 180); if (G.units.length < 110) D.backgroundRaid(); }
    t.respawn -= dt;
    if (t.respawn <= 0) { t.respawn = 25; D.respawn(); }
    t.specialCheck -= dt;
    if (t.specialCheck <= 0) {
      t.specialCheck = 5;
      for (const role of ['commander', 'elder', 'merchant', 'healer']) {
        const key = 'sp_' + role;
        if (!D.findRole(role)) {
          if (t[key] == null) t[key] = 90;
        } else t[key] = null;
      }
    }
    for (const role of ['commander', 'elder', 'merchant', 'healer']) {
      const key = 'sp_' + role;
      if (t[key] != null) { t[key] -= dt; if (t[key] <= 0) { t[key] = null; D.spawnSpecial(role); } }
    }
    if (t.emperor > 0) { t.emperor -= dt; if (t.emperor <= 0) { D.spawnSpecial('emperor'); G.UI.msg('Во дворце коронован новый император.', '#ffd54f'); } }
    if (t.boss > 0) { t.boss -= dt; if (t.boss <= 0 && G.state.faction !== 'villain') { D.spawnSpecial('boss'); G.UI.msg('Злой вернулся в свой форт...', '#ce93d8'); } }
    for (const c of D.caravans) c.update(dt);
    D.caravans = D.caravans.filter((c) => !c.done);
  };

  D.respawn = function () {
    if (G.units.length > 115) return;
    for (const f of Object.keys(BASES)) {
      const n = G.units.filter((u) => u.alive && u.base === f).length;
      if (n < BASES[f].count) spawnAtBase(f);
    }
  };

  D.spawnRaid = function (f, zone, n, opts) {
    opts = opts || {};
    const route = RAID_ROUTES[zone];
    const sp = route.spawn(f);
    const list = [];
    for (let i = 0; i < n; i++) {
      const p = freePoint(sp.x, sp.z, 6);
      const role = opts.role || (f === 'elves' ? (i % 3 === 2 ? 'archer' : 'partisan') : i % 4 === 3 && f === 'guard' ? 'archer' : 'warrior');
      const u = D.spawn(f, role, p.x, p.z, { order: { type: 'march', pts: clonePts(route.pts) }, aggro: opts.aggro || 30, weapon: role === 'archer' ? 'bow' : undefined });
      list.push(u);
    }
    const home = HOME_ZONE[G.state.faction];
    if (opts.announce || zone === home) {
      const who = opts.role === 'spy' ? 'Шпионы' : RAID_NAMES[f];
      G.UI.msg(`Тревога! ${who} идут на ${G.World.ZONES[zone].name.toLowerCase()}!`, '#ff5252');
    }
    return list;
  };

  D.playerRaid = function () {
    const pf = G.state.faction;
    if (pf === 'elves') D.spawnRaid(G.pick(['guard', 'guard', 'villain']), 'elves', G.randInt(4, 6));
    else if (pf === 'guard') {
      const r = Math.random();
      if (r < 0.4) D.spawnRaid('villain', 'palace', G.randInt(4, 6));
      else if (r < 0.75) D.spawnRaid('elves', 'palace', G.randInt(3, 5));
      else D.spawnRaid('elves', 'palace', 2, { role: 'spy', aggro: 8 });
    } else {
      const r = Math.random();
      if (r < 0.5) D.spawnRaid('elves', 'fort', G.randInt(3, 5));
      else if (r < 0.75) D.spawnRaid('elves', 'fort', 2, { role: 'spy', aggro: 8 });
      else D.spawnRaid('guard', 'fort', G.randInt(4, 6));
    }
  };

  D.backgroundRaid = function () {
    const home = HOME_ZONE[G.state.faction];
    const combos = [['guard', 'fort'], ['villain', 'palace'], ['elves', 'palace'], ['villain', 'elves'], ['guard', 'elves'], ['elves', 'fort']]
      .filter(([f, z]) => z !== home && f !== G.state.faction);
    if (!combos.length) return;
    const [f, z] = G.pick(combos);
    D.spawnRaid(f, z, 4);
  };

  // ---------- Корованы ----------
  function makeCart() {
    const g = new THREE.Group();
    const add = (w, h, d, c, x, y, z) => { const o = G.box(w, h, d, c); o.position.set(x, y, z); g.add(o); return o; };
    add(1.9, 0.5, 3.4, 0x7b5533, 0, 0.95, 0);
    add(0.1, 0.5, 3.4, 0x3e2a1a, 0.95, 1.4, 0);
    add(0.1, 0.5, 3.4, 0x3e2a1a, -0.95, 1.4, 0);
    for (const [x, z] of [[1.05, 1.1], [-1.05, 1.1], [1.05, -1.1], [-1.05, -1.1]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12), G.mat(0x3e2a1a));
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.55, z); g.add(w);
    }
    const cargo = [add(0.8, 0.7, 0.8, 0x8d6e63, 0.4, 1.55, 0.6), add(0.7, 0.6, 0.7, 0xa1887f, -0.4, 1.5, -0.7), add(0.5, 0.5, 0.5, 0xffd54f, 0, 1.45, 0)];
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 3.2, 12, 1, true, Math.PI / 2, Math.PI), G.mat(0xeee6d0, { side: THREE.DoubleSide }));
    cover.rotation.x = Math.PI / 2;
    cover.position.y = 1.2;
    g.add(cover);
    add(0.9, 0.9, 1.7, 0x6d4c41, 0, 1.1, 3.4);
    add(0.5, 0.5, 0.6, 0x5d4037, 0, 1.4, 4.45);
    add(0.6, 0.08, 0.08, 0xe0d6c0, 0, 1.7, 4.4);
    for (const [x, z] of [[0.3, 2.8], [-0.3, 2.8], [0.3, 4.0], [-0.3, 4.0]]) add(0.2, 0.7, 0.2, 0x5d4037, x, 0.35, z);
    add(0.08, 0.08, 1.6, 0x3e2a1a, 0.35, 0.9, 2.2);
    add(0.08, 0.08, 1.6, 0x3e2a1a, -0.35, 0.9, 2.2);
    const driver = new THREE.Group();
    const dt = G.box(0.5, 0.6, 0.3, 0x8d6e63); dt.position.y = 1.65; driver.add(dt);
    const dh = G.box(0.36, 0.36, 0.36, 0xe0b894); dh.position.y = 2.15; driver.add(dh);
    driver.position.z = 1.4;
    g.add(driver);
    G.scene.add(g);
    return { group: g, cover, cargo, driver, robbed: false, x: 0, z: 0, yaw: 0 };
  }

  class Caravan {
    constructor() {
      const r = G.World.ROADS[0].map((p) => ({ x: p[0], z: p[1] }));
      if (Math.random() < 0.5) r.reverse();
      this.path = r;
      this.cum = [0];
      for (let i = 1; i < r.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z));
      this.total = this.cum[this.cum.length - 1];
      this.s = 30;
      this.done = false;
      this.stopT = 0;
      this.carts = [makeCart(), makeCart()];
      this.place();
      this.guards = [];
      for (let i = 0; i < 3; i++) {
        const e = this.escortPoint(i);
        this.guards.push(D.spawn('caravan', 'caravan_guard', e.x, e.z, { order: { type: 'escort', caravan: this, idx: i }, aggro: 14, weapon: i === 2 ? 'axe' : 'sword' }));
      }
    }
    point(s) {
      s = G.clamp(s, 0, this.total);
      let i = 1;
      while (i < this.cum.length - 1 && this.cum[i] < s) i++;
      const a = this.path[i - 1], b = this.path[i];
      const t = (s - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1);
      return { x: G.lerp(a.x, b.x, t), z: G.lerp(a.z, b.z, t), yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    place() {
      this.carts.forEach((c, i) => {
        const p = this.point(this.s - i * 9);
        c.x = p.x; c.z = p.z;
        c.yaw = G.angleLerp(c.yaw, p.yaw, 0.1);
        c.group.position.set(p.x, G.World.height(p.x, p.z), p.z);
        c.group.rotation.y = c.yaw;
      });
    }
    escortPoint(i) {
      const off = [[2.6, 0, 0], [-2.6, 0, 1], [0, -5, 1]][i];
      const c = this.carts[off[2]];
      const lx = Math.cos(c.yaw), lz = -Math.sin(c.yaw), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      return { x: c.x + lx * off[0] + fx * off[1], z: c.z + lz * off[0] + fz * off[1], yaw: c.yaw };
    }
    update(dt) {
      const alive = this.guards.filter((g) => g.alive);
      const fighting = alive.some((g) => g.ai.target);
      const robbed = this.carts.some((c) => c.robbed);
      const lagging = alive.some((g) => { const e = this.escortPoint(g.ai.order ? g.ai.order.idx : 0); const d2 = G.dist2(e.x, e.z, g.pos.x, g.pos.z); return d2 > 64 && d2 < 900; });
      if (!fighting && !robbed && alive.length && !lagging) {
        this.s += 3 * dt;
        this.place();
      }
      if (robbed || !alive.length) this.stopT += dt;
      if (this.s >= this.total - 2 || this.stopT > 150) this.finish();
    }
    removeMeshes() {
      for (const c of this.carts) G.scene.remove(c.group);
    }
    finish() {
      this.done = true;
      this.removeMeshes();
      for (const g of this.guards) {
        if (g.alive) { g.alive = false; g.removeFromScene(); }
      }
    }
  }
  D.spawnCaravan = function () {
    const c = new Caravan();
    D.caravans.push(c);
    if (G.state.faction !== 'elves' && Math.random() < 0.35) {
      const p = c.point(c.total / 2);
      const list = D.spawnRaid('elves', 'elves', 3, { role: 'partisan' });
      for (const u of list) {
        u.hatesFactions.add('caravan');
        u.ai.order = { type: 'march', pts: [{ x: p.x - 20, z: p.z + 10 }] };
      }
    }
    if (G.state.faction === 'elves') G.UI.msg('По дороге из города людей во дворец идёт корован!', '#ffd54f');
    return c;
  };

  D.robCart = function (cv, cart) {
    if (cart.robbed) return;
    cart.robbed = true;
    cart.cover.visible = false;
    cart.cargo.forEach((c) => (c.visible = false));
    cart.driver.visible = false;
    const s = G.state, gold = G.randInt(60, 150), extra = [];
    s.gold += gold;
    if (Math.random() < 0.6) { s.inv.bandage += 2; extra.push('2 бинта'); }
    if (Math.random() < 0.4) { s.inv.potion += 1; extra.push('зелье'); }
    if (Math.random() < 0.15) { const k = G.pick(['p_arm', 'p_leg', 'p_eye']); s.inv[k]++; extra.push(ITEM_NAMES[k]); }
    G.UI.msg(`Вы ограбили корован! +${gold} золота${extra.length ? ', ' + extra.join(', ') : ''}`, '#ffd54f');
    const p = G.player;
    for (const g of cv.guards) {
      if (!g.alive) continue;
      g.hates.add(p.id);
      g.hatesFactions.add(p.faction);
      g.ai.target = p;
    }
    const m = s.mission, def = D.missionDef();
    if (m && def && def.rob && !m.done) {
      m.progress++;
      if (m.progress >= def.rob) D.completeMission();
    }
  };

  D.lootCorpse = function (c) {
    c.looted = true;
    const s = G.state, parts = [];
    if (c.gold > 0) { s.gold += c.gold; parts.push(`${c.gold} золота`); }
    for (const it of c.loot) { s.inv[it] = (s.inv[it] || 0) + 1; parts.push(ITEM_NAMES[it]); }
    G.UI.msg(parts.length ? `Вы нашли: ${parts.join(', ')}` : 'Ничего ценного.', '#ffe082');
  };

  D.restAtHome = function () {
    const p = G.player;
    p.hp = p.maxHp;
    G.Injuries.bandage(p.body);
    G.UI.msg('Вы отдохнули дома. Здоровье восстановлено.', '#b9f6ca');
    G.Save.save();
  };

  D.hireMerc = function () {
    const p = G.player;
    const u = D.spawn(p.faction, 'merc', p.pos.x + G.rand(-2, 2), p.pos.z + G.rand(-2, 2), { order: { type: 'follow' }, gold: 0 });
    u.name = 'Наёмник';
    G.UI.msg('Наёмник пойдёт за вами.', '#b9f6ca');
  };
  D.mercCount = () => G.units.filter((u) => u.alive && u.role === 'merc').length;

  // ---------- Смерть ----------
  D.onDeath = function (victim, killer, cause) {
    const s = G.state, p = G.player;
    if (victim.isPlayer) {
      const how = cause === 'bleed' ? 'Вы истекли кровью. Надо было перевязать рану (H)...' : killer ? `Вас убил: ${killer.name}.` : 'Вы погибли.';
      G.UI.showDeath(how);
      return;
    }
    G.corpses.push(victim);
    if (G.corpses.length > 50) G.corpses.shift().removeFromScene();
    if (killer === p) s.kills++;
    if (victim.role === 'emperor') {
      D.t.emperor = 180;
      if (killer === p && s.faction === 'villain') { s.emperorKilled = true; G.UI.msg('ВЫ УБИЛИ ИМПЕРАТОРА! Империя в смятении!', '#ce93d8'); }
      else G.UI.msg('Император убит!', '#ff5252');
    }
    if (victim.role === 'boss') { D.t.boss = 240; G.UI.msg('Злой повержен!', '#ffd54f'); }
    const m = s.mission, def = D.missionDef();
    if (m && def && !m.done) {
      const byUs = killer && (killer === p || killer.faction === p.faction);
      if (def.kill && byUs && def.kill.includes(victim.faction)) {
        m.progress++;
        if (m.progress >= def.count) D.completeMission();
      }
      if (def.spy && victim.id === m.targetId) D.completeMission();
      if (def.role && victim.role === def.role) D.completeMission();
    }
  };

  // ---------- Приказы и задания ----------
  D.MISSIONS = {
    guard: [
      { text: 'Отбей нападение на дворец: убей 5 врагов.', kill: ['villain', 'elves'], count: 5, reward: 80,
        start() { D.spawnRaid('villain', 'palace', 3, { announce: true }); D.spawnRaid('elves', 'palace', 3); } },
      { text: 'Набег на эльфов! Отряд ждёт тебя. Иди в лес на западе и убей 6 эльфов.', kill: ['elves'], count: 6, reward: 130, squad: 4 },
      { text: 'В городе людей (на юге) прячется шпион эльфов в сером капюшоне. Найди и убей его.', spy: true, reward: 90,
        start() { D.spawnSpy(); } },
      { text: 'Набег на старый форт Злого в горах на севере: убей 8 его воинов.', kill: ['villain'], count: 8, reward: 220, squad: 6 },
      { text: 'Главный приказ: убей самого Злого в его форте!', role: 'boss', reward: 500, squad: 6,
        start() { if (!D.findRole('boss')) D.spawnSpecial('boss'); } },
    ],
    elves: [
      { text: 'Ограбь корован на дороге между городом людей и дворцом: подойди к повозке и нажми E.', rob: 1, reward: 40,
        start() { D.spawnCaravan(); } },
      { text: 'Защити деревню! Солдаты дворца уже идут — убей 5.', kill: ['guard'], count: 5, reward: 60,
        start() { D.spawnRaid('guard', 'elves', 5, { announce: true }); } },
      { text: 'Партизанский набег на форт Злого в горах: убей 5 его воинов.', kill: ['villain'], count: 5, reward: 120, squad: 4 },
      { text: 'Ограбь ещё 2 корована.', rob: 2, reward: 90, start() { D.spawnCaravan(); } },
      { text: 'Набег на дворец императора: убей 6 стражников.', kill: ['guard'], count: 6, reward: 160, squad: 5 },
    ],
  };

  D.missionDef = function () {
    const s = G.state, list = D.MISSIONS[s.faction];
    if (!list || !s.mission) return null;
    return list[s.mission.idx % list.length];
  };

  D.nextMissionDef = function () {
    const list = D.MISSIONS[G.state.faction];
    return list ? list[G.state.missionIdx % list.length] : null;
  };

  D.startMission = function () {
    const s = G.state, def = D.nextMissionDef();
    if (!def) return;
    s.mission = { idx: s.missionIdx, progress: 0, done: false, targetId: null };
    if (def.start) def.start();
    if (def.squad) D.makeSquad(def.squad);
    G.UI.msg('Новый приказ: ' + def.text, '#ffe082');
  };

  D.restoreMission = function () {
    const s = G.state, def = D.missionDef();
    if (!def || s.mission.done) return;
    if (def.spy) D.spawnSpy();
    if (def.rob) D.spawnCaravan();
  };

  D.completeMission = function () {
    const m = G.state.mission;
    if (!m || m.done) return;
    m.done = true;
    const who = G.state.faction === 'guard' ? 'командиру' : 'старейшине';
    G.UI.msg(`Задание выполнено! Вернитесь к ${who} за наградой.`, '#b9f6ca');
  };

  D.claimReward = function () {
    const s = G.state, def = D.missionDef();
    if (!s.mission || !s.mission.done || !def) return 0;
    s.gold += def.reward;
    s.mission = null;
    s.missionIdx++;
    return def.reward;
  };

  D.cancelMission = function () {
    const s = G.state;
    if (s.faction === 'guard') {
      const fine = Math.min(20, s.gold);
      s.gold -= fine;
      G.UI.msg(`Командир: «Ослушался приказа?!» Штраф ${fine} золота.`, '#ff8a65');
    }
    s.mission = null;
  };

  D.missionText = function () {
    const s = G.state;
    if (s.faction === 'villain') {
      return '<b>Вы — Злой.</b> Сам себе командир.<br>R — войска за мной · T — все в атаку на дворец · G — все в форт<br>' +
        (s.emperorKilled ? 'Император убит! Империя в смятении.' : 'Цель: убить императора во дворце (на востоке).');
    }
    const m = s.mission, def = D.missionDef();
    if (!m || !def) {
      return s.faction === 'guard'
        ? 'Нет приказа. Поговорите с <b>командиром</b> во дворце (E). Надо слушаться командира!'
        : 'Поговорите со <b>старейшиной</b> в центре деревни (E).';
    }
    if (m.done) return `<b>Выполнено!</b> Вернитесь к ${s.faction === 'guard' ? 'командиру' : 'старейшине'} за наградой.`;
    const prog = def.count ? ` (${m.progress}/${def.count})` : def.rob ? ` (${m.progress}/${def.rob})` : '';
    return `<b>${s.faction === 'guard' ? 'Приказ' : 'Задание'}:</b> ${def.text}${prog}`;
  };

  D.spawnSpy = function () {
    const T = G.World.ZONES.town;
    const p = freePoint(T.x + G.rand(-20, 20), T.z + G.rand(-15, 15), 4);
    const spy = D.spawn('elves', 'spy', p.x, p.z, { homeX: T.x, homeZ: T.z, homeR: 22, aggro: 5 });
    if (G.state.mission) G.state.mission.targetId = spy.id;
    return spy;
  };

  D.makeSquad = function (n) {
    const p = G.player;
    const cands = G.units
      .filter((u) => u.alive && !u.isPlayer && u.faction === p.faction && !SPECIAL.has(u.role) && !u.hates.has(p.id))
      .sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos))
      .slice(0, n);
    for (const u of cands) { u.ai.order = { type: 'follow' }; u.base = null; }
    for (let i = cands.length; i < n; i++) {
      const q = freePoint(p.pos.x, p.pos.z, 5);
      D.spawn(p.faction, 'warrior', q.x, q.z, { order: { type: 'follow' } });
    }
    G.UI.msg(`Отряд из ${n} бойцов идёт за вами.`, '#b9f6ca');
  };

  function routeFrom(u, route) {
    let bi = 0, bd = 1e18;
    route.forEach((pt, i) => { const d = G.dist2(pt.x, pt.z, u.pos.x, u.pos.z); if (d < bd) { bd = d; bi = i; } });
    return clonePts(route.slice(bi));
  }

  D.command = function (cmd) {
    const p = G.player, f = p.faction;
    const mine = () => G.units.filter((u) => u.alive && !u.isPlayer && u.faction === f && !SPECIAL.has(u.role) && !u.hates.has(p.id));
    if (cmd === 'follow') {
      const cands = mine().filter((u) => u.pos.distanceToSquared(p.pos) < 45 * 45)
        .sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos));
      const n = f === 'villain' ? cands.length : Math.min(6, cands.length);
      for (let i = 0; i < n; i++) { cands[i].ai.order = { type: 'follow' }; cands[i].ai.target = null; }
      G.UI.msg(n ? `«За мной!» — ${n} бойцов идут за вами.` : 'Рядом нет ваших бойцов.', '#b9f6ca');
    } else if (cmd === 'attack') {
      if (f !== 'villain') {
        G.UI.msg(f === 'guard' ? 'Без приказа командира в атаку нельзя! Слушайтесь командира.' : 'Эльфы не идут в атаку без старейшины. (T — приказ для Злого)', '#ffab40');
        return;
      }
      const army = mine();
      for (const u of army) { u.ai.order = { type: 'march', pts: routeFrom(u, VILLAIN_ROUTE) }; u.base = null; }
      for (let i = 0; i < 4; i++) {
        const q = freePoint(BASES.villain.x, BASES.villain.z, 8);
        D.spawn('villain', 'warrior', q.x, q.z, { order: { type: 'march', pts: clonePts(VILLAIN_ROUTE) } });
      }
      G.UI.msg(`Все в атаку на дворец! За Злым идут ${army.length + 4} воинов.`, '#ce93d8');
    } else if (cmd === 'home') {
      const b = BASES[f];
      const list = mine().filter((u) => u.ai.order && (u.ai.order.type === 'follow' || u.ai.order.type === 'march'));
      for (const u of list) {
        let pts = [{ x: b.x, z: b.z }];
        if (f === 'villain') pts = routeFrom(u, VILLAIN_ROUTE.slice().reverse()).concat([{ x: b.x, z: b.z }]);
        else if (f === 'guard' && Math.abs(u.pos.x - 230) > 44) pts = [{ x: 178, z: -30 }, { x: b.x, z: b.z }];
        u.ai.order = { type: 'march', pts };
        u.base = f;
        u.home = { x: b.x, z: b.z, r: b.r };
      }
      G.UI.msg(list.length ? `Отряд (${list.length}) возвращается на базу.` : 'Некого отпускать.', '#b9f6ca');
    }
  };
})(window.G);
