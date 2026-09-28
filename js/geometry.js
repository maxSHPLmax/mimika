// Геометрия: выравнивание кадра по «опорным» точкам лица и лицевая система координат.
//
// Индексы точек — топология MediaPipe Face Mesh. Сторона анатомическая:
// 33/133/61… — ПРАВАЯ сторона человека (в необработанном кадре фронтальной
// камеры она слева), 263/362/291… — ЛЕВАЯ.

// Точки, которые почти не двигаются при мимике: спинка носа, внутренние углы глаз,
// контур лица у ушей. По ним убираем движения головы (сдвиг, наклон, масштаб).
export const ANCHORS = [168, 6, 197, 195, 5, 4, 133, 362, 127, 356, 234, 454, 93, 323];

export const INNER_CANTHUS = { r: 133, l: 362 };
export const FACE_EDGE = { r: 234, l: 454 };
export const NOSE_TIP = 1;

// Средняя ширина лица между точками 234–454 (у козелков), мм. Нужна только для
// приблизительного перевода в миллиметры в отчётах.
export const FACE_WIDTH_MM = 145;

export function toPixels(landmarks, w, h) {
  const out = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) out[i] = [landmarks[i].x * w, landmarks[i].y * h];
  return out;
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Подбор преобразования подобия (масштаб + поворот + сдвиг), которое переводит
// опорные точки текущего кадра src в опорные точки эталона dst (метод Прокруста в 2D).
export function fitSimilarity(src, dst, idx = ANCHORS) {
  const n = idx.length;
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (const i of idx) { sx += src[i][0]; sy += src[i][1]; dx += dst[i][0]; dy += dst[i][1]; }
  sx /= n; sy /= n; dx /= n; dy /= n;
  let a = 0, b = 0, norm = 0;
  for (const i of idx) {
    const px = src[i][0] - sx, py = src[i][1] - sy;
    const qx = dst[i][0] - dx, qy = dst[i][1] - dy;
    a += px * qx + py * qy;
    b += px * qy - py * qx;
    norm += px * px + py * py;
  }
  const ar = a / norm, ai = b / norm; // комплексный множитель: масштаб * e^{iθ}
  return { ar, ai, sx, sy, dx, dy };
}

export function applySimilarity(T, p) {
  const x = p[0] - T.sx, y = p[1] - T.sy;
  return [T.ar * x - T.ai * y + T.dx, T.ai * x + T.ar * y + T.dy];
}

// Лицевая система координат эталона: начало — середина между внутренними углами глаз,
// ось u — к ЛЕВОЙ стороне человека, ось v — вниз, единица — ширина лица.
export function buildFrame(refPts) {
  const r = refPts[INNER_CANTHUS.r], l = refPts[INNER_CANTHUS.l];
  const O = [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2];
  let ex = [l[0] - r[0], l[1] - r[1]];
  const len = Math.hypot(ex[0], ex[1]);
  ex = [ex[0] / len, ex[1] / len];
  const ey = [-ex[1], ex[0]];
  const F = dist(refPts[FACE_EDGE.r], refPts[FACE_EDGE.l]);
  return { O, ex, ey, F };
}

export function toFace(frame, p) {
  const x = p[0] - frame.O[0], y = p[1] - frame.O[1];
  return [(x * frame.ex[0] + y * frame.ex[1]) / frame.F, (x * frame.ey[0] + y * frame.ey[1]) / frame.F];
}

// Поэлементная медиана набора кадров — «лицо в покое».
export function medianShape(frames) {
  const n = frames[0].length;
  const out = new Array(n);
  const xs = new Float64Array(frames.length), ys = new Float64Array(frames.length);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < frames.length; k++) { xs[k] = frames[k][i][0]; ys[k] = frames[k][i][1]; }
    out[i] = [median(xs), median(ys)];
  }
  return out;
}

export function median(arr) {
  const a = Array.from(arr).sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

export function robustStd(arr) {
  const m = median(arr);
  return 1.4826 * median(arr.map((v) => Math.abs(v - m)));
}

// Проверка положения лица в кадре. Возвращает код проблемы или null.
export function framingIssue(pts, videoW) {
  const edgeR = pts[FACE_EDGE.r], edgeL = pts[FACE_EDGE.l], tip = pts[NOSE_TIP];
  const width = dist(edgeR, edgeL) / videoW;
  if (width < 0.2) return 'far';
  if (width > 0.95) return 'near';
  const yaw = dist(tip, edgeR) / Math.max(1e-6, dist(tip, edgeL));
  if (yaw < 0.7 || yaw > 1.43) return 'turned';
  const cr = pts[INNER_CANTHUS.r], cl = pts[INNER_CANTHUS.l];
  const roll = Math.abs(Math.atan2(cl[1] - cr[1], cl[0] - cr[0])) * 180 / Math.PI;
  if (roll > 20) return 'tilted';
  return null;
}
