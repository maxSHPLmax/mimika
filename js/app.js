import { loadLandmarker, Tracker } from './tracker.js';
import { toPixels, framingIssue, medianShape, INNER_CANTHUS } from './geometry.js';
import { makeReference, extract } from './features.js';
import { EXERCISES, POINTS, EYE, planReps, side } from './exercises.js';
import { summarizeExercise, feedbackLines, sessionIndex, sessionMovedShare } from './analysis.js';
import { ExerciseRunner, TIMING, estimateSessionSec } from './session.js';
import * as store from './storage.js';
import * as voice from './voice.js';
import * as sync from './sync.js';
import * as photos from './photos.js';
import { POSES, REST_POSE, CHECKIN_TIMING, plansFor, summarizePose, isCheckin, checkinDue, qualityFlags } from './checkin.js';
import { dist, FACE_EDGE } from './geometry.js';
import { t, setLang, getLang, locale, translateDom } from './i18n.js';

const $ = (id) => document.getElementById(id);
const other = (s) => (s === 'r' ? 'l' : 'r');
const MAX_SESSION_MS = 15 * 60 * 1000;
const MIN_LIGHT = 50;
const BASELINE_MS = 2500;
let baselineT0 = 0;
let baselineFaceFrac = null;

let settings = store.loadSettings();
setLang(settings.lang);
translateDom(document.body);
document.title = t('Мимика — гимнастика для лица');
voice.initVoice(settings.voice);

// Сторона в терминах точек MediaPipe (обычно совпадает с анатомической).
const lmAffected = () => (settings.swapSides ? other(settings.affected) : settings.affected);
const nameOf = (lmSide) => (settings.swapSides ? other(lmSide) : lmSide);

// ——— Навигация ———
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.toggleAttribute('data-active', s.id === id));
  window.scrollTo(0, 0);
  if (id === 'home') renderHome();
  if (id === 'history') renderHistory();
  if (id === 'settings') renderSettings();
  if (id === 'progress') renderProgress();
}

let massageFrom = 'home';
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (!g) return;
  if (g.dataset.go === 'massage') massageFrom = 'home';
  show(g.dataset.go);
});

let toastTimer = 0;
function toast(text, ms = 3500) {
  const el = $('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

// ——— Главная ———
function fmtTime(d) { return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); }
function fmtDay(d) {
  const today = new Date(); const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return t('сегодня');
  if (d.toDateString() === y.toDateString()) return t('вчера');
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
}
function minutes(sec) { return Math.max(1, Math.round(sec / 60)); }
// Числа по правилам языка: 1,3 (а не 1.3).
const num = (x) => (x == null ? x : Number(x).toLocaleString(locale(), { maximumFractionDigits: 1 }));

function renderHome() {
  const h = new Date().getHours();
  $('greeting').textContent = t(h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер');
  const everything = store.loadSessions();
  const all = everything.filter((s) => s.completed && !isCheckin(s));
  const today = store.sessionsToday(all).length;
  $('checkin-due').hidden = !checkinDue(everything);
  const max = settings.maxSessionsPerDay;
  $('today-dots').innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < today ? 'on' : ''}"></i>`).join('');
  $('today-text').textContent = today ? t('Сегодня {n} из {max} занятий', { n: today, max }) : t('Сегодня занятий ещё не было');
  const last = all[all.length - 1];
  $('last-session').textContent = last
    ? t('Последнее занятие: {day} в {time}, {min} мин', { day: fmtDay(new Date(last.startedAt)), time: fmtTime(new Date(last.startedAt)), min: minutes(last.durationSec) })
    : t('Займёт 10–15 минут. Понадобится подставка для телефона и хороший свет.');

  const banner = $('rest-banner');
  const tw = store.recentTwitch();
  if (tw) {
    banner.textContent = t('Вы отметили подёргивания {day}. Памятка советует перерыв 1–2 дня.', { day: fmtDay(new Date(tw.at)) });
    banner.hidden = false;
  } else if (today >= max) {
    banner.textContent = t('Сегодня уже {n} занятия — этого достаточно. Мышцам тоже нужен отдых.', { n: today });
    banner.hidden = false;
  } else banner.hidden = true;
  renderHomeSync();
}

function renderHomeSync() {
  const el = $('home-sync');
  const cfg = sync.config();
  if (!cfg) { el.hidden = true; return; }
  const st = sync.status();
  const pending = sync.pendingCount();
  el.hidden = false;
  if (pending) el.textContent = t('Ждут отправки на Raspberry Pi: {n}. Отправятся автоматически, когда сервер будет доступен.', { n: pending });
  else if (st.lastOk) el.textContent = t('Копия на Raspberry Pi: {day} в {time}.', { day: fmtDay(new Date(st.lastOk)), time: fmtTime(new Date(st.lastOk)) });
  else el.hidden = true;
}

// Тихая фоновая синхронизация.
async function autoSync() {
  if (!sync.config()) return;
  await sync.syncNow();
  if (document.getElementById('home').hasAttribute('data-active')) renderHomeSync();
  if (document.getElementById('settings').hasAttribute('data-active')) renderSync();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoSync(); });
window.addEventListener('online', autoSync);

// ——— Проверка перед занятием ———
let checkin = {};
$('btn-start').addEventListener('click', () => { voice.unlock(); checkin = {}; show('checkin'); });
$('ci-yes').addEventListener('click', () => { store.addNote({ type: 'twitch', source: 'checkin' }); show('rest'); });
$('ci-no').addEventListener('click', () => { checkin = { twitch: false }; show('premassage'); });
$('rest-ok').addEventListener('click', () => { store.addNote({ type: 'rest' }); show('home'); });
$('rest-massage').addEventListener('click', () => { massageFrom = 'home'; show('massage'); });
$('rest-anyway').addEventListener('click', () => { checkin = { twitch: true }; show('premassage'); });
$('pm-yes').addEventListener('click', () => { checkin.massage = true; massageFrom = 'session'; show('massage'); });
$('pm-skip').addEventListener('click', () => { checkin.massage = false; startStage(); });

