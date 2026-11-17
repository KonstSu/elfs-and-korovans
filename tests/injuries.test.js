const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/injuries.js');

const always = () => 0; // rng: шанс всегда срабатывает
const never = () => 0.999;

test('новое тело цело и ходит', () => {
  const b = I.createBody();
  assert.deepEqual(I.describe(b), []);
  assert.equal(I.mobility(b).mode, 'walk');
  assert.equal(I.damageMul(b), 1);
  assert.ok(I.canUseBow(b));
});

test('отрубленная нога: кровотечение и ползание', () => {
  const b = I.createBody();
  const res = I.applyHit(b, 'legL', 1, always);
  assert.equal(res.severed, 'legL');
  assert.ok(b.lost.legL);
  assert.ok(b.bleeding > 0);
  const m = I.mobility(b);
  assert.equal(m.mode, 'crawl');
  assert.equal(m.canJump, false);
});

test('без перевязки кровотечение убивает, бинт останавливает', () => {
  const b = I.createBody();
  I.applyHit(b, 'armR', 1, always);
  assert.ok(I.bleedDamage(b, 40) >= 100); // за 40 секунд теряется всё здоровье
  assert.equal(I.bandage(b), true);
  assert.equal(I.bleedDamage(b, 40), 0);
});

test('коляска и протез ноги', () => {
  const b = I.createBody();
  I.applyHit(b, 'legR', 1, always);
  assert.ok(I.canSitInWheelchair(b));
  b.wheelchair = true;
  assert.equal(I.mobility(b).mode, 'wheelchair');
  assert.equal(I.installProsthetic(b, 'leg'), 'legR');
  const m = I.mobility(b);
  assert.equal(m.mode, 'prosthetic');
  assert.ok(m.canJump);
  assert.equal(b.wheelchair, false);
});

test('удар по уже отрубленной руке приходится в тело', () => {
  const b = I.createBody();
  I.applyHit(b, 'armL', 1, always);
  const res = I.applyHit(b, 'armL', 1, always);
  assert.equal(res.part, 'torso');
  assert.equal(res.severed, null);
});

test('протез можно сломать — без нового кровотечения', () => {
  const b = I.createBody();
  I.applyHit(b, 'armR', 1, always);
  I.bandage(b);
  I.installProsthetic(b, 'arm');
  const res = I.applyHit(b, 'armR', 1, always);
  assert.ok(res.prostheticBroken);
  assert.equal(b.prosthetic.armR, false);
  assert.equal(b.bleeding, 0);
});

test('без руки урон меньше, лук недоступен', () => {
  const b = I.createBody();
  I.applyHit(b, 'armR', 1, always);
  assert.equal(I.damageMul(b), 0.6);
  assert.equal(I.canUseBow(b), false);
});

test('выколотый глаз закрывает половину обзора, протез глаза возвращает', () => {
  const b = I.createBody();
  const res = I.applyHit(b, 'head', 1, always);
  assert.equal(res.eye, 'eyeL');
  assert.deepEqual(I.vision(b), { leftBlind: true, rightBlind: false });
  I.installProsthetic(b, 'eye');
  assert.deepEqual(I.vision(b), { leftBlind: false, rightBlind: false });
});

test('низкий шанс — без увечий', () => {
  const b = I.createBody();
  const res = I.applyHit(b, 'legL', 0.2, never);
  assert.equal(res.severed, null);
  assert.equal(b.lost.legL, false);
});

test('выбор части тела по весам', () => {
  assert.equal(I.pickHitPart(() => 0), 'torso');
  assert.equal(I.pickHitPart(() => 0.45), 'head');
  assert.equal(I.pickHitPart(() => 0.999), 'legR');
});

test('сохранение тела переживает сериализацию', () => {
  const b = I.createBody();
  I.applyHit(b, 'legL', 1, always);
  I.installProsthetic(b, 'leg');
  const copy = I.deserialize(JSON.parse(JSON.stringify(I.serialize(b))));
  assert.deepEqual(copy, b);
  assert.deepEqual(I.deserialize(null), I.createBody());
});
