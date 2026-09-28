import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ExerciseRunner, TIMING } from '../js/session.js';
import { EXERCISES, POINTS, planReps } from '../js/exercises.js';
import { medianShape } from '../js/geometry.js';
import { makeReference, extract } from '../js/features.js';
import { summarizeExercise, feedbackLines } from '../js/analysis.js';

const V = readFileSync(new URL('./canon.obj', import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('v ')).map((l) => l.split(/\s+/).slice(1, 4).map(Number));
let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const g = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const frame = (def) => V.map((v, i) => { let [X, Y] = v; if (def) { const d = def(i); X += d[0]; Y += d[1]; } return [320 + 22 * X + g() * 0.8, 260 - 22 * Y + g() * 0.8]; });
const ref = makeReference(medianShape(Array.from({ length: 30 }, () => frame())));

function simulate(exId, strengthAt, { affected = 'r', reps = 5, dropFrames = 0 } = {}) {
  const ex = EXERCISES.find((e) => e.id === exId);
  const plans = planReps(ex, reps, affected);
  const events = [];
  const L = new Set(POINTS.brow.l), R = new Set(POINTS.brow.r);
  const run = new ExerciseRunner({ ex, plans, affected, timing: TIMING.gentle, onEvent: (e) => events.push(e) });
  run.start(0);
  let t = 0;
  while (run.phase !== 'done' && t < 200000) {
    t += 33;
    const effort = run.phase === 'effort';
    const k = effort ? strengthAt(run.rep) : 0;
    const f = frame((i) => (L.has(i) ? [0, 0.5 * k] : R.has(i) ? [0, 0.2 * k] : [0, 0]));
    const ok = !(dropFrames && rnd() < dropFrames);
    run.update(t, ok ? { ok: true, ...extract(f, ref, ex) } : { ok: false });
  }
  return { run, events, t, ex };
}

// Normal run
{
  const { run, events, t, ex } = simulate('brow_raise', () => 1);
  assert.equal(run.phase, 'done');
  assert.equal(run.results.length, 5);
  assert.ok(events.some((e) => e.type === 'spark'), 'spark fired on micro-movement');
  const sum = summarizeExercise(ex, run.results, 'r', false);
  console.log('normal:', Math.round(t / 1000), 's', sum.movedA, '/', sum.aTotal, 'ratio', sum.ratio);
  console.log(feedbackLines(sum, 'r').join(' '));
  assert.ok(sum.ratio > 0.1 && sum.ratio < 0.4);
}
// Fatigue: strength decays
{
  const { run, events } = simulate('brow_raise', (rep) => [1, 1, 0.8, 0.35, 0.3, 0.3][rep] ?? 0.3, { reps: 6 });
  console.log('fatigue reps done:', run.results.length, events.filter((e) => e.type === 'fatigue').length);
  assert.ok(events.some((e) => e.type === 'fatigue'));
  assert.ok(run.results.length < 6);
}
// Overpull: healthy side big, affected zero
{
  const { events } = simulate('brow_raise', () => 1.0);
  console.log('overpull fired:', events.some((e) => e.type === 'overpull'));
}
// Lost frames 30%
{
  const { run } = simulate('brow_raise', () => 1, { dropFrames: 0.3 });
  console.log('with dropped frames valid reps:', run.results.filter((r) => r.valid).length);
}
// Guided
{
  const { run } = simulate('gaze', () => 0);
  assert.equal(run.results.length, 5);
}
// Vowels
{
  const ex = EXERCISES.find((e) => e.id === 'vowels');
  assert.equal(planReps(ex, 5, 'r').length, 5);
}
console.log('runner ok');