// ——— Самомассаж ———
let massageTimer = 0;
function stopMassageTimer() { clearInterval(massageTimer); massageTimer = 0; $('massage-timer').hidden = true; $('massage-timer-btn').textContent = t('Запустить таймер на 6 минут'); $('massage-timer-btn').className = 'primary'; }
$('massage-timer-btn').addEventListener('click', () => {
  if (massageTimer) { stopMassageTimer(); return; }
  voice.unlock();
  const end = Date.now() + 6 * 60 * 1000;
  $('massage-timer').hidden = false;
  $('massage-timer-btn').textContent = t('Остановить таймер');
  $('massage-timer-btn').className = 'secondary';
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    $('massage-clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (!left) { stopMassageTimer(); voice.say(t('Самомассаж окончен')); toast(t('Самомассаж окончен')); }
  };
  tick();
  massageTimer = setInterval(tick, 500);
});
$('massage-done').addEventListener('click', () => { stopMassageTimer(); massageFrom === 'session' ? startStage() : show('home'); });
$('massage-back').addEventListener('click', () => { stopMassageTimer(); show(massageFrom === 'session' ? 'premassage' : 'home'); });

// ——— Сцена: камера ———
const video = $('video'), canvas = $('overlay'), ctx = canvas.getContext('2d');
let tracker = null, reference = null, step = null, okStreak = 0, baseline = [], lastFrameAt = 0, wakeLock = null;
let sess = null;

function setSheet(name) {
  for (const n of ['setup', 'intro', 'result', 'pause']) $(`sheet-${n}`).hidden = n !== name;
}
function setupActions(buttons) {
  const box = $('setup-actions');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = b.primary ? 'primary' : 'secondary';
    el.textContent = b.text;
    el.addEventListener('click', b.onClick);
    box.appendChild(el);
  }
}

let stageMode = 'session'; // 'session' | 'checkin'
async function startStage(mode = 'session') {
  stageMode = mode === 'checkin' ? 'checkin' : 'session';
  show('stage');
  setSheet('setup');
  $('cuebox').hidden = true;
  $('btn-pause').hidden = true;
  $('ex-name').textContent = t(stageMode === 'checkin' ? 'Еженедельная проверка' : 'Подготовка');
  $('ex-count').textContent = '';
  $('setup-checks').hidden = true;
  $('setup-title').textContent = t('Включаю камеру…');
  $('setup-text').textContent = t('Поставьте телефон на подставку на уровне глаз, примерно в 40 см от лица. Лицо — прямо к камере, свет — спереди.');
  setupActions([]);
  reference = null; baseline = []; okStreak = 0; step = null;

  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* не критично */ }

  try {
    tracker = new Tracker(video);
    await tracker.startCamera();
  } catch (e) {
    $('setup-title').textContent = t('Нет доступа к камере');
    $('setup-text').textContent = t('Разрешите доступ к камере: в Safari нажмите «аА» в адресной строке → «Настройки веб-сайта» → «Камера» → «Разрешить». Для приложения на экране «Домой» — «Настройки» iPhone → «Safari» → «Камера».');
    setupActions([{ text: t('Попробовать снова'), primary: true, onClick: () => startStage(stageMode) }, { text: t('На главную'), onClick: leaveStage }]);
    return;
  }
  $('setup-title').textContent = t('Загружаю распознавание лица…');
  try {
    await loadLandmarker();
  } catch (e) {
    $('setup-title').textContent = t('Не удалось загрузить распознавание');
    $('setup-text').textContent = t('При первом запуске нужен интернет — приложение скачивает модель (около 4 МБ). Потом она работает и без сети.');
    setupActions([{ text: t('Попробовать снова'), primary: true, onClick: () => startStage(stageMode) }, { text: t('На главную'), onClick: leaveStage }]);
    return;
  }
  $('setup-title').textContent = t('Устройтесь поудобнее');
  $('setup-checks').hidden = false;
  step = 'checks';
  tracker.start(onFrame);
}

function leaveStage() {
  step = null;
  if (tracker) tracker.stop();
  tracker = null;
  voice.stop();
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
  show('home');
}

const ISSUE_TEXT = {
  noface: 'Лицо не видно',
  far: 'Поднесите телефон ближе',
  near: 'Отодвиньте телефон чуть дальше',
  turned: 'Повернитесь лицом к камере',
  tilted: 'Держите голову ровно',
  dark: 'Мало света — повернитесь к окну или лампе',
};

function onFrame(f) {
  lastFrameAt = performance.now();
  const pts = f.landmarks ? toPixels(f.landmarks, f.w, f.h) : null;
  const framing = pts ? framingIssue(pts, f.w) : 'noface';
  const dark = f.brightness < MIN_LIGHT;
  const issue = framing || (dark ? 'dark' : null);
  if (window.__mimikaDebug) window.__mimikaDebug = { n: (window.__mimikaDebug.n || 0) + 1, t: f.t, w: f.w, h: f.h, framing, brightness: f.brightness, pts: pts && [pts[234], pts[454], pts[1], pts[133], pts[362]] };
  const el = $('issue');
  el.hidden = !issue || step === null;
  if (issue) el.textContent = t(ISSUE_TEXT[issue]);

  if (canvas.width !== f.w || canvas.height !== f.h) { canvas.width = f.w; canvas.height = f.h; }
  draw(pts);
  placeBars(pts);

  if (step === 'checks') {
    $('chk-face').classList.toggle('ok', !!pts);
    $('chk-straight').classList.toggle('ok', !!pts && !framing);
    $('chk-light').classList.toggle('ok', !dark);
    okStreak = !issue ? okStreak + 1 : 0;
    if (okStreak > 30) settings.sideConfirmed ? startBaseline() : askSides();
  } else if (step === 'baseline') {
    // Не меньше 2,5 с и 10 кадров — одинаково работает и на быстром, и на медленном телефоне.
    if (pts && !framing) baseline.push(pts);
    const p = Math.min(1, (f.t - baselineT0) / BASELINE_MS, baseline.length / 10);
    const bar = $('baseline-bar');
    if (bar) bar.style.width = `${p * 100}%`;
    if (p >= 1) {
      reference = makeReference(medianShape(baseline));
      baselineFaceFrac = dist(reference.pts[FACE_EDGE.r], reference.pts[FACE_EDGE.l]) / f.w;
      baseline = [];
      stageMode === 'checkin' ? beginCheckin(pts) : beginSession();
    }
  } else if (step === 'session' && sess?.runner && sess.runner.phase !== 'done') {
    const sample = pts && !framing ? { ok: true, ...extract(pts, reference, sess.runner.ex) } : { ok: false };
    const run = sess.runner;
    run.update(f.t, sample);
    updateLive(f.t);
    if (sess.mode === 'checkin') {
      sess.light.push(f.brightness);
      // Фото — ближе к концу усилия, по одному на попытку; оставим снимок лучшей попытки.
      if (run.phase === 'effort' && sample.ok && run.progress(f.t) > 0.75 && !sess.shots[run.rep]) {
        sess.shots[run.rep] = photos.captureFace(video, pts);
      }
    }
  }
}

