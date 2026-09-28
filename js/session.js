// Ход одного упражнения: «расслабьтесь» → «усилие» → … Повторы идут в спокойном темпе,
// движение каждого повтора сравнивается с покоем прямо перед ним.
import { analyzeRep, restStats, liveDelta, isFatigued } from './analysis.js';
import { planReps } from './exercises.js';

// Темп по отзыву после первых занятий: прежние 3 с / 4–5 с оказались слишком быстрыми.
export const TIMING = {
  gentle: { effort: 4000, relax: 6000, first: 4000 },
  slow: { effort: 5000, relax: 7000, first: 5000 },     // по умолчанию
  slower: { effort: 6000, relax: 9000, first: 6000 },
};
const INTRO_SEC = 15; // чтение описания упражнения

// Примерная длительность занятия, с.
export function estimateSessionSec(exercises, reps, t) {
  let sec = 30; // подготовка камеры и запоминание лица
  for (const ex of exercises) {
    const n = planReps(ex, reps, 'r').length;
    sec += INTRO_SEC + (t.first + n * t.effort + (n - 1) * t.relax + 1500) / 1000;
  }
  return sec;
}
const REST_WINDOW = 2000;
const COOLDOWN = 1500;

export class ExerciseRunner {
  constructor({ ex, plans, affected, timing, onEvent }) {
    this.ex = ex;
    this.plans = plans;
    this.affected = affected;
    this.healthy = affected === 'r' ? 'l' : 'r';
    this.timing = timing;
    this.onEvent = onEvent || (() => {});
    this.results = [];
    this.phase = 'idle';
    this.rep = 0;
    this.phaseStart = 0;
    this.phaseDur = 0;
    this.buf = [];
    this.restBuf = [];
    this.rest = null;
    this.live = null;
    this.paused = false;
    this.fatigueStop = false;
    this._spark = 0;
    this._sparked = false;
    this._overpullSince = 0;
    this._overpullShown = false;
  }

  get plan() { return this.plans[Math.min(this.rep, this.plans.length - 1)]; }
  get measured() { return this.ex.kind !== 'guided'; }

  start(t) { this._enter('relax', t, this.timing.first); }

  _enter(phase, t, dur) {
    this.phase = phase;
    this.phaseStart = t;
    this.phaseDur = dur;
    this.buf = [];
    this.onEvent({ type: 'phase', phase, rep: this.rep, plan: this.plan });
  }

  progress(t) { return this.phaseDur ? Math.min(1, (t - this.phaseStart) / this.phaseDur) : 0; }

  pause() { this.paused = true; this.live = null; this.onEvent({ type: 'paused' }); }

  resume(t) {
    this.paused = false;
    this._enter('relax', t, this.timing.first); // повтор начинается заново
  }

  update(t, sample) {
    if (this.paused || this.phase === 'idle' || this.phase === 'done') return;
    if (sample) this.buf.push({ t, ...sample });

    if (this.phase === 'effort' && this.measured) this._live(t, sample);

    if (t - this.phaseStart < this.phaseDur) return;

    if (this.phase === 'relax') {
      this.restBuf = this.buf.filter((s) => s.t >= this.phaseStart + this.phaseDur - REST_WINDOW);
      this.rest = this.measured ? restStats(this.restBuf, this.ex.kind, this.plan.dir) : null;
      this._sparked = false; this._spark = 0; this._overpullSince = 0;
      this._enter('effort', t, this.timing.effort);
    } else if (this.phase === 'effort') {
      this._finishRep();
      this.rep++;
      this.live = null;
      const last = this.rep >= this.plans.length;
      if (last || this.fatigueStop) this._enter('cooldown', t, COOLDOWN);
      else this._enter('relax', t, this.timing.relax);
    } else if (this.phase === 'cooldown') {
      this.phase = 'done';
      this.onEvent({ type: 'done', results: this.results, fatigue: this.fatigueStop });
    }
  }

  _finishRep() {
    const plan = this.plan;
    let res;
    if (this.measured) {
      res = analyzeRep(this.restBuf, this.buf, { kind: this.ex.kind, dir: plan.dir, target: plan.target, leak: this.ex.leak || 0 }, this.affected, !!this.ex.watchEye);
    } else {
      res = { target: plan.target, valid: false, guided: true };
    }
    res.cue = plan.cue;
    this.results.push(res);
    this.onEvent({ type: 'rep', rep: this.rep, result: res });
    // Если мышцы устали — заканчиваем упражнение раньше (не раньше 4-го повтора).
    if (this.measured && this.results.length >= 4 && this.results.length < this.plans.length && isFatigued(this.results)) {
      this.fatigueStop = true;
      this.onEvent({ type: 'fatigue' });
    }
  }

  _live(t, sample) {
    const plan = this.plan;
    this.live = liveDelta(sample, this.rest, this.ex.kind, plan.dir, this.affected, this.ex.leak || 0);
    if (!this.live) return;
    const A = this.live[this.affected], H = this.live[this.healthy];
    const affectedTargeted = plan.target === 'both' || plan.target === this.affected;

    if (affectedTargeted && !this._sparked && t - this.phaseStart > 400) {
      this._spark = A.d > A.thr ? this._spark + 1 : 0;
      if (this._spark >= 4) { this._sparked = true; this.onEvent({ type: 'spark', rep: this.rep }); }
    }

    if (this.ex.holdHealthy && !this._overpullShown && plan.target === 'both') {
      const over = H.d > 0.03 && H.d > 2.5 * Math.max(A.d, A.thr);
      if (over) {
        if (!this._overpullSince) this._overpullSince = t;
        if (t - this._overpullSince > 600) { this._overpullShown = true; this.onEvent({ type: 'overpull' }); }
      } else this._overpullSince = 0;
    }
  }
}
