// Анализ повторов и упражнений. Чистые функции — без DOM, можно тестировать в Node.
import { median, robustStd, FACE_WIDTH_MM } from './geometry.js';
import { project, apOf } from './features.js';
import { side } from './exercises.js';

// Минимальный порог движения: ~0,6 мм смещения или 8% закрытия глаза.
export const FLOOR = { disp: 0.004, aperture: 0.08 };
const REACTION_MS = 500;
const MIN_SAMPLES = 4; // достаточно даже при ~4 кадрах/с на слабом телефоне

const other = (s) => (s === 'r' ? 'l' : 'r');

function smooth(arr, w = arr.length >= 15 ? 5 : 3) {
  if (arr.length < w) return arr.slice();
  const h = Math.floor(w / 2);
  return arr.map((_, i) => median(arr.slice(Math.max(0, i - h), Math.min(arr.length, i + h + 1))));
}

// Значение, по которому считается движение стороны в кадре.
function value(sample, kind, sideKey, dir) {
  return kind === 'aperture' ? apOf(sample, sideKey) : project(sample, sideKey, dir);
}

// Статистика покоя для одного повтора (последние ~1,5 с перед усилием).
export function restStats(restSamples, kind, dir) {
  const ok = restSamples.filter((s) => s.ok);
  if (ok.length < MIN_SAMPLES) return null;
  const st = {};
  for (const k of ['r', 'l']) {
    const vals = ok.map((s) => value(s, kind, k, dir));
    const eyeVals = ok.map((s) => apOf(s, k));
    st[k] = { med: median(vals), sd: robustStd(vals), eye: median(eyeVals), eyeSd: robustStd(eyeVals) };
  }
  return st;
}

// Смещение относительно покоя: положительное = движение в нужную сторону.
function delta(kind, v, rest) {
  if (kind === 'aperture') return rest.med > 1e-6 ? (rest.med - v) / rest.med : 0; // доля закрытия
  return v - rest.med;
}

function threshold(kind, rest) {
  if (kind === 'aperture') {
    const rel = rest.med > 1e-6 ? rest.sd / rest.med : 0;
    return Math.max(FLOOR.aperture, 3 * rel);
  }
  return Math.max(FLOOR.disp, 3 * rest.sd);
}

// Мгновенные значения для живой обратной связи (полоски на экране).
export function liveDelta(sample, rest, kind, dir, affected, leak = 0) {
  if (!rest || !sample || !sample.ok) return null;
  const out = {};
  for (const k of ['r', 'l']) {
    const d = delta(kind, value(sample, kind, k, dir), rest[k]);
    out[k] = { d, thr: threshold(kind, rest[k]) };
  }
  if (leak && affected) out[affected].d -= leak * Math.max(0, out[affected === 'r' ? 'l' : 'r'].d);
  return out;
}

// Разбор одного повтора.
// plan: { kind, dir, target }, affected: 'r' | 'l', watchEye: bool
export function analyzeRep(restSamples, effortSamples, plan, affected, watchEye = false) {
  const { kind, dir, target, leak = 0 } = plan;
  const healthy = other(affected);
  const rest = restStats(restSamples, kind, dir);
  const t0 = effortSamples.length ? effortSamples[0].t : 0;
  const eff = effortSamples.filter((s) => s.ok && s.t - t0 >= REACTION_MS);
  const base = { target, valid: false };
  if (!rest || eff.length < MIN_SAMPLES) return base;

  const series = {};
  for (const k of ['r', 'l']) series[k] = smooth(eff.map((s) => delta(kind, value(s, kind, k, dir), rest[k])));
  // Поправка на «перетекание»: вычитаем кадр за кадром долю движения здоровой стороны.
  if (leak) series[affected] = series[affected].map((v, i) => v - leak * Math.max(0, series[healthy][i]));
  const peak = {};
  for (const k of ['r', 'l']) peak[k] = { d: Math.max(...series[k]), thr: threshold(kind, rest[k]) };
  const A = peak[affected], H = peak[healthy];
  const res = {
    ...base,
    valid: true,
    dA: round(A.d), dH: round(H.d),
    thrA: round(A.thr), thrH: round(H.thr),
    movedA: A.d > A.thr,
    movedH: H.d > H.thr,
    ratio: null,
  };
  if (target === 'both' && res.movedH) res.ratio = res.movedA ? round(clamp(A.d / H.d, 0, 1.5)) : 0;

  if (watchEye) {
    // Синкинезия: глаз на поражённой стороне заметно прищуривается во время движения рта.
    const closeA = Math.max(...smooth(eff.map((s) => (rest[affected].eye - apOf(s, affected)) / rest[affected].eye)));
    const closeH = Math.max(...smooth(eff.map((s) => (rest[healthy].eye - apOf(s, healthy)) / rest[healthy].eye)));
    res.eyeA = round(closeA); res.eyeH = round(closeH);
    res.syn = closeA > 0.18 && closeA > closeH + 0.12;
  }
  return res;
}