// Если кадры перестали приходить (камера «задумалась»), время упражнения всё равно идёт.
setInterval(() => {
  if (step === 'session' && sess?.runner && performance.now() - lastFrameAt > 400) {
    const now = performance.now();
    sess.runner.update(now, { ok: false });
    updateLive(now);
  }
}, 250);

function askSides() {
  step = 'confirm';
  $('setup-checks').hidden = true;
  $('setup-title').textContent = t('Проверим стороны');
  $('setup-text').textContent = t('Оранжевые точки должны быть на вашей {side} стороне лица — там, где слабее движение. Голубые — на здоровой.', { side: side.gen(settings.affected) });
  setupActions([
    { text: t('Да, верно'), primary: true, onClick: () => { settings.sideConfirmed = true; store.saveSettings(settings); startBaseline(); } },
    { text: t('Нет, на другой стороне'), onClick: () => { settings.swapSides = !settings.swapSides; store.saveSettings(settings); toast(t('Поменяла стороны. Проверьте ещё раз.')); } },
  ]);
}

function startBaseline() {
  step = 'baseline';
  baseline = [];
  baselineT0 = performance.now();
  $('setup-checks').hidden = true;
  $('setup-title').textContent = t('Запоминаю лицо в покое');
  $('setup-text').innerHTML = `${t('Расслабьте лицо и спокойно смотрите в камеру пару секунд.')}<div class="progress" style="margin-top:14px"><i id="baseline-bar"></i></div>`;
  setupActions([]);
  voice.say(t('Расслабьте лицо и смотрите в камеру'));
}

// ——— Рисование ———
function groupsFor(ex) {
  if (!ex) return ['brow', 'nose', 'mouth'].map((k) => POINTS[k]).concat([eyeGroup()]);
  if (ex.kind === 'guided') return [];
  if (ex.kind === 'aperture') return [eyeGroup()];
  return [POINTS[ex.points]];
}
function eyeGroup() { return { r: [...EYE.r.up, ...EYE.r.lo], l: [...EYE.l.up, ...EYE.l.lo] }; }

