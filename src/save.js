// Сохранение и загрузка (localStorage браузера).
(function (G) {
  const S = (G.Save = { KEY: 'elves-korovany-save-v1' });

  S.has = function () {
    try { return !!localStorage.getItem(S.KEY); } catch (e) { return false; }
  };

  S.save = function () {
    const p = G.player, s = G.state;
    if (!p || !p.alive) { G.UI.msg('Мёртвые не сохраняются.', '#ff8a65'); return false; }
    const data = {
      v: 1, faction: s.faction, x: p.pos.x, z: p.pos.z, yaw: p.yaw, hp: p.hp, maxHp: p.maxHp, armor: p.armor,
      gold: s.gold, weapons: [...s.weapons], weapon: p.weaponId, inv: s.inv, body: G.Injuries.serialize(p.body),
      mission: s.mission ? { idx: s.mission.idx, progress: s.mission.progress, done: s.mission.done } : null,
      missionIdx: s.missionIdx, kills: s.kills, ownsHouse: s.ownsHouse, emperorKilled: s.emperorKilled,
      playTime: s.playTime, savedAt: Date.now(),
    };
    try {
      localStorage.setItem(S.KEY, JSON.stringify(data));
      G.UI.msg('Игра сохранена.', '#b9f6ca');
      return true;
    } catch (e) {
      G.UI.msg('Не удалось сохранить: браузер запретил хранилище.', '#ff5252');
      return false;
    }
  };

  S.read = function () {
    try {
      const raw = localStorage.getItem(S.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  S.load = function () {
    const d = S.read();
    if (!d) { if (G.running) G.UI.msg('Сохранений нет.', '#ff8a65'); return; }
    G.Game.start(d.faction, d);
    G.UI.msg('Сохранение загружено.', '#b9f6ca');
  };

  S.apply = function (d) {
    const p = G.player, s = G.state;
    p.pos.set(d.x, G.World.height(d.x, d.z), d.z);
    p.yaw = d.yaw || 0;
    G.PlayerCtl.yaw = p.yaw;
    p.maxHp = d.maxHp || p.maxHp;
    p.hp = Math.min(p.maxHp, d.hp || p.maxHp);
    p.armor = d.armor || 0;
    s.gold = d.gold || 0;
    s.weapons = new Set(d.weapons || ['fists']);
    Object.assign(s.inv, d.inv || {});
    s.kills = d.kills || 0;
    s.ownsHouse = !!d.ownsHouse;
    s.emperorKilled = !!d.emperorKilled;
    s.missionIdx = d.missionIdx || 0;
    s.mission = d.mission ? Object.assign({ targetId: null }, d.mission) : null;
    s.playTime = d.playTime || 0;
    p.body = G.Injuries.deserialize(d.body);
    p.weaponId = s.weapons.has(d.weapon) ? d.weapon : 'fists';
    p.syncModel(true);
    G.World.setHouseOwned(s.ownsHouse);
    if (s.mission) G.Director.restoreMission();
  };
})(window.G);
