// Синтетическая проверка: каноническая сетка MediaPipe + движение головы + шум.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { medianShape, framingIssue } from '../js/geometry.js';
import { makeReference, extract } from '../js/features.js';
import { analyzeRep, summarizeExercise, liveDelta, restStats } from '../js/analysis.js';
import { EXERCISES, POINTS, EYE, planReps } from '../js/exercises.js';

const V = readFileSync(new URL('./canon.obj', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.startsWith('v ')).map((l) => l.split(/\s+/).slice(1, 4).map(Number));
const CM = 1; // canonical units ~ cm

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

// deform: function(i, [X,Y]) -> [dX,dY] in cm (canonical axes: X toward subject LEFT, Y up)
function frame(deform, t, noisePx = 0.8) {
  const s = 22 + 1.5 * Math.sin(t / 900);             // px per cm, slow zoom
  const th = (4 * Math.PI / 180) * Math.sin(t / 700);  // roll ±4°
  const tx = 320 + 15 * Math.sin(t / 500), ty = 260 + 10 * Math.cos(t / 650);
  return V.map((v, i) => {
    let [X, Y] = v;
    if (deform) { const d = deform(i, v); X += d[0]; Y += d[1]; }
    const x = s * X, y = -s * Y;
    return [tx + Math.cos(th) * x - Math.sin(th) * y + gauss() * noisePx,
            ty + Math.sin(th) * x + Math.cos(th) * y + gauss() * noisePx];
  });
}

const ref = makeReference(medianShape(Array.from({ length: 40 }, (_, k) => frame(null, k * 33))));
assert.equal(framingIssue(frame(null, 0), 640), null, 'frontal face should pass framing');

function runRep(ex, plan, deform, affected) {
  const rest = [], eff = [];
  for (let t = 0; t < 1500; t += 33) rest.push({ t, ok: true, ...extract(frame(null, t), ref, ex) });
  for (let t = 1500; t < 4500; t += 33) {
    const k = Math.min(1, (t - 1500) / 800); // ramp up
    eff.push({ t, ok: true, ...extract(frame((i, v) => deform(i, v, k), t), ref, ex) });
  }
  return analyzeRep(rest, eff, { kind: ex.kind, dir: plan.dir, target: plan.target, leak: ex.leak || 0 }, affected, ex.watchEye);
}

const ex = (id) => EXERCISES.find((e) => e.id === id);
const inSet = (arr) => new Set(arr);

// --- 1. Smile: healthy LEFT corner moves 0.4cm out+up; affected RIGHT corner moves 0.05cm,
//        plus whole mouth dragged 0.1cm toward healthy side (passive pull).
{
  const L = inSet(POINTS.mouth.l), R = inSet(POINTS.mouth.r);
  const mouthAll = V.map((v, i) => i).filter((i) => V[i][1] < -3 && V[i][1] > -5.6 && Math.abs(V[i][0]) < 3.3);
  const drag = inSet(mouthAll);
  const deform = (i, v, k) => {
    let dx = 0, dy = 0;
    if (drag.has(i)) dx += 0.1 * k;                 // drift toward subject left (+X)
    if (L.has(i)) { dx += 0.34 * k; dy += 0.2 * k; }
    if (R.has(i)) { dx += -0.05 * k; dy += 0.02 * k; }
    return [dx, dy];
  };
  const e = ex('smile');
  const reps = planReps(e, 5, 'r').map((p) => runRep(e, p, deform, 'r'));
  const sum = summarizeExercise(e, reps, 'r', false);
  console.log('smile', sum);
  assert.ok(sum.movedH === 5, 'healthy side movement detected');
  assert.ok(sum.ratio < 0.1, 'passive drag must not count as affected-side movement');
}

// --- 2. Same, but affected corner moves 1.5 mm (micro-recovery) -> must be detected.
{
  const L = inSet(POINTS.mouth.l), R = inSet(POINTS.mouth.r);
  const deform = (i, v, k) => {
    if (L.has(i)) return [0.34 * k, 0.2 * k];
    if (R.has(i)) return [-0.13 * k, 0.07 * k];
    return [0, 0];
  };
  const e = ex('smile');
  const reps = planReps(e, 5, 'r').map((p) => runRep(e, p, deform, 'r'));
  const sum = summarizeExercise(e, reps, 'r', false);
  console.log('smile-micro', sum);
  assert.ok(sum.movedA >= 4, 'micro-movement on affected side detected');
  assert.ok(sum.ratio > 0.25 && sum.ratio < 0.6, 'ratio plausible');
}

// --- 3. Brow raise, affected side totally still -> no false positives.
{
  const L = inSet(POINTS.brow.l);
  const deform = (i, v, k) => (L.has(i) ? [0, 0.5 * k] : [0, 0]);
  const e = ex('brow_raise');
  const reps = planReps(e, 5, 'r').map((p) => runRep(e, p, deform, 'r'));
  const sum = summarizeExercise(e, reps, 'r', false);
  console.log('brow', sum);
  assert.equal(sum.movedA, 0, 'no false positive on still side');
  assert.equal(sum.movedH, 5);
}

// --- 4. Eye closure: healthy eye closes fully, affected closes ~40%.
{
  const upL = inSet(EYE.l.up), upR = inSet(EYE.r.up);
  const deform = (i, v, k) => {
    if (upL.has(i)) return [0, -0.62 * k];
    if (upR.has(i)) return [0, -0.27 * k];
    return [0, 0];
  };
  const e = ex('eye_close');
  const reps = planReps(e, 5, 'r').map((p) => runRep(e, p, deform, 'r'));
  const sum = summarizeExercise(e, reps, 'r', false);
  console.log('eye', sum);
  assert.ok(sum.closeA > 30 && sum.closeA < 50, 'affected closure ~40%');
  assert.ok(sum.closeH > 85, 'healthy closure ~100%');
}

// --- 5. Alternating squint: target sides alternate.
{
  const e = ex('squint');
  const plans = planReps(e, 6, 'r');
  assert.deepEqual(plans.map((p) => p.target), ['l', 'r', 'l', 'r', 'l', 'r']);
  const upL = inSet(EYE.l.up), upR = inSet(EYE.r.up);
  const reps = plans.map((p) => runRep(e, p, (i, v, k) => {
    if (p.target === 'l' && upL.has(i)) return [0, -0.3 * k];
    if (p.target === 'r' && upR.has(i)) return [0, -0.06 * k];
    return [0, 0];
  }, 'r'));
  const sum = summarizeExercise(e, reps, 'r', false);
  console.log('squint', sum);
  assert.equal(sum.aTotal, 3);
  assert.ok(sum.ratio > 0.1 && sum.ratio < 0.35);
}

// --- 6. Synkinesis: smile with affected eye narrowing.
{
  const L = inSet(POINTS.mouth.l), R = inSet(POINTS.mouth.r), upR = inSet(EYE.r.up);
  const deform = (i, v, k) => {
    if (L.has(i)) return [0.34 * k, 0.2 * k];
    if (R.has(i)) return [-0.15 * k, 0.1 * k];
    if (upR.has(i)) return [0, -0.25 * k];
    return [0, 0];
  };
  const e = ex('smile');
  const reps = planReps(e, 5, 'r').map((p) => runRep(e, p, deform, 'r'));
  const sum = summarizeExercise(e, reps, 'r', false);
  console.log('syn', sum.syn);
  assert.ok(sum.syn >= 4, 'synkinesis flagged');
}

// --- 7. Mirror check: same scenario with affected LEFT must mirror results.
{
  const R = inSet(POINTS.brow.r);
  const e = ex('brow_raise');
  const reps = planReps(e, 5, 'l').map((p) => runRep(e, p, (i, v, k) => (R.has(i) ? [0, 0.5 * k] : [0, 0]), 'l'));
  const sum = summarizeExercise(e, reps, 'l', false);
  assert.equal(sum.movedA, 0); assert.equal(sum.movedH, 5);
}

// --- 8. Turned head is rejected by framing check.
{
  const turned = V.map(([X, Y, Z]) => { const a = 0.6; const x = X * Math.cos(a) + Z * Math.sin(a); return [320 + 22 * x, 260 - 22 * Y]; });
  assert.equal(framingIssue(turned, 640), 'turned');
}
console.log('\nВсе проверки пройдены.');

// --- 9. Crosstalk correction: simulated model leak (weak side mimics 8% of healthy) is removed.
{
  const L = new Set(POINTS.mouth.l), R = new Set(POINTS.mouth.r);
  const deform = (i, v, k) => (L.has(i) ? [0.34 * k, 0.2 * k] : R.has(i) ? [-0.34 * 0.08 * k, 0.2 * 0.08 * k] : [0, 0]);
  const e = EXERCISES.find((x) => x.id === 'smile');
  const reps = planReps(e, 5, 'r').map((p) => runRep(e, p, deform, 'r'));
  const sum = summarizeExercise(e, reps, 'r', false);
  console.log('leak-only smile: movedA', sum.movedA, 'ratio', sum.ratio);
  assert.ok(sum.movedA <= 1, 'pure model leak must not read as recovery');
  console.log('Проверка перетекания пройдена.');
}