// Усталость: последние два повтора заметно слабее первых двух.
export function isFatigued(reps) {
  const v = reps.filter((r) => r.valid && r.target === 'both');
  if (v.length < 4) return false;
  const amp = (r) => Math.max(0, r.dA) + Math.max(0, r.dH);
  const first = (amp(v[0]) + amp(v[1])) / 2;
  const last = (amp(v[v.length - 1]) + amp(v[v.length - 2])) / 2;
  return first > 2 * FLOOR.disp && last < 0.6 * first;
}

export function summarizeExercise(ex, reps, affected, assisted) {
  const healthy = other(affected);
  const valid = reps.filter((r) => r.valid);
  const s = { id: ex.id, title: ex.title, kind: ex.kind, lowConfidence: !!ex.lowConfidence, assisted: !!assisted, reps: reps.length, validReps: valid.length };
  if (ex.kind === 'guided') return s;

  let aReps, hReps;
  if (ex.alternate) {
    aReps = valid.filter((r) => r.target === affected);
    hReps = valid.filter((r) => r.target === healthy);
  } else {
    aReps = hReps = valid;
  }
  s.aTotal = aReps.length;
  s.movedA = aReps.filter((r) => r.movedA).length;
  s.movedH = hReps.filter((r) => r.movedH).length;
  const medA = aReps.length ? median(aReps.map((r) => Math.max(0, r.dA))) : null;
  const medH = hReps.length ? median(hReps.map((r) => Math.max(0, r.dH))) : null;
  s.medA = medA == null ? null : round(medA);
  s.medH = medH == null ? null : round(medH);

  if (ex.alternate) {
    s.ratio = medA != null && medH != null && s.movedH > 0 ? (s.movedA > 0 ? round(clamp(medA / medH, 0, 1.5)) : 0) : null;
  } else {
    const ratios = valid.map((r) => r.ratio).filter((x) => x != null);
    s.ratio = ratios.length ? round(median(ratios)) : null;
  }
  if (ex.kind === 'disp') { s.mmA = medA == null ? null : +(medA * FACE_WIDTH_MM).toFixed(1); s.mmH = medH == null ? null : +(medH * FACE_WIDTH_MM).toFixed(1); }
  if (ex.kind === 'aperture') { s.closeA = medA == null ? null : Math.round(medA * 100); s.closeH = medH == null ? null : Math.round(medH * 100); }
  s.fatigue = isFatigued(reps);
  s.syn = valid.filter((r) => r.syn).length;
  return s;
}

// Короткий человеческий комментарий к упражнению.
export function feedbackLines(sum, affected) {
  const lines = [];
  if (sum.kind === 'guided') { lines.push('Выполнено.'); return lines; }
  if (!sum.validReps) {
    lines.push('Камера не смогла оценить это упражнение — лицо было плохо видно. Ничего страшного, само упражнение засчитано.');
    return lines;
  }
  const A = side.gen(affected);
  if (sum.movedA > 0) {
    lines.push(`На ${A} стороне есть движение в ${sum.movedA} из ${sum.aTotal} повторов.`);
    if (sum.ratio != null && !sum.lowConfidence) lines.push(`Это примерно ${Math.round(sum.ratio * 100)}% от движения здоровой стороны.`);
  } else {
    lines.push(`Движение на ${A} стороне камера пока не видит. На этом этапе это нормально: главное — спокойно посылать импульс в мышцу.`);
  }
  if (sum.kind === 'aperture' && sum.closeA != null && sum.id === 'eye_close') {
    lines.push(`Глаз на ${A} стороне закрывается примерно на ${sum.closeA}%.`);
  }
  if (sum.lowConfidence) lines.push('Для этого упражнения камера различает стороны неточно — лучше ориентироваться на зеркало.');
  if (sum.assisted) lines.push('Отмечено: с помощью пальцев.');
  if (sum.fatigue) lines.push('К концу движения стали слабее — мышцы устали. Так и должно быть, не форсируйте.');
  if (sum.syn) lines.push('Заметно прищуривание глаза во время движения рта. Стоит показать это реабилитологу.');
  return lines;
}

// Индекс занятия: медиана соотношений по упражнениям (0…1,5) — для графика в истории.
export function sessionIndex(summaries) {
  const r = summaries.map((s) => s.ratio).filter((x) => x != null);
  return r.length ? round(median(r)) : null;
}

export function sessionMovedShare(summaries) {
  let moved = 0, total = 0;
  for (const s of summaries) if (s.aTotal) { moved += s.movedA; total += s.aTotal; }
  return total ? round(moved / total) : null;
}

function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function round(x) { return Math.round(x * 1000) / 1000; }
