// Признаки одного кадра для текущего упражнения.
import { ANCHORS, fitSimilarity, applySimilarity, toFace, dist, buildFrame } from './geometry.js';
import { POINTS, EYE } from './exercises.js';

export function makeReference(refPts) {
  return { pts: refPts, frame: buildFrame(refPts) };
}

function meanFace(pts, idx, T, frame) {
  let u = 0, v = 0;
  for (const i of idx) {
    const f = toFace(frame, applySimilarity(T, pts[i]));
    u += f[0]; v += f[1];
  }
  return [u / idx.length, v / idx.length];
}

function aperture(pts, eye, T, frame) {
  let s = 0;
  for (let j = 0; j < eye.up.length; j++) {
    s += dist(applySimilarity(T, pts[eye.up[j]]), applySimilarity(T, pts[eye.lo[j]]));
  }
  return s / eye.up.length / frame.F;
}

// Возвращает { rU, rV, lU, lV, apR, apL } — средние лицевые координаты группы точек
// каждой стороны и раскрытие глаз (в долях ширины лица).
export function extract(pts, ref, ex) {
  const T = fitSimilarity(pts, ref.pts, ANCHORS);
  const s = {
    apR: aperture(pts, EYE.r, T, ref.frame),
    apL: aperture(pts, EYE.l, T, ref.frame),
  };
  if (ex && ex.points) {
    const g = POINTS[ex.points];
    [s.rU, s.rV] = meanFace(pts, g.r, T, ref.frame);
    [s.lU, s.lV] = meanFace(pts, g.l, T, ref.frame);
  }
  return s;
}

// Проекция положения стороны на направление движения.
// Для правой стороны «наружу» — это -u, для левой — +u; «вверх» — это -v.
export function project(sample, sideKey, dir) {
  const U = sideKey === 'r' ? sample.rU : sample.lU;
  const V = sideKey === 'r' ? sample.rV : sample.lV;
  const outSign = sideKey === 'r' ? -1 : 1;
  const len = Math.hypot(dir.out, dir.up) || 1;
  return (dir.out * outSign * U - dir.up * V) / len;
}

export function apOf(sample, sideKey) {
  return sideKey === 'r' ? sample.apR : sample.apL;
}
