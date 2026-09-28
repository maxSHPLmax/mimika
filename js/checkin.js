// Еженедельная проверка: одинаковый короткий набор выражений раз в неделю,
// чтобы результаты были сравнимы между собой (в отличие от обычных занятий).
import { EXERCISES, planReps } from './exercises.js';
import { FACE_WIDTH_MM } from './geometry.js';

export const CHECKIN_TIMING = { first: 4000, effort: 4000, relax: 5000 };
export const CHECKIN_REPS = 2;
export const CHECKIN_EVERY_DAYS = 7;

const base = (id) => EXERCISES.find((e) => e.id === id);
export const POSES = [
  { ...base('brow_raise'), short: 'Брови' },
  { ...base('eye_close'), short: 'Глаза' },
  { ...base('smile'), short: 'Улыбка' },
  { ...base('pucker'), short: 'Трубочка' },
];
export const REST_POSE = { id: 'rest', short: 'Покой' };

export const plansFor = (pose, affected, nameOf) => planReps(pose, CHECKIN_REPS, affected, nameOf);

const r1 = (x) => Math.round(x * 10) / 10;

// Итог по одному выражению: «что увидела камера» — лучшая попытка и разброс попыток.
// Движение ниже порога обнаружения записывается как 0.
export function summarizePose(pose, results) {
  const v = results.filter((r) => r.valid);
  const out = { id: pose.id, short: pose.short, title: pose.title, kind: pose.kind, valid: v.length, reps: results.length };
  if (!v.length) { out.flag = 'nodata'; return out; }
  const scale = pose.kind === 'aperture' ? 100 : FACE_WIDTH_MM;
  const val = (r, side) => (side === 'a' ? (r.movedA ? r.dA : 0) : (r.movedH ? r.dH : 0)) * scale;
  for (const side of ['a', 'h']) {
    const xs = v.map((r) => Math.max(0, val(r, side)));
    out[side] = { best: r1(Math.max(...xs)), lo: r1(Math.min(...xs)), hi: r1(Math.max(...xs)) };
  }
  out.unit = pose.kind === 'aperture' ? '%' : 'мм';
  out.bestRep = v.reduce((b, r) => (r.dA > b.dA ? r : b), v[0]).rep ?? 0;
  if (v.length < results.length) out.flag = 'partial';
  return out;
}

export const isCheckin = (s) => s && s.kind === 'checkin';

export function lastCheckin(sessions) {
  const c = sessions.filter((s) => isCheckin(s) && s.completed);
  return c.length ? c[c.length - 1] : null;
}

export function checkinDue(sessions, now = Date.now()) {
  const last = lastCheckin(sessions);
  return !last || now - Date.parse(last.startedAt) >= CHECKIN_EVERY_DAYS * 864e5 - 12 * 3600e3;
}

// Условия съёмки, из-за которых неделю сложно сравнивать с первой проверкой.
export function qualityFlags(rec, first) {
  const f = [];
  if (rec.quality?.light != null && rec.quality.light < 70) f.push('мало света');
  if (first && first !== rec && first.quality?.faceFrac && rec.quality?.faceFrac) {
    const k = rec.quality.faceFrac / first.quality.faceFrac;
    if (k < 0.8 || k > 1.25) f.push('другое расстояние до камеры');
  }
  if ((rec.poses || []).some((p) => p.flag)) f.push('не все попытки измерены');
  return f;
}
