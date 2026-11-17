// Персонажи: 3Д-человечки с отделяемыми конечностями, оружие, анимация, смерть (трупы остаются 3Д).
(function (G) {
  const I = G.Injuries;

  G.WEAPONS = {
    fists: { name: 'Кулаки', dmg: 6, range: 1.6, cd: 0.5, sever: 0, price: 0 },
    dagger: { name: 'Кинжал', dmg: 13, range: 1.9, cd: 0.42, sever: 0.08, price: 20 },
    sword: { name: 'Меч', dmg: 22, range: 2.4, cd: 0.65, sever: 0.2, price: 60 },
    axe: { name: 'Секира', dmg: 30, range: 2.5, cd: 0.9, sever: 0.38, price: 110 },
    bow: { name: 'Лук', dmg: 22, range: 40, cd: 0.85, sever: 0.06, ranged: true, price: 50 },
    blackaxe: { name: 'Чёрный топор Злого', dmg: 42, range: 2.8, cd: 0.9, sever: 0.5, price: 0 },
  };
  G.WEAPON_ORDER = ['fists', 'dagger', 'sword', 'axe', 'bow', 'blackaxe'];
  G.FACTION_NAMES = { elves: 'Эльфы', guard: 'Охрана дворца', villain: 'Войска Злого', town: 'Люди', caravan: 'Корован' };
  G.FACTION_COLORS = { elves: '#43a047', guard: '#e53935', villain: '#ab47bc', town: '#bcaaa4', caravan: '#ffd54f' };
  const MAIN = ['elves', 'guard', 'villain'];

  G.hostile = function (a, b, ignoreAlive) {
    if (a === b) return false;
    if (!ignoreAlive && (!a.alive || !b.alive)) return false;
    if (a.hates.has(b.id) || b.hates.has(a.id)) return true;
    if (a.hatesFactions.has(b.faction) || b.hatesFactions.has(a.faction)) return true;
    if (a.faction === b.faction) return false;
    return MAIN.includes(a.faction) && MAIN.includes(b.faction);
  };

  const SKINS = [0xf1d3b3, 0xe0b894, 0xc68e5f, 0x8d5a3b];
  function lookFor(faction, role) {
    const L = { skin: G.pick(SKINS), shirt: 0x795548, pants: 0x4e342e, hat: null, hatColor: 0x333333, trim: 0x3e2723,
      ears: false, cape: null, scale: 1, eye: 0x111111, beard: false };
    if (faction === 'elves') {
      Object.assign(L, { skin: 0xf3dcc0, shirt: G.pick([0x2e7d32, 0x388e3c, 0x1b5e20, 0x558b2f]), pants: 0x5d4037,
        hat: 'elf', hatColor: 0x33691e, ears: true, trim: 0x8d6e63 });
    } else if (faction === 'guard') {
      Object.assign(L, { shirt: 0xb71c1c, pants: 0x37474f, hat: 'helmet', hatColor: 0xb0bec5, trim: 0xffc107 });
    } else if (faction === 'villain') {
      Object.assign(L, { skin: 0x8a9a7b, shirt: 0x2b2233, pants: 0x1a1a1a, hat: 'horns', hatColor: 0x1c1c1c, trim: 0x6a1b9a, eye: 0xff1744 });
    } else if (faction === 'caravan') {
      Object.assign(L, { shirt: 0xc9a227, pants: 0x5d4037, hat: 'cap', hatColor: 0x6d4c41 });
    } else {
      Object.assign(L, { shirt: G.pick([0x795548, 0x5d7fa3, 0xa1887f, 0x8e9a5b, 0x9c6b4e]), hat: G.pick([null, 'cap', null]), hatColor: 0x5d4037 });
    }
    switch (role) {
      case 'commander': Object.assign(L, { hat: 'plume', cape: 0x8e0000, trim: 0xffd54f }); break;
      case 'emperor': Object.assign(L, { hat: 'crown', hatColor: 0xffd54f, shirt: 0xf9a825, cape: 0x4a148c }); break;
      case 'boss': Object.assign(L, { hat: 'horns', scale: 1.3, cape: 0x8b0000, shirt: 0x111111, skin: 0x6d7b63, eye: 0xff1744 }); break;
      case 'spy': Object.assign(L, { hat: 'hood', hatColor: 0x616161, shirt: 0x616161, ears: false }); break;
      case 'partisan': Object.assign(L, { hat: 'hood', hatColor: 0x2e5d2e }); break;
      case 'elder': Object.assign(L, { hat: 'elf', hatColor: 0xeeeeee, shirt: 0xf5f5f5, beard: true }); break;
      case 'merchant': Object.assign(L, { shirt: 0x1565c0, hat: 'cap', hatColor: 0x0d47a1 }); break;
      case 'healer': Object.assign(L, { shirt: 0xfafafa, hat: 'cap', hatColor: 0x43a047 }); break;
      case 'merc': Object.assign(L, { shirt: 0x546e7a, hat: 'helmet', hatColor: 0x78909c, ears: false }); break;
    }
    return L;
  }
  G.lookFor = lookFor;

  const NAMES = {
    elves: 'Эльф', guard: 'Стражник', villain: 'Воин Злого', town: 'Горожанин', caravan: 'Охранник корована',
    archer_elves: 'Эльф-лучник', archer_guard: 'Стрелок дворца', commander: 'Командир стражи', emperor: 'Император',
    boss: 'Злой', spy: 'Шпион', partisan: 'Партизан-эльф', elder: 'Старейшина эльфов', merchant: 'Торговец',
    healer: 'Лекарь', merc: 'Наёмник',
  };
  function defaultName(f, role) {
    if (role === 'archer') return NAMES['archer_' + f] || NAMES[f];
    return NAMES[role] || NAMES[f] || 'Некто';
  }

  function addHat(head, L) {
    const c = L.hatColor;
    const m = (geo, col, x, y, z) => { const o = new THREE.Mesh(geo, G.mat(col)); o.position.set(x, y, z); head.add(o); return o; };
    switch (L.hat) {
      case 'elf': { const o = m(new THREE.ConeGeometry(0.26, 0.6, 6), c, 0, 0.68, -0.06); o.rotation.x = -0.35; break; }
      case 'helmet':
      case 'plume': {
        m(new THREE.BoxGeometry(0.48, 0.22, 0.48), c, 0, 0.42, 0);
        m(new THREE.BoxGeometry(0.06, 0.18, 0.04), c, 0, 0.26, 0.23);
        if (L.hat === 'plume') m(new THREE.BoxGeometry(0.08, 0.3, 0.35), 0xd50000, 0, 0.66, -0.03);
        break;
      }
      case 'horns':
        for (const s of [-1, 1]) { const o = m(new THREE.ConeGeometry(0.07, 0.4, 6), 0xe0d6c0, 0.2 * s, 0.55, 0); o.rotation.z = -0.5 * s; }
        break;
      case 'crown':
        m(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 8, 1, true), c, 0, 0.5, 0).material = G.mat(c, { side: THREE.DoubleSide });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          m(new THREE.BoxGeometry(0.06, 0.12, 0.06), c, Math.sin(a) * 0.24, 0.62, Math.cos(a) * 0.24);
        }
        break;
      case 'hood': m(new THREE.BoxGeometry(0.5, 0.5, 0.5), c, 0, 0.27, -0.09); break;
      case 'cap':
        m(new THREE.BoxGeometry(0.46, 0.12, 0.46), c, 0, 0.5, 0);
        m(new THREE.BoxGeometry(0.46, 0.04, 0.2), c, 0, 0.46, 0.28);
        break;
    }
    if (L.ears) for (const s of [-1, 1]) { const o = m(new THREE.ConeGeometry(0.05, 0.25, 4), L.skin, 0.24 * s, 0.3, 0); o.rotation.z = -1.3 * s; }
    if (L.beard) m(new THREE.BoxGeometry(0.36, 0.3, 0.08), 0xf5f5f5, 0, 0.0, 0.22);
  }

  // Модель: root (позиция/поворот) -> body (наклон при ползании) -> части тела.
  // Персонаж смотрит вдоль +Z, его левая сторона — +X.
  const LIMB_POS = { armL: [0.42, 1.8, 0], armR: [-0.42, 1.8, 0], legL: [0.16, 0.98, 0], legR: [-0.16, 0.98, 0] };
  function buildHumanoid(L) {
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const body = new THREE.Group();
    body.scale.setScalar(L.scale || 1);
    root.add(body);
    const add = (w, h, d, c, x, y, z, parent) => { const o = G.box(w, h, d, c); o.position.set(x, y, z); (parent || body).add(o); return o; };
    add(0.62, 0.82, 0.34, L.shirt, 0, 1.44, 0);
    add(0.64, 0.12, 0.36, L.trim, 0, 1.08, 0);
    add(0.58, 0.2, 0.32, L.pants, 0, 0.98, 0);
    if (L.cape) { const c = add(0.62, 1.2, 0.05, L.cape, 0, 1.25, -0.2); c.rotation.x = 0.08; }
    const head = new THREE.Group();
    head.position.y = 1.86;
    body.add(head);
    add(0.42, 0.44, 0.42, L.skin, 0, 0.23, 0, head);
    const eyeL = add(0.08, 0.08, 0.03, L.eye, 0.1, 0.27, 0.215, head);
    const eyeR = add(0.08, 0.08, 0.03, L.eye, -0.1, 0.27, 0.215, head);
    addHat(head, L);
    return { root, body, head, look: L, pivots: { armL: null, armR: null, legL: null, legR: null }, eyes: { eyeL, eyeR }, wheelchair: null };
  }

  function makeLimb(model, slot, kind) {
    const L = model.look;
    const p = new THREE.Group();
    p.position.set(...LIMB_POS[slot]);
    p.userData.kind = kind;
    const add = (w, h, d, c, x, y, z) => { const o = G.box(w, h, d, c); o.position.set(x, y, z); p.add(o); return o; };
    if (slot.startsWith('arm')) {
      if (kind === 'flesh') {
        add(0.2, 0.6, 0.22, L.shirt, 0, -0.3, 0);
        add(0.17, 0.2, 0.18, L.skin, 0, -0.7, 0);
      } else {
        add(0.12, 0.62, 0.12, 0x9e9e9e, 0, -0.31, 0);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 10, Math.PI * 1.4), G.mat(0xcfd8dc));
        hook.position.y = -0.72;
        p.add(hook);
      }
    } else if (kind === 'flesh') {
      add(0.24, 0.85, 0.26, L.pants, 0, -0.43, 0);
      add(0.26, 0.14, 0.34, 0x3b2a1e, 0, -0.91, 0.04);
    } else {
      add(0.2, 0.2, 0.22, L.pants, 0, -0.1, 0);
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.8, 6), G.mat(0x8d6e63));
      peg.position.y = -0.58;
      p.add(peg);
    }
    model.body.add(p);
    model.pivots[slot] = p;
    return p;
  }

  function makeWeapon(id) {
    const g = new THREE.Group();
    const steel = 0xcfd8dc, wood = 0x6d4c41;
    const add = (w, h, d, c, x, y, z) => { const o = G.box(w, h, d, c); o.position.set(x, y, z); g.add(o); };
    if (id === 'dagger') { add(0.05, 0.03, 0.42, steel, 0, 0, 0.3); add(0.18, 0.04, 0.05, 0x8d6e63, 0, 0, 0.08); }
    else if (id === 'sword') { add(0.07, 0.03, 1.0, steel, 0, 0, 0.62); add(0.32, 0.05, 0.06, 0xffc107, 0, 0, 0.1); add(0.05, 0.05, 0.2, wood, 0, 0, 0); }
    else if (id === 'axe') { add(0.05, 0.05, 1.1, wood, 0, 0, 0.45); add(0.04, 0.42, 0.3, steel, 0, 0.14, 0.88); }
    else if (id === 'blackaxe') { add(0.07, 0.07, 1.4, 0x212121, 0, 0, 0.6); add(0.05, 0.6, 0.42, 0x37474f, 0, 0.2, 1.15); add(0.05, 0.6, 0.1, 0xb71c1c, 0, 0.2, 1.38); }
    else if (id === 'bow') {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 4, 14, Math.PI), G.mat(wood));
      arc.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
      g.add(arc);
      add(0.01, 1.1, 0.01, 0xeeeeee, 0, 0, 0);
    }
    return g;
  }

  function makeWheelchair() {
    const g = new THREE.Group();
    const add = (w, h, d, c, x, y, z) => { const o = G.box(w, h, d, c); o.position.set(x, y, z); g.add(o); };
    add(0.62, 0.08, 0.6, 0x37474f, 0, 0.55, -0.05);
    add(0.62, 0.6, 0.06, 0x37474f, 0, 0.88, -0.36);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), G.mat(0x263238));
      w.rotation.z = Math.PI / 2; w.position.set(0.37 * s, 0.42, -0.1); g.add(w);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8), G.mat(0x263238));
      f.rotation.z = Math.PI / 2; f.position.set(0.26 * s, 0.1, 0.32); g.add(f);
      add(0.04, 0.04, 0.7, 0x90a4ae, 0.3 * s, 0.5, 0);
    }
    return g;
  }

  const shadowGeo = new THREE.CircleGeometry(0.55, 12);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  const EYE_LOST = 0x8b0000, EYE_PROS = 0x00e5ff;
  let NEXT_ID = 1;

  class Unit {
    constructor(o) {
      this.id = NEXT_ID++;
      this.faction = o.faction;
      this.role = o.role || 'warrior';
      this.isPlayer = !!o.isPlayer;
      this.name = o.name || defaultName(this.faction, this.role);
      this.maxHp = o.hp || 60;
      this.hp = this.maxHp;
      this.armor = o.armor || 0;
      this.pos = new THREE.Vector3(o.x, G.World.height(o.x, o.z), o.z);
      this.vy = 0;
      this.onGround = true;
      this.yaw = o.yaw != null ? o.yaw : Math.random() * Math.PI * 2;
      this.body = I.createBody();
      this.alive = true;
      this.hates = new Set();
      this.hatesFactions = new Set();
      this.gold = o.gold != null ? o.gold : G.randInt(1, 12);
      this.loot = [];
      this.base = o.base || null;
      this.home = { x: o.homeX != null ? o.homeX : o.x, z: o.homeZ != null ? o.homeZ : o.z, r: o.homeR != null ? o.homeR : 15 };
      this.homeYaw = o.yaw != null ? o.yaw : null;
      this.ai = { think: Math.random() * 0.4, target: null, order: o.order || null, wanderT: 0, wx: null, wz: null, aggro: o.aggro || 28 };
      this.attackCd = 0;
      this.swingT = -1;
      this.aimT = 0;
      this.walkPhase = Math.random() * 6;
      this.moving = false;
      this.moveSpeed = 0;
      this.bleedFx = 0;
      this.npcBandage = G.rand(8, 25);
      this.look = o.look || lookFor(this.faction, this.role);
      this.scale = this.look.scale || 1;
      this.model = buildHumanoid(this.look);
      this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
      this.shadow.position.y = 0.04;
      this.shadow.scale.setScalar(this.scale);
      this.model.root.add(this.shadow);
      G.scene.add(this.model.root);
      this.weaponId = o.weapon || 'fists';
      this.weaponMesh = null;
      this.syncModel(true);
      this.model.root.position.copy(this.pos);
      this.model.root.rotation.y = this.yaw;
    }

    get weapon() { return G.WEAPONS[this.weaponId] || G.WEAPONS.fists; }
    get mobility() { return I.mobility(this.body); }

    chest() {
      const crawl = this.mobility.mode === 'crawl';
      return new THREE.Vector3(this.pos.x, this.pos.y + (crawl ? 0.4 : 1.4 * this.scale), this.pos.z);
    }
    headPos() {
      return new THREE.Vector3(this.pos.x, this.pos.y + 2.05 * this.scale, this.pos.z);
    }
    hitSpheres() {
      if (!this.alive) return [];
      if (this.mobility.mode === 'crawl') {
        const f = 0.8 * this.scale;
        return [new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * f, this.pos.y + 0.3, this.pos.z + Math.cos(this.yaw) * f)];
      }
      const s = this.scale, y = this.pos.y;
      return [0.5, 1.25, 1.95].map((h) => new THREE.Vector3(this.pos.x, y + h * s, this.pos.z));
    }

    // Приводит модель в соответствие с телом: конечности, протезы, глаза, оружие.
    syncModel(silent) {
      const m = this.model;
      for (const slot of I.LIMBS) {
        const should = I.functional(this.body, slot);
        const kind = this.body.lost[slot] ? 'prosthetic' : 'flesh';
        const piv = m.pivots[slot];
        if (should && (!piv || piv.userData.kind !== kind)) {
          if (piv && piv.parent === m.body) m.body.remove(piv);
          makeLimb(m, slot, kind);
        } else if (!should && piv) {
          if (piv.parent === m.body) m.body.remove(piv);
          m.pivots[slot] = null;
        }
      }
      for (const e of I.EYES) {
        const c = this.body.lost[e] ? (this.body.prosthetic[e] ? EYE_PROS : EYE_LOST) : this.look.eye;
        m.eyes[e].material = this.body.prosthetic[e] && this.body.lost[e] ? G.mat(c, { emissive: 0x00a0b0 }) : G.mat(c);
      }
      this.setWeapon(this.weaponId);
    }

    setWeapon(id) {
      this.weaponId = id;
      if (this.weaponMesh && this.weaponMesh.parent) this.weaponMesh.parent.remove(this.weaponMesh);
      this.weaponMesh = null;
      this.weaponArm = null;
      if (id === 'fists') return;
      const P = this.model.pivots;
      const slot = id === 'bow' ? (P.armL ? 'armL' : P.armR ? 'armR' : null) : (P.armR ? 'armR' : P.armL ? 'armL' : null);
      if (!slot) return;
      const w = makeWeapon(id);
      w.position.y = -0.72;
      P[slot].add(w);
      this.weaponMesh = w;
      this.weaponArm = slot;
    }

    severLimb(slot) {
      const piv = this.model.pivots[slot];
      if (!piv) return;
      const hadWeapon = this.weaponMesh && this.weaponMesh.parent === piv;
      G.scene.attach(piv); // сохраняет мировое положение — конечность отлетает с того же места
      G.FX.addDebris(piv);
      this.model.pivots[slot] = null;
      G.FX.blood(piv.getWorldPosition(new THREE.Vector3()), 14);
      if (hadWeapon) this.weaponMesh = null;
      this.setWeapon(this.weaponId); // оружие перехватывает уцелевшая рука
    }

    move(dx, dz, speed, dt) {
      const v = speed * this.mobility.speedMul;
      this.pos.x += dx * v * dt;
      this.pos.z += dz * v * dt;
      this.resolveCollisions();
      this.moving = true;
      this.moveSpeed = v;
    }

    resolveCollisions() {
      const r = 0.45 * this.scale, p = this.pos;
      for (const c of G.World.colliders) {
        if (p.x > c.minX - r && p.x < c.maxX + r && p.z > c.minZ - r && p.z < c.maxZ + r) {
          const pl = p.x - (c.minX - r), pr = c.maxX + r - p.x, pt = p.z - (c.minZ - r), pb = c.maxZ + r - p.z;
          const mn = Math.min(pl, pr, pt, pb);
          if (mn === pl) p.x = c.minX - r;
          else if (mn === pr) p.x = c.maxX + r;
          else if (mn === pt) p.z = c.minZ - r;
          else p.z = c.maxZ + r;
        }
      }
      G.Trees.collide(p, r);
      p.x = G.clamp(p.x, -338, 338);
      p.z = G.clamp(p.z, -338, 338);
    }

    startSwing() {
      if (this.attackCd > 0 || this.swingT >= 0 || !this.alive) return false;
      const P = this.model.pivots;
      this.swingArm = this.weaponArm || (P.armR ? 'armR' : P.armL ? 'armL' : null);
      this.swingT = 0;
      this.swingHitDone = false;
      this.attackCd = this.weapon.cd;
      return true;
    }

    onDamaged(att) {
      if (!att || att === this) return;
      this.lastAttacker = att;
      if (!G.hostile(this, att, true)) {
        this.hates.add(att.id);
        if (this.faction === 'town' || this.faction === 'caravan') {
          for (const o of G.units) {
            if (o.alive && o.faction === this.faction && o.pos.distanceToSquared(this.pos) < 900) o.hates.add(att.id);
          }
        }
        if (att.isPlayer && this.faction === att.faction) G.UI.msg(`Вы ударили своего! ${this.name} теперь ваш враг.`, '#ffab40');
      }
      if (!this.isPlayer) {
        const t = this.ai.target;
        if (!t || !t.alive || t.pos.distanceToSquared(this.pos) > att.pos.distanceToSquared(this.pos) + 4) this.ai.target = att;
      }
    }

    die(killer, cause) {
      if (!this.alive) return;
      this.alive = false;
      this.hp = 0;
      this.deathT = 0;
      this.swingT = -1;
      this.fallDir = Math.random() < 0.5 ? -1 : 1;
      this.deathCause = cause;
      this.killer = killer || null;
      this.shadow.visible = false;
      G.Director.onDeath(this, killer, cause);
    }

    update(dt) {
      if (!this.alive) { this.updateCorpse(dt); return; }
      if (this.body.bleeding > 0) {
        this.hp -= I.bleedDamage(this.body, dt);
        this.bleedFx -= dt;
        if (this.bleedFx <= 0) { this.bleedFx = 0.35; G.FX.drip(this.pos); }
        if (!this.isPlayer) {
          this.npcBandage -= dt;
          if (this.npcBandage <= 0) {
            if (Math.random() < 0.5) I.bandage(this.body);
            this.npcBandage = 1e9;
          }
        }
        if (this.hp <= 0) { this.die(this.lastAttacker, 'bleed'); this.moving = false; return; }
      }
      const gy = G.World.height(this.pos.x, this.pos.z);
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gy || (this.vy <= 0 && this.pos.y - gy < 0.35 && this.onGround)) {
        this.pos.y = gy;
        this.vy = 0;
        this.onGround = true;
      } else {
        this.onGround = false;
      }
      this.attackCd -= dt;
      this.animate(dt);
      this.model.root.position.copy(this.pos);
      this.model.root.rotation.y = this.yaw;
      this.moving = false;
    }

    animate(dt) {
      const m = this.model, P = m.pivots, mob = this.mobility;
      if (this.moving) this.walkPhase += dt * (2 + this.moveSpeed * 1.4);
      const sw = this.moving ? Math.sin(this.walkPhase) : 0;
      const k = Math.min(1, dt * 10);
      let bx = 0, by = 0;
      if (mob.mode === 'crawl') { bx = 1.35; by = 0.25; }
      else if (mob.mode === 'wheelchair') { by = -0.42; }
      m.body.rotation.x = G.lerp(m.body.rotation.x, bx, k);
      m.body.position.y = G.lerp(m.body.position.y, by * this.scale, k);
      if (mob.mode === 'wheelchair' && !m.wheelchair) {
        m.wheelchair = makeWheelchair();
        m.wheelchair.scale.setScalar(this.scale);
        m.root.add(m.wheelchair);
      }
      if (m.wheelchair) m.wheelchair.visible = mob.mode === 'wheelchair';
      const legRot = (s) => (mob.mode === 'wheelchair' ? -1.25 : mob.mode === 'crawl' ? 0.15 * s * sw : s * sw * 0.75);
      if (P.legL) P.legL.rotation.x = legRot(1);
      if (P.legR) P.legR.rotation.x = legRot(-1);
      const armRot = (s) => (mob.mode === 'crawl' ? -2.7 + s * sw * 0.5 : mob.mode === 'wheelchair' ? -0.5 + s * sw * 0.6 : -s * sw * 0.6);
      if (P.armL) P.armL.rotation.x = armRot(1);
      if (P.armR) P.armR.rotation.x = armRot(-1);
      if (this.aimT > 0) {
        this.aimT -= dt;
        if (P.armL) P.armL.rotation.x = -1.5;
        if (P.armR) P.armR.rotation.x = -1.4;
      }
      if (this.swingT >= 0) {
        const d = Math.min(0.42, this.weapon.cd * 0.85);
        this.swingT += dt;
        const p = this.swingT / d;
        const arm = this.swingArm && P[this.swingArm];
        if (arm) arm.rotation.x = p < 0.35 ? G.lerp(0, -2.8, p / 0.35) : G.lerp(-2.8, -0.3, Math.min(1, (p - 0.35) / 0.65));
        if (!this.swingHitDone && p >= 0.55) {
          this.swingHitDone = true;
          G.Combat.meleeHit(this);
        }
        if (p >= 1) this.swingT = -1;
      }
      if (this.weaponId === 'bow' && this.weaponMesh && this.weaponMesh.parent) {
        this.weaponMesh.rotation.x = -this.weaponMesh.parent.rotation.x;
      }
    }

    updateCorpse(dt) {
      const gy = G.World.height(this.pos.x, this.pos.z);
      if (this.pos.y > gy) {
        this.vy -= 22 * dt;
        this.pos.y = Math.max(gy, this.pos.y + this.vy * dt);
      } else this.pos.y = gy;
      if (this.deathT < 1) {
        this.deathT = Math.min(1, this.deathT + dt * 1.8);
        const t = this.deathT;
        this.model.root.rotation.x = (this.fallDir * Math.PI) / 2 * t * t;
        this.model.body.rotation.x *= 1 - t;
        this.model.body.position.y *= 1 - t;
        if (this.model.wheelchair) this.model.wheelchair.visible = false;
      }
      this.model.root.position.set(this.pos.x, this.pos.y + 0.18 * this.scale * this.deathT, this.pos.z);
      this.model.root.rotation.y = this.yaw;
    }

    removeFromScene() {
      G.scene.remove(this.model.root);
    }
  }

  G.Unit = Unit;
})(window.G);
