// Модель увечий: отрубленные руки и ноги, выколотые глаза, кровотечение, протезы, коляска.
// Чистая логика без Three.js — работает и в браузере, и в Node (для тестов).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.G = root.G || {};
    root.G.Injuries = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const LIMBS = ['armL', 'armR', 'legL', 'legR'];
  const EYES = ['eyeL', 'eyeR'];
  const SLOTS = LIMBS.concat(EYES);
  const NAMES = {
    armL: 'левая рука', armR: 'правая рука', legL: 'левая нога', legR: 'правая нога',
    eyeL: 'левый глаз', eyeR: 'правый глаз',
  };
  const ACC = {
    armL: 'левую руку', armR: 'правую руку', legL: 'левую ногу', legR: 'правую ногу',
    eyeL: 'левый глаз', eyeR: 'правый глаз',
  };
  const KIND_SLOTS = { arm: ['armR', 'armL'], leg: ['legL', 'legR'], eye: ['eyeL', 'eyeR'] };
  const BLEED_LIMB = 1;
  const BLEED_EYE = 0.3;
  const BLEED_DPS = 2.5; // урона в секунду на единицу кровотечения

  const HIT_WEIGHTS = [['torso', 40], ['head', 12], ['armL', 12], ['armR', 12], ['legL', 12], ['legR', 12]];

  function createBody() {
    const lost = {}, prosthetic = {};
    for (const s of SLOTS) { lost[s] = false; prosthetic[s] = false; }
    return { lost, prosthetic, bleeding: 0, wheelchair: false };
  }

  function functional(body, slot) {
    return !body.lost[slot] || body.prosthetic[slot];
  }

  function pickHitPart(rng) {
    let r = rng() * 100;
    for (const [part, w] of HIT_WEIGHTS) {
      if (r < w) return part;
      r -= w;
    }
    return 'torso';
  }

  // Применяет попадание в часть тела. severChance — шанс отрубить конечность (для головы — выколоть глаз).
  function applyHit(body, part, severChance, rng) {
    const res = { part, severed: null, prostheticBroken: false, eye: null };
    if (LIMBS.includes(part)) {
      if (body.lost[part] && !body.prosthetic[part]) {
        res.part = 'torso'; // руки уже нет — удар приходится в тело
        return res;
      }
      if (rng() < severChance) {
        if (body.lost[part]) {
          body.prosthetic[part] = false; // протез сломали, кровь не идёт
          res.prostheticBroken = true;
        } else {
          body.lost[part] = true;
          body.bleeding += BLEED_LIMB;
        }
        res.severed = part;
      }
    } else if (part === 'head') {
      if (rng() < severChance * 0.7) {
        const cands = EYES.filter((e) => functional(body, e));
        if (cands.length) {
          const e = cands[Math.floor(rng() * cands.length)];
          if (body.lost[e]) {
            body.prosthetic[e] = false;
            res.prostheticBroken = true;
          } else {
            body.lost[e] = true;
            body.bleeding += BLEED_EYE;
          }
          res.eye = e;
        }
      }
    }
    return res;
  }

  function bandage(body) {
    const had = body.bleeding > 0;
    body.bleeding = 0;
    return had;
  }

  function bleedDamage(body, dt) {
    return body.bleeding * BLEED_DPS * dt;
  }

  function missingLegs(body) {
    return ['legL', 'legR'].filter((s) => !functional(body, s)).length;
  }

  // Как персонаж передвигается: ходит, ползает или катается на коляске.
  function mobility(body) {
    if (missingLegs(body) === 0) {
      const pros = body.prosthetic.legL || body.prosthetic.legR;
      return { mode: pros ? 'prosthetic' : 'walk', speedMul: pros ? 0.9 : 1, canJump: true };
    }
    if (body.wheelchair) return { mode: 'wheelchair', speedMul: 0.7, canJump: false };
    return { mode: 'crawl', speedMul: 0.25, canJump: false };
  }

  function damageMul(body) {
    const r = functional(body, 'armR'), l = functional(body, 'armL');
    if (r && l) return 1;
    if (r || l) return 0.6;
    return 0.15; // без рук — только пинаться
  }

  function canUseBow(body) {
    return functional(body, 'armL') && functional(body, 'armR');
  }

  function vision(body) {
    return { leftBlind: !functional(body, 'eyeL'), rightBlind: !functional(body, 'eyeR') };
  }

  function installable(body, kind) {
    return KIND_SLOTS[kind].filter((s) => body.lost[s] && !body.prosthetic[s]);
  }

  function installProsthetic(body, kind) {
    const slot = installable(body, kind)[0];
    if (!slot) return null;
    body.prosthetic[slot] = true;
    if (kind === 'leg' && missingLegs(body) === 0) body.wheelchair = false;
    return slot;
  }

  function canSitInWheelchair(body) {
    return missingLegs(body) > 0;
  }

  function describe(body) {
    const out = [];
    for (const s of SLOTS) {
      if (body.lost[s]) out.push((body.prosthetic[s] ? 'протез: ' : 'нет: ') + NAMES[s]);
    }
    return out;
  }

  function serialize(body) {
    return JSON.parse(JSON.stringify(body));
  }

  function deserialize(data) {
    const b = createBody();
    if (!data) return b;
    for (const s of SLOTS) {
      b.lost[s] = !!(data.lost && data.lost[s]);
      b.prosthetic[s] = !!(data.prosthetic && data.prosthetic[s]);
    }
    b.bleeding = Number(data.bleeding) || 0;
    b.wheelchair = !!data.wheelchair;
    return b;
  }

  return {
    LIMBS, EYES, SLOTS, NAMES, ACC, BLEED_DPS,
    createBody, functional, pickHitPart, applyHit, bandage, bleedDamage, missingLegs,
    mobility, damageMul, canUseBow, vision, installable, installProsthetic, canSitInWheelchair,
    describe, serialize, deserialize,
  };
});