function draw(pts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!pts || step === 'baseline') return;
  const ex = step === 'session' ? sess?.runner?.ex || sess?.list?.[sess.idx] : null;
  const a = lmAffected(), h = other(a);
  const r = Math.max(2.5, canvas.width / 220);
  for (const g of groupsFor(ex)) {
    for (const [s, color] of [[a, '#E49A2E'], [h, '#8FB7C0']]) {
      ctx.fillStyle = color;
      for (const i of g[s]) {
        ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function placeBars(pts) {
  if (!pts) return;
  const a = lmAffected();
  // Картинка отзеркалена: у кого x в кадре меньше, тот на экране справа.
  const aRight = pts[INNER_CANTHUS[a]][0] < pts[INNER_CANTHUS[other(a)]][0];
  $('bar-a').classList.toggle('right', aRight); $('bar-a').classList.toggle('left', !aRight);
  $('bar-h').classList.toggle('right', !aRight); $('bar-h').classList.toggle('left', aRight);
}

function barHeight(d, scale) { return Math.min(1, Math.pow(Math.max(0, d) / scale, 0.6)) * 100; }

function updateLive(now) {
  const run = sess?.runner;
  if (!run) return;
  $('phase-fill').style.width = `${run.progress(now) * 100}%`;
  const showBars = run.measured && run.phase === 'effort';
  $('bar-a').classList.toggle('visible', showBars);
  $('bar-h').classList.toggle('visible', showBars);
  const live = run.live;
  if (window.__mimikaDebug && live) window.__mimikaDebug.live = { a: lmAffected(), phase: run.phase, live };
  const scale = run.ex.kind === 'aperture' ? 1 : run.ex.scale || 0.05;
  const a = lmAffected();
  $('bar-a').firstElementChild.style.height = live ? `${barHeight(live[a].d, scale)}%` : '0%';
  $('bar-h').firstElementChild.style.height = live ? `${barHeight(live[other(a)].d, scale)}%` : '0%';
}

// ——— Занятие ———
function beginSession() {
  step = 'session';
  const list = EXERCISES.filter((e) => settings.enabled[e.id]);
  sess = {
    t0: performance.now(),
    list,
    idx: 0,
    runner: null,
    hint: '',
    record: {
      id: Date.now().toString(36),
      startedAt: new Date().toISOString(),
      affected: settings.affected,
      checkin,
      exercises: [],
      completed: false,
    },
  };
  showIntro();
}

function showIntro() {
  const ex = sess.list[sess.idx];
  sess.runner = null;
  $('cuebox').hidden = true;
  $('btn-pause').hidden = true;
  $('ex-name').textContent = t(ex.title);
  $('ex-count').textContent = t('Упражнение {i} из {n}', { i: sess.idx + 1, n: sess.list.length });
  $('intro-region').textContent = t(ex.region);
  $('intro-title').textContent = t(ex.title);
  const paras = [...ex.howto];
  if (ex.voiceNote) paras.push(ex.voiceNote);
  $('intro-text').innerHTML = paras.map((p) => `<p>${t(p)}</p>`).join('');
  $('intro-hand-wrap').hidden = !ex.hand;
  $('intro-hand').checked = false;
  setSheet('intro');
  voice.say(`${t(ex.title)}. ${t(ex.howto[0])}`);
}

$('intro-start').addEventListener('click', () => { voice.unlock(); runExercise(); });
$('intro-skip').addEventListener('click', () => {
  const ex = sess.list[sess.idx];
  sess.record.exercises.push({ id: ex.id, title: ex.title, skipped: true });
  nextExercise();
});

function runExercise() {
  const ex = sess.list[sess.idx];
  const plans = planReps(ex, settings.reps, lmAffected(), nameOf);
  sess.assisted = ex.hand && $('intro-hand').checked;
  sess.hint = '';
  sess.runner = new ExerciseRunner({ ex, plans, affected: lmAffected(), timing: TIMING[settings.tempo] || TIMING.slow, onEvent: onRunnerEvent });
  setSheet(null);
  $('cuebox').hidden = false;
  $('btn-pause').hidden = false;
  sess.runner.start(performance.now());
}

function onRunnerEvent(e) {
  const run = sess.runner;
  const ex = run.ex;
  const box = $('cuebox');
  if (e.type === 'phase') {
    box.classList.toggle('effort', e.phase === 'effort');
    $('ex-count').textContent = t('Повтор {i} из {n}', { i: Math.min(e.rep + 1, run.plans.length), n: run.plans.length });
    const cue = t(e.plan.cue);
    if (e.phase === 'relax') {
      const first = e.rep === 0;
      const text = t(first ? 'Расслабьте лицо' : ex.relaxCue || 'Расслабьте');
      $('cue').textContent = text;
      $('cue-hint').textContent = t('Дальше: {cue}', { cue: cue[0].toLowerCase() + cue.slice(1) });
      voice.say(text);
    } else if (e.phase === 'effort') {
      $('cue').textContent = cue;
      $('cue-hint').textContent = sess.hint || t('Плавно, без усилия');
      voice.say(cue);
    } else if (e.phase === 'cooldown') {
      const text = t(ex.relaxCue || 'Расслабьте');
      $('cue').textContent = text;
      $('cue-hint').textContent = '';
      voice.say(text);
    }
  } else if (e.type === 'spark') {
    const bar = $('bar-a');
    bar.classList.remove('spark'); void bar.offsetWidth; bar.classList.add('spark');
    $('cue-hint').textContent = t('Есть движение {side}!', { side: side.adv(settings.affected) });
  } else if (e.type === 'overpull') {
    sess.hint = t('Мягче. Здоровую сторону можно придержать ладонью');
    $('cue-hint').textContent = sess.hint;
  } else if (e.type === 'fatigue') {
    toast(t('Движения стали слабее — мышцы устали. Заканчиваем это упражнение.'));
  } else if (e.type === 'done') {
    sess.mode === 'checkin' ? finishPose(e.results) : finishExercise(e.results);
  }
}

function finishExercise(results) {
  const run = sess.runner;
  const ex = run.ex;
  const sum = summarizeExercise(ex, results, lmAffected(), sess.assisted);
  const lines = feedbackLines(sum, settings.affected);
  sess.record.exercises.push({
    ...sum,
    lines,
    detail: results.map((r) => ({ t: r.target, v: r.valid, a: r.dA, h: r.dH, ma: r.movedA, mh: r.movedH, ra: r.ratio, sy: r.syn || undefined })),
  });
  sess.runner = null;
  $('cuebox').hidden = true;
  $('btn-pause').hidden = true;
  $('bar-a').classList.remove('visible'); $('bar-h').classList.remove('visible');
  const overtime = performance.now() - sess.t0 > MAX_SESSION_MS;
  const shown = [...lines];
  if (overtime) shown.push(t('Прошло 15 минут — на сегодня достаточно.'));
  $('result-title').textContent = t(ex.title);
  $('result-text').innerHTML = shown.map((l) => `<p>${l}</p>`).join('');
  const last = sess.idx >= sess.list.length - 1 || overtime;
  $('result-next').textContent = t(last ? 'Завершить занятие' : 'Следующее упражнение');
  sess.lastOrOver = last;
  setSheet('result');
  voice.say(shown[0]);
}

$('result-next').addEventListener('click', () => (sess.lastOrOver ? finishSession() : nextExercise()));

function nextExercise() {
  sess.idx++;
  if (sess.idx >= sess.list.length || performance.now() - sess.t0 > MAX_SESSION_MS) finishSession();
  else showIntro();
}

$('btn-pause').addEventListener('click', () => {
  if (!sess?.runner) return;
  sess.runner.pause();
  voice.stop();
  $('cuebox').hidden = true;
  $('bar-a').classList.remove('visible'); $('bar-h').classList.remove('visible');
  setSheet('pause');
});
$('pause-resume').addEventListener('click', () => {
  setSheet(null);
  $('cuebox').hidden = false;
  sess.runner.resume(performance.now());
});
$('pause-skip').addEventListener('click', () => {
  const run = sess.runner;
  if (run && run.results.length) finishExercise(run.results);
  else {
    const ex = sess.list[sess.idx];
    sess.record.exercises.push({ id: ex.id, title: ex.title, skipped: true });
    sess.runner = null;
    nextExercise();
  }
});
$('btn-end').addEventListener('click', () => {
  if (step !== 'session') { leaveStage(); return; }
  if (sess?.mode === 'checkin') { if (confirm(t('Прервать проверку? Результат не сохранится.'))) { sess = null; leaveStage(); } return; }
  if (confirm(t('Завершить занятие?'))) finishSession();
});

// ——— Еженедельная проверка ———
function beginCheckin(restPts) {
  step = 'session';
  sess = {
    mode: 'checkin', t0: performance.now(), list: POSES, idx: 0, runner: null, hint: '', shots: {}, light: [],
    record: {
      id: Date.now().toString(36), kind: 'checkin', startedAt: new Date().toISOString(),
      affected: settings.affected, poses: [], completed: false, quality: { faceFrac: baselineFaceFrac && +baselineFaceFrac.toFixed(3) },
    },
  };
  const id = sess.record.id;
  photos.captureFace(video, restPts).then((b) => b && photos.putPhoto(`${id}:rest`, b));
  $('btn-pause').hidden = true;
  voice.say(t('Проверка. Четыре выражения, по две попытки. Спокойно, как на занятиях.'));
  setTimeout(() => { if (sess?.mode === 'checkin' && step === 'session') runPose(); }, 3000);
}

function runPose() {
  const pose = sess.list[sess.idx];
  sess.shots = {};
  sess.hint = '';
  $('ex-name').textContent = t('Проверка: {pose}', { pose: t(pose.short).toLowerCase() });
  sess.runner = new ExerciseRunner({ ex: pose, plans: plansFor(pose, lmAffected(), nameOf), affected: lmAffected(), timing: CHECKIN_TIMING, onEvent: onRunnerEvent });
  setSheet(null);
  $('cuebox').hidden = false;
  sess.runner.start(performance.now());
}

async function finishPose(results) {
  const pose = sess.list[sess.idx];
  const sum = summarizePose(pose, results);
  const shot = await (sess.shots[sum.bestRep ?? 0] || sess.shots[0] || sess.shots[1] || null);
  if (shot) { await photos.putPhoto(`${sess.record.id}:${pose.id}`, shot); sum.photo = true; }
  sess.record.poses.push(sum);
  sess.runner = null;
  $('bar-a').classList.remove('visible'); $('bar-h').classList.remove('visible');
  sess.idx++;
  if (sess.idx < sess.list.length) runPose(); else finishCheckin();
}

function finishCheckin() {
  const rec = sess.record;
  rec.endedAt = new Date().toISOString();
  rec.durationSec = Math.round((Date.parse(rec.endedAt) - Date.parse(rec.startedAt)) / 1000);
  rec.completed = rec.poses.some((p) => p.valid > 0);
  const L = sess.light;
  rec.quality.light = L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : null;
  if (rec.completed) { store.saveSession(rec); autoSync(); }
  stopStage();
  voice.say(t(rec.completed ? 'Проверка завершена. Спасибо!' : 'Не получилось измерить. Попробуйте при лучшем свете.'));
  $('cuebox').hidden = true;
  progressPose = 'smile';
  show('progress');
  toast(t(rec.completed ? 'Проверка сохранена' : 'Не удалось измерить — попробуйте при лучшем свете'), 4000);
}

function stopStage() {
  step = null;
  if (tracker) tracker.stop();
  tracker = null;
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

function finishSession() {
  const rec = sess.record;
  rec.endedAt = new Date().toISOString();
  rec.durationSec = Math.round((Date.parse(rec.endedAt) - Date.parse(rec.startedAt)) / 1000);
  const done = rec.exercises.filter((e) => !e.skipped);
  rec.completed = done.length > 0;
  rec.index = sessionIndex(done);
  rec.movedShare = sessionMovedShare(done);
  if (rec.completed) { store.saveSession(rec); autoSync(); }
  step = null;
  if (tracker) tracker.stop();
  tracker = null;
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
  voice.say(t('Занятие завершено. Спасибо!'));
  renderSummary(rec);
  show('summary');
}

// ——— Итог ———
let summaryRec = null;
function meter(moved, total) {
  if (!total) return '';
  return `<span class="meter" aria-label="${t('{a} из {b}', { a: moved, b: total })}">${Array.from({ length: total }, (_, i) => `<i class="${i < moved ? 'on' : ''}"></i>`).join('')}</span>`;
}

function renderSummary(rec) {
  summaryRec = rec;
  const done = rec.exercises.filter((e) => !e.skipped);
  $('sum-title').textContent = t(rec.completed ? 'Занятие завершено' : 'Занятие прервано');
  $('sum-meta').textContent = t('{min} мин. Выполнено упражнений: {done} из {all}.', { min: minutes(rec.durationSec), done: done.length, all: rec.exercises.length || done.length });
  const note = $('sum-note');
  const totalMoved = done.reduce((n, e) => n + (e.movedA || 0), 0);
  if (rec.completed) {
    note.hidden = false;
    note.textContent = totalMoved
      ? t('Камера увидела движение на {side} стороне в {n} повторах. Каждый такой импульс — это работа нерва.', { side: side.gen(rec.affected), n: totalMoved })
      : t('Сегодня камера не увидела движения на поражённой стороне. После операции восстановление обычно занимает недели и месяцы — регулярные спокойные попытки важнее результата каждого дня.');
  } else note.hidden = true;
  $('sum-list').innerHTML = rec.exercises.map((e) => `
    <li>
      <div class="r-title"><span>${t(e.title)}</span>${e.skipped ? `<span class="muted small">${t('пропущено')}</span>` : meter(e.movedA || 0, e.aTotal || 0)}</div>
      ${e.skipped ? '' : `<div class="r-lines">${(e.lines || []).join(' ')}</div>`}
    </li>`).join('');
  document.querySelectorAll('[data-feel]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
}

document.querySelectorAll('[data-feel]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-feel]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  if (!summaryRec) return;
  summaryRec.after = b.dataset.feel;
  if (summaryRec.completed) { store.saveSession(summaryRec); autoSync(); }
  if (b.dataset.feel === 'twitch') {
    store.addNote({ type: 'twitch', source: 'after' });
    toast(t('Отмечено. Памятка советует перерыв на 1–2 дня.'), 5000);
  }
}));
$('sum-save').addEventListener('click', () => show('home'));
$('sum-copy').addEventListener('click', () => summaryRec && share(reportText([summaryRec])));

// ——— Отчёт ———
const FEEL = { good: 'хорошо', tired: 'устало', twitch: 'подёргивания' };

function reportText(sessions) {
  const out = [t('Мимика — отчёт о лицевой гимнастике'), ''];
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    out.push(t('{date} {time}, {min} мин. Поражённая сторона: {side}.', { date: d.toLocaleDateString(locale()), time: fmtTime(d), min: minutes(s.durationSec), side: side.nom(s.affected) }));
    if (s.checkin?.massage) out.push(t('Перед занятием — самомассаж.'));
    for (const e of s.exercises) {
      const title = t(e.title);
      if (e.skipped) { out.push(`— ${title}: ${t('пропущено')}`); continue; }
      if (e.kind === 'guided') { out.push(`— ${title}: ${t('выполнено')}`); continue; }
      const parts = [];
      if (e.aTotal) parts.push(t('движение на поражённой стороне в {m} из {n} повторов', { m: e.movedA, n: e.aTotal }));
      if (e.ratio != null) parts.push(t('≈{p}% от здоровой стороны', { p: Math.round(e.ratio * 100) }));
      if (e.kind === 'disp' && e.mmA != null) parts.push(t('≈{a} мм против {h} мм', { a: num(e.mmA), h: num(e.mmH) }));
      if (e.kind === 'aperture' && e.id === 'eye_close' && e.closeA != null) parts.push(t('глаз закрывается ≈ на {a}% (здоровый — {h}%)', { a: e.closeA, h: e.closeH }));
      if (e.assisted) parts.push(t('с помощью пальцев'));
      if (e.fatigue) parts.push(t('к концу — усталость'));
      if (e.syn) parts.push(t('прищуривание глаза при движении рта в {n} повторах', { n: e.syn }));
      out.push(`— ${title}: ${parts.join('; ') || t('нет данных камеры')}`);
    }
    if (s.after) out.push(t('После занятия: {feel}.', { feel: t(FEEL[s.after]) }));
    out.push('');
  }
  out.push(t('Измерения приблизительные (камера телефона). Не является медицинским заключением.'));
  return out.join('\n');
}

async function share(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast(t('Отчёт скопирован')); } catch { toast(t('Не удалось скопировать')); }
}

// ——— История ———
function renderHistory() {
  $('hist-dashboard').hidden = !sync.config();
  const all = store.loadSessions().filter((s) => s.completed && !isCheckin(s));
  const chart = $('hist-chart');
  const pts = all.slice(-20);
  if (pts.length < 2) {
    chart.innerHTML = `<p class="empty">${t(pts.length ? 'После второго занятия здесь появится график.' : 'Пока нет занятий. Первое займёт 10–15 минут.')}</p>`;
  } else {
    const W = 320, H = 150, L = 34, R = 10, T = 10, B = 26;
    const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
    const y = (v) => T + (1 - Math.min(1, v)) * (H - T - B);
    const line = pts.map((s, i) => (s.index == null ? null : `${x(i)},${y(s.index)}`)).filter(Boolean).join(' ');
    const dots = pts.map((s, i) => (s.movedShare == null ? '' : `<circle cx="${x(i)}" cy="${y(s.movedShare)}" r="3.5" fill="#E49A2E" opacity=".8"/>`)).join('');
    const grid = [0, 0.5, 1].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#C9D4D8" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#5B6C75">${v * 100}%</text>`).join('');
    const d0 = new Date(pts[0].startedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
    const d1 = new Date(pts[pts.length - 1].startedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
    chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('График восстановления')}">
      ${grid}
      <polyline points="${line}" fill="none" stroke="#1E2B33" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
      <text x="${L}" y="${H - 6}" font-size="11" fill="#5B6C75">${d0}</text>
      <text x="${W - R}" y="${H - 6}" font-size="11" text-anchor="end" fill="#5B6C75">${d1}</text>
    </svg>`;
  }
  $('hist-list').innerHTML = all.slice().reverse().map((s) => {
    const d = new Date(s.startedAt);
    const items = s.exercises.filter((e) => !e.skipped && e.kind !== 'guided')
      .map((e) => `<li>${t(e.title)}: ${e.aTotal ? t('движение в {m} из {n}', { m: e.movedA, n: e.aTotal }) : t('нет данных')}${e.ratio != null ? `, ≈${Math.round(e.ratio * 100)}%` : ''}</li>`).join('');
    return `<details><summary><span>${fmtDay(d)}, ${fmtTime(d)}</span><span class="h-meta">${t('{min} мин', { min: minutes(s.durationSec) })}${s.after ? `, ${t(FEEL[s.after])}` : ''}</span></summary><ul>${items}</ul></details>`;
  }).join('');
}

// Дашборд на Raspberry Pi: ключ передаётся во фрагменте (#k=…), он не уходит на сервер в URL,
// страница сразу убирает его из адресной строки и хранит у себя.
function openDashboard() {
  const cfg = sync.config();
  if (!cfg) return;
  window.open(`${cfg.url}/dashboard#k=${encodeURIComponent(cfg.token)}&l=${getLang()}`, '_blank', 'noopener');
}
$('sync-dashboard').addEventListener('click', openDashboard);
$('hist-dashboard').addEventListener('click', openDashboard);

$('hist-copy').addEventListener('click', () => {
  const since = Date.now() - 7 * 864e5;
  const recent = store.loadSessions().filter((s) => s.completed && !isCheckin(s) && Date.parse(s.startedAt) > since);
  if (!recent.length) { toast(t('За последние 7 дней занятий нет')); return; }
  share(reportText(recent));
});

// ——— Прогресс (еженедельные проверки) ———
let progressPose = 'smile';
const objectUrls = [];
const cap = (str) => str[0].toUpperCase() + str.slice(1);

$('pg-start').addEventListener('click', () => { voice.unlock(); startStage('checkin'); });

async function photoUrl(key) {
  const b = await photos.getPhoto(key);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  objectUrls.push(u);
  return u;
}

function renderProgress() {
  objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  const all = store.loadSessions().filter((x) => isCheckin(x) && x.completed)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const body = $('pg-body');
  $('pg-start').textContent = t(all.length ? 'Сделать проверку' : 'Сделать первую проверку');
  if (!all.length) {
    body.innerHTML = `<p class="muted pg-block">${t('Первая проверка станет точкой отсчёта. Через неделю здесь появится сравнение.')}</p>`;
    return;
  }
  const first = all[0], last = all[all.length - 1], two = all.length > 1;
  const A = side.adv(settings.affected), H = side.adv(other(settings.affected));
  const poses = [REST_POSE, ...POSES];
  let html = `<div class="pg-block"><h3>${t(two ? 'Фото: первая и последняя проверка' : 'Фото: точка отсчёта')}</h3>
    <div class="pose-seg" id="pg-seg">${poses.map((p) => `<button data-pose="${p.id}" aria-pressed="${p.id === progressPose}">${t(p.short)}</button>`).join('')}</div>
    <div class="compare">
      <figure><div class="ph" id="ph-first">…</div><figcaption>${t(two ? 'Первая: {day}' : 'Точка отсчёта: {day}', { day: fmtDay(new Date(first.startedAt)) })}</figcaption></figure>
      ${two ? `<figure><div class="ph" id="ph-last">…</div><figcaption>${t('Последняя: {day}', { day: fmtDay(new Date(last.startedAt)) })}</figcaption></figure>`
            : `<figure><div class="ph">${t('Через неделю здесь появится новое фото для сравнения')}</div></figure>`}
    </div></div>`;
  html += `<div class="pg-block"><h3>${t('Что видела камера')}</h3>
    <p class="muted small">${t('Сплошная линия — {a} (лучшая из двух попыток), полоса — разброс попыток. Пунктир — {h}. Оранжевая точка — неделя с неидеальными условиями.', { a: A, h: H })}</p>`;
  for (const p of POSES) html += trendCard(p, all, first, A, H);
  html += '</div>';
  html += `<div class="pg-block"><h3>${t('Все проверки')}</h3><div class="ci-list">${all.slice().reverse().map((c) => {
    const fl = qualityFlags(c, first);
    return `<div>${cap(fmtDay(new Date(c.startedAt)))}, ${fmtTime(new Date(c.startedAt))}${fl.length ? `<div class="flags">${fl.join(', ')}</div>` : ''}</div>`;
  }).join('')}</div></div>`;
  body.innerHTML = html;
  $('pg-seg').onclick = (e) => {
    const b = e.target.closest('[data-pose]');
    if (!b) return;
    progressPose = b.dataset.pose;
    document.querySelectorAll('#pg-seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    loadComparePhotos(first, last, two);
  };
  loadComparePhotos(first, last, two);
}

async function loadComparePhotos(first, last, two) {
  const set = async (el, rec) => {
    if (!el) return;
    const u = await photoUrl(`${rec.id}:${progressPose}`);
    el.innerHTML = u ? `<img alt="${t('Фото проверки')}" src="${u}">` : t('Фото нет');
  };
  await set($('ph-first'), first);
  if (two) await set($('ph-last'), last);
}

function trendCard(pose, all, first, A, H) {
  const pts = all.map((c) => ({ c, v: (c.poses || []).find((x) => x.id === pose.id) })).filter((x) => x.v && x.v.a);
  if (!pts.length) return `<div class="trend"><div class="tt">${t(pose.title)}</div><div class="tv">${t('Нет данных')}</div></div>`;
  const lv = pts[pts.length - 1].v, pct = lv.unit === '%';
  const mm = t('мм');
  const u = pct ? '%' : ` ${mm}`;
  const range = (o) => (o.lo === o.hi ? '' : ` ${t('(попытки {lo}–{hi}{u})', { lo: num(o.lo), hi: num(o.hi), u })}`);
  const sideText = (o, name) => (o.best > 0
    ? (pct ? t('глаз {side} закрывается ≈ на {v}%{range}', { side: name, v: num(o.best), range: range(o) })
           : t('{side} ≈{v} мм{range}', { side: name, v: num(o.best), range: range(o) }))
    : t('{side} движение не обнаружено', { side: name }));
  const text = t('Последняя: {a}; {h}.', { a: sideText(lv.a, A), h: sideText(lv.h, H) });
  const W = 320, Hh = 110, L = 30, R = 10, T = 8, B = 18;
  const max = pct ? 100 : Math.max(2, ...pts.map((p) => Math.max(p.v.a.hi, p.v.h.best))) * 1.1;
  const n = pts.length;
  const x = (i) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (1 - Math.min(v, max) / max) * (Hh - T - B);
  let svg = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${t('{title}: тренд', { title: t(pose.title) })}">`;
  svg += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#C9D4D8"/>`;
  svg += `<text x="${L - 5}" y="${y(0) + 4}" font-size="10" text-anchor="end" fill="#5B6C75">0</text>`;
  svg += `<text x="${L - 5}" y="${y(max) + 8}" font-size="10" text-anchor="end" fill="#5B6C75">${pct ? '100%' : `${Math.round(max)} ${mm}`}</text>`;
  if (n > 1) {
    const band = pts.map((p, i) => `${x(i)},${y(p.v.a.hi)}`).concat(pts.slice().reverse().map((p, j) => `${x(n - 1 - j)},${y(p.v.a.lo)}`)).join(' ');
    svg += `<polygon points="${band}" fill="#F6D9A8" opacity=".7"/>`;
    svg += `<polyline points="${pts.map((p, i) => `${x(i)},${y(p.v.h.best)}`).join(' ')}" fill="none" stroke="#4C7C88" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    svg += `<polyline points="${pts.map((p, i) => `${x(i)},${y(p.v.a.best)}`).join(' ')}" fill="none" stroke="#1E2B33" stroke-width="2"/>`;
  }
  pts.forEach((p, i) => {
    const flagged = qualityFlags(p.c, first).length > 0;
    svg += `<circle cx="${x(i)}" cy="${y(p.v.a.best)}" r="${flagged ? 4.5 : 3}" fill="${flagged ? '#E49A2E' : '#1E2B33'}"><title>${fmtDay(new Date(p.c.startedAt))}: ${num(p.v.a.best)}${u}</title></circle>`;
  });
  const d = (c) => new Date(c.startedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  svg += `<text x="${x(0)}" y="${Hh - 4}" font-size="10" text-anchor="${n === 1 ? 'middle' : 'start'}" fill="#5B6C75">${d(pts[0].c)}</text>`;
  if (n > 1) svg += `<text x="${x(n - 1)}" y="${Hh - 4}" font-size="10" text-anchor="end" fill="#5B6C75">${d(pts[n - 1].c)}</text>`;
  svg += '</svg>';
  return `<div class="trend"><div class="tt"><span>${t(pose.title)}</span></div><div class="tv">${text}</div>${svg}</div>`;
}

// ——— Настройки ———
function renderSettings() {
  document.querySelectorAll('input[name="lang"]').forEach((i) => (i.checked = i.value === getLang()));
  document.querySelectorAll('input[name="affected"]').forEach((i) => (i.checked = i.value === settings.affected));
  document.querySelectorAll('input[name="reps"]').forEach((i) => (i.checked = +i.value === settings.reps));
  document.querySelectorAll('input[name="tempo"]').forEach((i) => (i.checked = i.value === settings.tempo));
  renderTempoHint();
  $('set-voice').checked = settings.voice;
  $('set-swap').checked = settings.swapSides;
  renderSync();
  $('set-exercises').innerHTML = EXERCISES.map((e) => `<label class="toggle"><input type="checkbox" data-ex="${e.id}" ${settings.enabled[e.id] ? 'checked' : ''}> <span>${t(e.title)}</span></label>`).join('');
}

function saveSettingsNow() { store.saveSettings(settings); }
// Смена языка: сохраняем и перезагружаем — так весь интерфейс и голос сразу на новом языке.
document.querySelectorAll('input[name="lang"]').forEach((i) => i.addEventListener('change', () => { settings.lang = i.value; saveSettingsNow(); location.reload(); }));
document.querySelectorAll('input[name="affected"]').forEach((i) => i.addEventListener('change', () => { settings.affected = i.value; settings.sideConfirmed = false; saveSettingsNow(); }));
document.querySelectorAll('input[name="reps"]').forEach((i) => i.addEventListener('change', () => { settings.reps = +i.value; saveSettingsNow(); }));
document.querySelectorAll('input[name="tempo"]').forEach((i) => i.addEventListener('change', () => { settings.tempo = i.value; saveSettingsNow(); renderTempoHint(); }));

// Подсказка о темпе и примерной длительности занятия (памятка: 10–15 минут).
const tr = t; // внутри renderTempoHint имя t занято темпом
function renderTempoHint() {
  const t = TIMING[settings.tempo] || TIMING.slow;
  const mins = Math.round(estimateSessionSec(EXERCISES.filter((e) => settings.enabled[e.id]), settings.reps, t) / 60);
  let text = tr('Напряжение {e} с, отдых {r} с. Занятие займёт около {min} мин.', { e: t.effort / 1000, r: t.relax / 1000, min: mins });
  if (mins > 15) text += ` ${tr('Это больше 15 минут из памятки — уменьшите число повторов или отключите часть упражнений.')}`;
  $('tempo-hint').textContent = text;
}
$('set-voice').addEventListener('change', (e) => { settings.voice = e.target.checked; voice.setVoice(settings.voice); saveSettingsNow(); });
$('set-swap').addEventListener('change', (e) => { settings.swapSides = e.target.checked; settings.sideConfirmed = false; saveSettingsNow(); });
$('set-exercises').addEventListener('change', (e) => {
  const id = e.target.dataset.ex;
  if (!id) return;
  settings.enabled[id] = e.target.checked;
  if (!Object.values(settings.enabled).some(Boolean)) { settings.enabled[id] = true; e.target.checked = true; toast(t('Нужно оставить хотя бы одно упражнение')); }
  saveSettingsNow();
});
$('set-export').addEventListener('click', async () => {
  const json = store.exportAll();
  const name = `mimika-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
// ——— Резервная копия на Raspberry Pi ———
function renderSync() {
  const cfg = sync.config();
  const box = $('sync-status');
  $('sync-setup').hidden = !!cfg;
  $('sync-actions').hidden = !cfg;
  box.className = 'sync-status';
  if (!cfg) { box.textContent = t('Не настроено. История хранится только на этом телефоне.'); return; }
  const st = sync.status();
  const pending = sync.pendingCount();
  const parts = [t('Сервер: {host}.', { host: sync.hostLabel(cfg.url) })];
  if (st.lastOk) parts.push(t('Последняя копия: {day} в {time}.', { day: fmtDay(new Date(st.lastOk)), time: fmtTime(new Date(st.lastOk)) }));
  if (st.serverCount != null) parts.push(t('Занятий на сервере: {n}.', { n: st.serverCount }));
  if (pending) parts.push(t('Ждут отправки: {n}.', { n: pending }));
  if (st.lastError && (!st.lastOk || st.lastError.at > st.lastOk)) {
    parts.push(sync.errorText(st.lastError.code, st.lastError.status));
    box.classList.add('warn');
  } else box.classList.add('ok');
  box.textContent = parts.join(' ');
}

function busy(btn, text) {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = text;
  return () => { btn.disabled = false; btn.textContent = old; };
}

$('sync-paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) $('sync-code').value = text.trim();
  } catch { toast(t('Не удалось вставить. Нажмите на поле и выберите «Вставить».')); $('sync-code').focus(); }
});

$('sync-connect').addEventListener('click', async () => {
  const cfg = sync.parseSetup($('sync-code').value);
  if (!cfg) { toast(sync.errorText('badcode'), 5000); return; }
  const done = busy($('sync-connect'), t('Проверяю…'));
  try {
    const onServer = await sync.check(cfg);
    sync.saveConfig(cfg);
    settings = store.loadSettings();
    $('sync-code').value = '';
    const localCount = store.loadSessions().filter((x) => x.completed).length;
    await sync.syncNow();
    renderSync();
    toast(t('Подключено. Занятия будут сохраняться на Raspberry Pi.'), 4000);
    if (onServer > 0 && localCount === 0 && confirm(t('На сервере уже есть занятия: {n}. Загрузить их на телефон?', { n: onServer }))) {
      await doRestore();
    }
  } catch (e) {
    toast(sync.errorText(e.code, e.status), 6000);
  } finally { done(); }
});

$('sync-now').addEventListener('click', async () => {
  const done = busy($('sync-now'), t('Отправляю…'));
  const r = await sync.syncNow();
  done();
  renderSync();
  toast(r.ok ? (r.sent ? t('Отправлено занятий: {n}', { n: r.sent }) : t('Всё уже сохранено на сервере')) : sync.errorText(r.error, r.status), r.ok ? 3000 : 6000);
});

async function doRestore() {
  try {
    const r = await sync.restore();
    settings = store.loadSettings();
    voice.setVoice(settings.voice);
    renderSettings();
    toast(r.added ? t('Восстановлено занятий: {n}', { n: r.added }) : t('Новых занятий на сервере нет — всё уже на телефоне'), 4000);
  } catch (e) {
    toast(sync.errorText(e.code, e.status), 6000);
  }
}
$('sync-restore').addEventListener('click', async () => {
  if (!confirm(t('Загрузить историю с сервера? Занятия на телефоне сохранятся, недостающие будут добавлены.'))) return;
  const done = busy($('sync-restore'), t('Загружаю…'));
  await doRestore();
  done();
});

$('sync-forget').addEventListener('click', () => {
  if (!confirm(t('Отключить резервную копию? Данные на телефоне и на сервере останутся, но новые занятия перестанут отправляться.'))) return;
  sync.saveConfig(null);
  settings = store.loadSettings();
  renderSync();
});

$('set-clear').addEventListener('click', () => {
  if (!confirm(t('Удалить все занятия и настройки с этого телефона? Копия на Raspberry Pi, если она подключена, останется.'))) return;
  store.clearAll();
  photos.clearPhotos();
  settings = store.loadSettings();
  renderSettings();
  toast(t('Данные удалены'));
});

// ——— Запуск ———
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Просим браузер не удалять данные при нехватке места.
navigator.storage?.persist?.().catch(() => {});
renderHome();
autoSync();
