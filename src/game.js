// Главный цикл: создание сцены, старт игры за выбранную сторону, обновление мира.
(function (G) {
  const Game = (G.Game = {});
  G.units = [];
  G.corpses = [];
  G.running = false;

  const PLAYER_SETUP = {
    elves: { x: -214, z: -20, hp: 90, weapons: ['fists', 'dagger', 'bow'], weapon: 'bow', gold: 30, inv: { bandage: 2, potion: 1 }, yaw: Math.PI / 2 },
    guard: { x: 196, z: -36, hp: 110, armor: 0.2, weapons: ['fists', 'sword'], weapon: 'sword', gold: 50, inv: { bandage: 2, potion: 1 }, yaw: -Math.PI / 2 },
    villain: { x: 0, z: -238, hp: 220, armor: 0.15, weapons: ['fists', 'blackaxe'], weapon: 'blackaxe', gold: 150, inv: { bandage: 3, potion: 2 }, yaw: 0,
      role: 'boss', name: 'Злой (вы)' },
  };

  Game.init = function () {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game').appendChild(renderer.domElement);
    G.renderer = renderer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8c6e0);
    scene.fog = new THREE.Fog(0xa8c6e0, 70, 400);
    G.scene = scene;
    G.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 900);
    scene.add(new THREE.HemisphereLight(0xdff0ff, 0x45502c, 0.8));
    const sun = new THREE.DirectionalLight(0xfff1d6, 0.75);
    sun.position.set(0.6, 1, 0.35);
    scene.add(sun);
    G.World.build();
    G.Trees.build();
    G.UI.init();
    G.PlayerCtl.init();
    window.addEventListener('resize', () => {
      G.camera.aspect = window.innerWidth / window.innerHeight;
      G.camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    Game.last = performance.now();
    requestAnimationFrame(Game.frame);
  };

  Game.clearDynamic = function () {
    for (const u of G.units) u.removeFromScene();
    for (const c of G.corpses) c.removeFromScene();
    G.units = [];
    G.corpses = [];
    G.player = null;
    G.Combat.clear();
    G.FX.clear();
    G.Director.clear();
  };

  Game.start = function (faction, save) {
    Game.clearDynamic();
    const S = PLAYER_SETUP[faction];
    G.state = {
      faction, gold: S.gold,
      inv: Object.assign({ bandage: 0, potion: 0, p_arm: 0, p_leg: 0, p_eye: 0, wheelchair: 0 }, S.inv),
      weapons: new Set(S.weapons), mission: null, missionIdx: 0, kills: 0, ownsHouse: false, emperorKilled: false, playTime: 0,
    };
    const p = new G.Unit({
      faction, role: 'player', isPlayer: true, x: S.x, z: S.z, hp: S.hp, armor: S.armor || 0, weapon: S.weapon,
      look: G.lookFor(faction, S.role || 'warrior'), name: S.name || 'Вы', gold: 0, yaw: S.yaw,
    });
    G.player = p;
    G.units.push(p);
    G.PlayerCtl.yaw = S.yaw;
    G.PlayerCtl.pitch = -0.12;
    G.PlayerCtl.keys = {};
    G.PlayerCtl.attackHeld = false;
    G.World.setHouseOwned(false);
    G.Director.init(faction);
    if (save) G.Save.apply(save);
    G.running = true;
    G.UI.startHUD();
    const intro = {
      elves: 'Вы — лесной эльф. Старейшина ждёт в центре деревни. Скоро набегут солдаты дворца…',
      guard: 'Вы — стражник дворца. Доложитесь командиру (E) и слушайтесь его приказов.',
      villain: 'Вы — Злой. Ваш старый форт в горах. R — войска за мной, T — все в атаку на дворец!',
    };
    if (!save) G.UI.msg(intro[faction], '#ffd77a');
    G.Trees.update(p.pos.x, p.pos.z, true);
  };

  Game.update = function (dt) {
    G.state.playTime += dt;
    G.PlayerCtl.update(dt);
    for (const u of G.units) if (!u.isPlayer && u.alive) G.AI.update(u, dt);
    for (const u of G.units) u.update(dt);
    G.units = G.units.filter((u) => u.alive || u.isPlayer);
    for (const c of G.corpses) c.update(dt);
    G.Combat.update(dt);
    G.FX.update(dt);
    G.Director.update(dt);
    if (G.World.fire) G.World.fire.scale.y = 0.8 + Math.random() * 0.4;
    const cam = G.camera.position;
    const vis = (u) => { u.model.root.visible = G.dist2(u.pos.x, u.pos.z, cam.x, cam.z) < 180 * 180; };
    G.units.forEach(vis);
    G.corpses.forEach(vis);
  };

  Game.menuCamera = function (t) {
    const V = G.World.VILLAGE, a = t * 0.06, r = 75;
    G.camera.position.set(V.x + Math.cos(a) * r, 22, V.z + Math.sin(a) * r);
    G.camera.lookAt(V.x, 4, V.z);
  };

  Game.frame = function (now) {
    requestAnimationFrame(Game.frame);
    const dt = Math.min((now - Game.last) / 1000, 0.05);
    Game.last = now;
    if (G.running) {
      if (!G.UI.isPaused()) Game.update(dt);
      G.PlayerCtl.updateCamera(dt);
      G.UI.update(dt);
    } else Game.menuCamera(now / 1000);
    const c = G.camera.position;
    G.Trees.update(c.x, c.z);
    G.renderer.render(G.scene, G.camera);
  };

  window.addEventListener('load', () => {
    if (!window.THREE) {
      document.body.innerHTML = '<p style="padding:20px;font:16px sans-serif;color:#fff">Не удалось загрузить Three.js. Проверьте, что файл vendor/three.min.js на месте.</p>';
      return;
    }
    Game.init();
  });
})(window.G);
