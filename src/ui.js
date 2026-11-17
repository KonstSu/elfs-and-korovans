// Интерфейс: меню, HUD, лавка «как в Daggerfall», лекарь, сумка, диалоги, карта, экран смерти.
(function (G) {
  const UI = (G.UI = { modalOpen: false, locked: false, hudT: 0, logItems: [], lastZone: null });
  const $ = (id) => document.getElementById(id);
  const I = G.Injuries;

  UI.init = function () {
    document.querySelectorAll('.fcard').forEach((el) => { el.onclick = () => G.Game.start(el.dataset.faction); });
    $('btnLoad').onclick = () => G.Save.load();
    $('modalClose').onclick = () => UI.closeModal();
    $('pause').onclick = () => { UI.hidePause(); UI.lock(); };
    $('btnPauseSave').onclick = (e) => { e.stopPropagation(); G.Save.save(); };
    $('btnPauseMenu').onclick = (e) => { e.stopPropagation(); UI.toMenu(); };
    $('btnDeathLoad').onclick = () => G.Save.load();
    $('btnDeathMenu').onclick = () => UI.toMenu();
    $('bigmap').onclick = () => UI.toggleMap();
    document.addEventListener('pointerlockchange', () => {
      UI.locked = document.pointerLockElement === G.renderer.domElement;
      if (!UI.locked && G.running && !UI.modalOpen && G.player && G.player.alive && $('death').classList.contains('hidden')) UI.showPause();
    });
    UI.mapImg = G.World.mapImage(256);
    UI.refreshMenu();
  };

  UI.refreshMenu = function () { $('btnLoad').disabled = !G.Save.has(); };

  UI.lock = function () {
    try {
      const r = G.renderer.domElement.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* без захвата курсора тоже можно играть */ }
  };
  UI.unlock = function () { if (document.pointerLockElement) document.exitPointerLock(); };

  UI.isPaused = () => UI.modalOpen || !$('pause').classList.contains('hidden');

  UI.startHUD = function () {
    for (const id of ['menu', 'death', 'pause', 'modal', 'bigmap']) $(id).classList.add('hidden');
    $('hud').classList.remove('hidden');
    UI.modalOpen = false;
    $('log').innerHTML = '';
    UI.logItems = [];
    UI.lastZone = null;
    UI.lock();
  };

  UI.toMenu = function () {
    G.running = false;
    G.Game.clearDynamic();
    for (const id of ['hud', 'death', 'pause', 'modal', 'bigmap']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden');
    UI.modalOpen = false;
    UI.unlock();
    UI.refreshMenu();
  };

  UI.showPause = function () { $('pause').classList.remove('hidden'); };
  UI.hidePause = function () { $('pause').classList.add('hidden'); };

  UI.msg = function (text, color) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.color = color || '#fff';
    $('log').appendChild(el);
    UI.logItems.push({ el, t: performance.now() });
    while (UI.logItems.length > 7) UI.logItems.shift().el.remove();
  };

  UI.hurt = function () {
    const h = $('hurt');
    h.style.transition = 'none';
    h.style.opacity = '1';
    requestAnimationFrame(() => { h.style.transition = 'opacity .5s'; h.style.opacity = '0'; });
  };

  UI.showDeath = function (text) {
    setTimeout(() => {
      if (!G.running || (G.player && G.player.alive)) return;
      $('deathCause').textContent = text;
      $('btnDeathLoad').disabled = !G.Save.has();
      UI.hidePause();
      $('death').classList.remove('hidden');
      UI.unlock();
    }, 1500);
  };

  // ---------- Модальные окна ----------
  UI.openModal = function (title, build) {
    UI.modalOpen = true;
    UI.unlock();
    $('modalTitle').textContent = title;
    const body = $('modalBody');
    body.innerHTML = '';
    build(body);
    $('modal').classList.remove('hidden');
  };
  UI.closeModal = function () {
    $('modal').classList.add('hidden');
    UI.modalOpen = false;
    if (G.running && G.player && G.player.alive) UI.lock();
  };

  function el(tag, html, cls) {
    const e = document.createElement(tag);
    if (html != null) e.innerHTML = html;
    if (cls) e.className = cls;
    return e;
  }
  function row(parent, left, price, btnText, enabled, fn) {
    const r = el('div', null, 'row');
    const l = el('span', left);
    r.appendChild(l);
    const right = el('span');
    if (price != null) right.appendChild(el('span', price + ' зол. ', 'price'));
    if (btnText) {
      const b = el('button', btnText);
      b.disabled = !enabled;
      b.onclick = fn;
      right.appendChild(b);
    }
    r.appendChild(right);
    parent.appendChild(r);
  }
  function goldLine(body) {
    body.appendChild(el('p', `У вас: <span class="gold">${G.state.gold} золота</span>`, 'muted'));
  }

  const SHOP = [
    ...['dagger', 'sword', 'axe', 'bow'].map((id) => ({
      name: () => `${G.WEAPONS[id].name} (урон ${G.WEAPONS[id].dmg})`,
      price: G.WEAPONS[id].price,
      owned: () => G.state.weapons.has(id),
      buy() { G.state.weapons.add(id); G.player.setWeapon(id); },
    })),
    { name: () => 'Бинт — останавливает кровотечение', price: 5, buy() { G.state.inv.bandage++; } },
    { name: () => 'Зелье лечения (+50 здоровья)', price: 15, buy() { G.state.inv.potion++; } },
    { name: () => 'Кольчуга (−30% урона)', price: 90, owned: () => G.player.armor >= 0.3, buy() { G.player.armor = 0.3; } },
    { name: () => 'Протез руки (железный крюк)', price: 80, buy() { G.state.inv.p_arm++; } },
    { name: () => 'Протез ноги (деревянный)', price: 100, buy() { G.state.inv.p_leg++; } },
    { name: () => 'Протез глаза (магический — видит!)', price: 70, buy() { G.state.inv.p_eye++; } },
    { name: () => 'Инвалидная коляска', price: 40, owned: () => G.state.inv.wheelchair > 0, buy() { G.state.inv.wheelchair = 1; } },
    { name: () => 'Нанять наёмника (пойдёт за вами, до 4)', price: 60, owned: () => G.Director.mercCount() >= 4, buy() { G.Director.hireMerc(); } },
    { name: () => 'Купить дом в городе (отдых и сохранение)', price: 400, owned: () => G.state.ownsHouse,
      buy() { G.state.ownsHouse = true; G.World.setHouseOwned(true); UI.msg('Теперь у вас есть дом в городе людей!', '#ffd54f'); } },
  ];

  UI.openShop = function (merchant) {
    if (merchant.hates.has(G.player.id)) { UI.msg('Торговец: «Не буду торговать с разбойником!»', '#ff8a65'); return; }
    UI.openModal('Лавка', (body) => {
      body.appendChild(el('p', '«Заходи, путник! Всё, что нужно воину, — и даже больше.»'));
      goldLine(body);
      for (const it of SHOP) {
        const owned = it.owned && it.owned();
        row(body, it.name(), it.price, owned ? 'Есть' : 'Купить', !owned && G.state.gold >= it.price, () => {
          G.state.gold -= it.price;
          it.buy();
          UI.openShop(merchant);
        });
      }
      body.appendChild(el('p', 'Протезы ставятся в сумке (I) или у лекаря.', 'muted'));
    });
  };

  function installAll() {
    const s = G.state, p = G.player, done = [];
    for (const kind of ['arm', 'leg', 'eye']) {
      while (s.inv['p_' + kind] > 0) {
        const slot = I.installProsthetic(p.body, kind);
        if (!slot) break;
        s.inv['p_' + kind]--;
        done.push(I.NAMES[slot]);
      }
    }
    p.syncModel();
    return done;
  }

  UI.openHealer = function (healer) {
    if (healer.hates.has(G.player.id)) { UI.msg('Лекарь отворачивается от вас.', '#ff8a65'); return; }
    const p = G.player, s = G.state;
    UI.openModal('Лекарь', (body) => {
      body.appendChild(el('p', '«Отрубили что-нибудь? Бывает. Садись, посмотрим.»'));
      goldLine(body);
      const hurt = p.hp < p.maxHp || p.body.bleeding > 0;
      row(body, 'Вылечить раны и остановить кровь', 15, 'Лечить', hurt && s.gold >= 15, () => {
        s.gold -= 15;
        p.hp = p.maxHp;
        I.bandage(p.body);
        UI.msg('Лекарь залечил ваши раны.', '#b9f6ca');
        UI.openHealer(healer);
      });
      const canPut = ['arm', 'leg', 'eye'].some((k) => s.inv['p_' + k] > 0 && I.installable(p.body, k).length);
      row(body, 'Поставить протезы из сумки', 0, 'Поставить', canPut, () => {
        const done = installAll();
        UI.msg('Лекарь поставил протез: ' + done.join(', '), '#b9f6ca');
        UI.openHealer(healer);
      });
      const lost = I.describe(p.body);
      body.appendChild(el('p', lost.length ? 'Ваши увечья: ' + lost.join(', ') : 'Вы целы. Пока что.', 'muted'));
    });
  };

  UI.openInventory = function () {
    const p = G.player, s = G.state;
    UI.openModal('Сумка', (body) => {
      goldLine(body);
      row(body, `Бинты: ${s.inv.bandage}`, null, 'Перевязать', s.inv.bandage > 0 && p.body.bleeding > 0, () => { G.PlayerCtl.useBandage(); UI.openInventory(); });
      row(body, `Зелья лечения: ${s.inv.potion}`, null, 'Выпить', s.inv.potion > 0 && p.hp < p.maxHp, () => { G.PlayerCtl.usePotion(); UI.openInventory(); });
      for (const kind of ['arm', 'leg', 'eye']) {
        const n = s.inv['p_' + kind];
        row(body, `Протез ${{ arm: 'руки', leg: 'ноги', eye: 'глаза' }[kind]}: ${n}`, null, 'Поставить', n > 0 && I.installable(p.body, kind).length > 0, () => {
          const slot = I.installProsthetic(p.body, kind);
          if (slot) { s.inv['p_' + kind]--; p.syncModel(); UI.msg('Вы поставили протез: ' + I.NAMES[slot], '#b9f6ca'); }
          UI.openInventory();
        });
      }
      if (s.inv.wheelchair > 0) {
        const sitting = p.body.wheelchair;
        row(body, 'Инвалидная коляска', null, sitting ? 'Встать' : 'Сесть', sitting || I.canSitInWheelchair(p.body), () => {
          p.body.wheelchair = !sitting;
          UI.msg(sitting ? 'Вы вылезли из коляски.' : 'Вы сели в коляску. Так быстрее, чем ползти!', '#b9f6ca');
          UI.openInventory();
        });
      }
      body.appendChild(el('h3', 'Оружие'));
      G.WEAPON_ORDER.filter((w) => s.weapons.has(w)).forEach((w, i) => {
        row(body, `${i + 1}. ${G.WEAPONS[w].name} (урон ${G.WEAPONS[w].dmg})`, null, p.weaponId === w ? 'В руках' : 'Взять', p.weaponId !== w, () => { p.setWeapon(w); UI.openInventory(); });
      });
      const lost = I.describe(p.body);
      body.appendChild(el('p', `Броня: ${Math.round(p.armor * 100)}% · Убито врагов: ${s.kills}` + (lost.length ? '<br>Увечья: ' + lost.join(', ') : ''), 'muted'));
    });
  };

  UI.openDialog = function (title, text, buttons) {
    UI.openModal(title, (body) => {
      body.appendChild(el('p', text));
      for (const [label, fn] of buttons || []) {
        const b = el('button', label);
        b.style.marginRight = '8px';
        b.onclick = fn;
        body.appendChild(b);
      }
    });
  };

  UI.openMission = function (who) {
    const D = G.Director, s = G.state, m = s.mission;
    if (!m) {
      const def = D.nextMissionDef();
      UI.openDialog(who, `«${def.text}»<br><span class="muted">Награда: <span class="gold">${def.reward} золота</span></span>`, [
        [s.faction === 'guard' ? 'Слушаюсь!' : 'Сделаю!', () => { D.startMission(); UI.closeModal(); }],
        ['Не сейчас', () => UI.closeModal()],
      ]);
    } else if (!m.done) {
      UI.openDialog(who, `«Чего стоишь? Задание не выполнено!»<br>${D.missionText()}`, [
        ['Выполняю!', () => UI.closeModal()],
        [s.faction === 'guard' ? 'Отказаться (штраф 20)' : 'Отказаться', () => { D.cancelMission(); UI.closeModal(); }],
      ]);
    } else {
      const reward = D.claimReward();
      UI.openDialog(who, `«Отлично справился! Держи награду.»<br><span class="gold">+${reward} золота</span>`, [
        ['Следующее задание', () => UI.openMission(who)],
        ['Закрыть', () => UI.closeModal()],
      ]);
    }
  };

  UI.talk = function (u) {
    const pf = G.state.faction;
    if (u.role === 'merchant') return UI.openShop(u);
    if (u.role === 'healer') return UI.openHealer(u);
    if (u.role === 'commander') {
      if (pf === 'guard') return UI.openMission('Командир стражи');
      return UI.openDialog('Командир стражи', '«Проваливай, пока цел.»', [['Уйти', () => UI.closeModal()]]);
    }
    if (u.role === 'elder') {
      if (pf === 'elves') return UI.openMission('Старейшина эльфов');
      return UI.openDialog('Старейшина эльфов', 'Старейшина молча смотрит на вас.', [['Уйти', () => UI.closeModal()]]);
    }
    if (u.role === 'emperor') {
      return UI.openDialog('Император', '«Служи верно, и будешь вознаграждён. Злой не дремлет, а эльфы снова грабят корованы!»', [['Служу империи!', () => UI.closeModal()]]);
    }
  };

  // ---------- Карта ----------
  function drawMap(ctx, size, full) {
    ctx.drawImage(UI.mapImg, 0, 0, size, size);
    const s = size / 700, tx = (x) => (x + 350) * s;
    if (full) {
      ctx.font = 'bold 15px Georgia';
      ctx.textAlign = 'center';
      for (const k in G.World.ZONES) {
        const z = G.World.ZONES[k];
        ctx.strokeStyle = 'rgba(255,215,122,0.6)';
        ctx.beginPath(); ctx.arc(tx(z.x), tx(z.z), z.r * s, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.fillText(z.name, tx(z.x) + 1, tx(z.z) - z.r * s - 5);
        ctx.fillStyle = '#ffd77a'; ctx.fillText(z.name, tx(z.x), tx(z.z) - z.r * s - 6);
      }
    }
    const dot = full ? 4 : 3;
    for (const u of G.units) {
      if (!u.alive || u.isPlayer) continue;
      ctx.fillStyle = G.FACTION_COLORS[u.faction] || '#fff';
      ctx.fillRect(tx(u.pos.x) - dot / 2, tx(u.pos.z) - dot / 2, dot, dot);
    }
    ctx.fillStyle = '#ffeb3b';
    for (const cv of G.Director.caravans) for (const c of cv.carts) ctx.fillRect(tx(c.x) - 3, tx(c.z) - 3, 6, 6);
    const p = G.player;
    if (p) {
      const x = tx(p.pos.x), y = tx(p.pos.z), a = G.PlayerCtl.yaw;
      const fx = Math.sin(a), fy = Math.cos(a), r = full ? 9 : 6;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(x + fx * r, y + fy * r);
      ctx.lineTo(x - fx * r * 0.6 + fy * r * 0.6, y - fy * r * 0.6 - fx * r * 0.6);
      ctx.lineTo(x - fx * r * 0.6 - fy * r * 0.6, y - fy * r * 0.6 + fx * r * 0.6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }

  UI.toggleMap = function () {
    const m = $('bigmap');
    m.classList.toggle('hidden');
    if (!m.classList.contains('hidden')) drawMap($('bigmapCanvas').getContext('2d'), 640, true);
  };

  // ---------- HUD ----------
  UI.update = function (dt) {
    UI.hudT -= dt;
    if (UI.hudT > 0) return;
    UI.hudT = 0.1;
    const p = G.player, s = G.state;
    if (!p) return;
    $('hpbar').style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    $('hptext').textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
    $('statline').textContent = `Золото: ${s.gold} · ${p.weapon.name} · Бинты: ${s.inv.bandage} · Зелья: ${s.inv.potion} · Убито: ${s.kills}`;
    const inj = I.describe(p.body);
    const mob = p.mobility;
    if (mob.mode === 'crawl') inj.push('Вы ползёте (нужен протез ноги или коляска)');
    if (mob.mode === 'wheelchair') inj.push('Вы в коляске');
    if (p.body.bleeding > 0) inj.unshift('<b>КРОВОТЕЧЕНИЕ! Нажмите H</b>');
    $('injuries').innerHTML = inj.join('<br>');
    const zone = G.World.zoneAt(p.pos.x, p.pos.z);
    const zname = zone ? zone.name : 'Дикие земли';
    $('zone').textContent = zname;
    if (UI.lastZone !== zname) {
      if (UI.lastZone) UI.msg('Вы вошли: ' + zname, '#ffd77a');
      UI.lastZone = zname;
    }
    $('mission').innerHTML = G.Director.missionText();
    $('prompt').textContent = p.alive && G.PlayerCtl.interact ? 'E — ' + G.PlayerCtl.interact.label : '';
    const v = I.vision(p.body);
    const both = v.leftBlind && v.rightBlind;
    $('blindL').style.display = v.leftBlind ? 'block' : 'none';
    $('blindR').style.display = v.rightBlind ? 'block' : 'none';
    $('blindL').style.opacity = $('blindR').style.opacity = both ? '0.94' : '1';
    drawMap($('minimap').getContext('2d'), 180, false);
    if (!$('bigmap').classList.contains('hidden')) drawMap($('bigmapCanvas').getContext('2d'), 640, true);
    const now = performance.now();
    for (const it of UI.logItems) if (now - it.t > 7000) it.el.style.opacity = '0';
    while (UI.logItems.length && now - UI.logItems[0].t > 8500) UI.logItems.shift().el.remove();
  };
})(window.G);
