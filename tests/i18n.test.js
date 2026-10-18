// Перевод: каждое упражнение и подсказка есть в польском словаре, {параметры} совпадают.
import assert from 'node:assert/strict';
import { PL } from '../js/i18n-pl.js';
import { t, setLang, pluralForm } from '../js/i18n.js';
import { EXERCISES, side } from '../js/exercises.js';
import { POSES, REST_POSE } from '../js/checkin.js';

const need = new Set();
for (const e of EXERCISES) {
  [e.title, e.region, e.cue, e.relaxCue, e.voiceNote, ...(e.howto || []), ...(e.sequence || []).map((s) => s.cue)].forEach((x) => x && need.add(x));
  if (e.cueFor) ['r', 'l'].forEach((s) => need.add(e.cueFor(s)));
}
[...POSES, REST_POSE].forEach((p) => need.add(p.short));
const missing = [...need].filter((k) => !(k in PL));
assert.deepEqual(missing, [], `missing Polish translations: ${missing.join(' | ')}`);

const params = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const [k, v] of Object.entries(PL)) {
  if (typeof v === 'string') assert.equal(params(v), params(k), `placeholders differ for: ${k}`);
  else for (const n of [1, 2, 5, 22]) assert.ok(!/[А-Яа-яЁё]/.test(v({ n })), `function entry returns Cyrillic: ${k}`);
}

setLang('pl');
assert.equal(t('Повтор {i} из {n}', { i: 2, n: 5 }), 'Powtórzenie 2 z 5');
assert.equal(side.gen('r'), 'prawej');
assert.equal(t('Сегодня уже {n} занятия — этого достаточно. Мышцам тоже нужен отдых.', { n: 3 }).startsWith('Dzisiaj już 3 sesje'), true);
assert.equal(t('Сегодня уже {n} занятия — этого достаточно. Мышцам тоже нужен отдых.', { n: 5 }).startsWith('Dzisiaj już 5 sesji'), true);
assert.equal(t('Нет такого ключа'), 'Нет такого ключа'); // без перевода — исходный текст
assert.deepEqual([1, 2, 5, 12, 22, 25].map((n) => pluralForm(n, 'pl')), ['one', 'few', 'many', 'many', 'few', 'many']);
assert.deepEqual([1, 2, 5, 11, 21].map((n) => pluralForm(n, 'ru')), ['one', 'few', 'many', 'many', 'one']);
setLang('ru');
assert.equal(t('Повтор {i} из {n}', { i: 2, n: 5 }), 'Повтор 2 из 5');
console.log(`i18n ok: ${Object.keys(PL).length} Polish strings`);
