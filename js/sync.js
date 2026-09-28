// Резервная копия на Raspberry Pi (через Tailscale).
// Занятия уходят на сервер после каждого сохранения; если сервер недоступен —
// остаются в очереди и отправляются при следующей возможности.
import * as store from './storage.js';

const STATE_KEY = 'mimika.syncstate.v1';
const TIMEOUT_MS = 12000;
let running = null;

function readState() {
  try { return { synced: {}, notesSynced: 0, ...JSON.parse(localStorage.getItem(STATE_KEY) || '{}') }; } catch { return { synced: {}, notesSynced: 0 }; }
}
function writeState(s) { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

export function config() {
  const s = store.loadSettings().sync;
  return s && s.url && s.token ? s : null;
}

// Код настройки из install.sh: mimika-sync|https://host:8443|token
export function parseSetup(text) {
  const clean = String(text || '')
    .normalize('NFKC')                                   // полноширинные символы → обычные (｜ → |)
    .replace(/[\u2223\u2502\u00A6\u01C0]/g, '|')         // другие «вертикальные черты»
    .replace(/[\s\u200B-\u200F\u2028-\u202F\u2060\uFEFF]/g, ''); // пробелы, переносы, невидимые символы
  // https обязателен; http допускается только для localhost (разработка)
  const m = clean.match(/mimika-sync\|(https:\/\/[^|]+?|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)\/?\|([A-Za-z0-9_-]{16,})$/i);
  return m ? { url: m[1], token: m[2] } : null;
}

export function saveConfig(cfg) {
  const s = store.loadSettings();
  s.sync = cfg ? { url: cfg.url, token: cfg.token } : null;
  store.saveSettings(s);
  if (!cfg) localStorage.removeItem(STATE_KEY);
}

export function hostLabel(url) {
  try { return new URL(url).hostname.split('.')[0]; } catch { return url; }
}

class SyncError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

async function request(cfg, path, { method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(cfg.url + path, {
      method,
      headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch (e) {
    throw new SyncError(e.name === 'AbortError' ? 'timeout' : 'network');
  } finally { clearTimeout(timer); }
  if (res.status === 401) throw new SyncError('auth', 401);
  if (!res.ok) throw new SyncError('server', res.status);
  return res.json();
}

export function errorText(code, status) {
  switch (code) {
    case 'network': return 'Сервер недоступен. Проверьте, что на iPhone включён Tailscale, а Raspberry Pi работает.';
    case 'timeout': return 'Сервер не ответил вовремя.';
    case 'auth': return 'Неверный ключ доступа — вставьте код настройки заново.';
    case 'badcode': return 'Код не распознан. Он должен начинаться с «mimika-sync|https://».';
    default: return `Ошибка сервера${status ? ` (${status})` : ''}.`;
  }
}

// Проверка связи: сервер отвечает и ключ подходит. Возвращает число занятий на сервере.
export async function check(cfg) {
  const r = await request(cfg, '/api/health');
  if (r.sessions == null) throw new SyncError('auth', 401);
  return r.sessions;
}

function publicSettings() {
  const { sync, ...rest } = store.loadSettings();
  return rest;
}

export function pendingCount() {
  if (!config()) return 0;
  const st = readState();
  return store.loadSessions().filter((s) => s.completed && st.synced[s.id] !== s.updatedAt).length;
}

// Отправить всё, что ещё не на сервере. Одновременно выполняется только одна синхронизация.
export function syncNow() {
  if (running) return running;
  running = (async () => {
    const cfg = config();
    if (!cfg) return { ok: false, skipped: true };
    const st = readState();
    const sessions = store.loadSessions().filter((s) => s.completed && st.synced[s.id] !== s.updatedAt);
    const notes = store.loadNotes();
    try {
      if (!sessions.length && notes.length === st.notesSynced && st.lastOk) {
        return { ok: true, sent: 0 };
      }
      const r = await request(cfg, '/api/sync', { method: 'POST', body: { sessions, notes, settings: publicSettings() } });
      for (const s of sessions) st.synced[s.id] = s.updatedAt;
      st.notesSynced = notes.length;
      st.lastOk = new Date().toISOString();
      st.serverCount = r.sessions;
      delete st.lastError;
      writeState(st);
      return { ok: true, sent: sessions.length };
    } catch (e) {
      st.lastError = { code: e.code || 'server', status: e.status, at: new Date().toISOString() };
      writeState(st);
      return { ok: false, error: e.code || 'server', status: e.status };
    }
  })().finally(() => { running = null; });
  return running;
}

// Восстановление: занятия с сервера добавляются к тем, что есть на телефоне
// (при совпадении id остаётся более новая версия). Ничего локального не удаляется.
export async function restore() {
  const cfg = config();
  if (!cfg) throw new SyncError('badcode');
  const data = await request(cfg, '/api/export');
  const local = store.loadSessions();
  const hadNone = local.filter((s) => s.completed).length === 0;
  const byId = new Map(local.map((s) => [s.id, s]));
  let added = 0;
  for (const s of data.sessions || []) {
    const mine = byId.get(s.id);
    if (!mine) { byId.set(s.id, s); added++; }
    else if ((s.updatedAt || '') > (mine.updatedAt || '')) byId.set(s.id, s);
  }
  const merged = [...byId.values()].sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));
  store.replaceSessions(merged);

  const noteKey = (n) => `${n.at}|${n.type || ''}`;
  const notes = store.loadNotes();
  const seen = new Set(notes.map(noteKey));
  for (const n of data.notes || []) if (!seen.has(noteKey(n))) { notes.push(n); seen.add(noteKey(n)); }
  notes.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  store.replaceNotes(notes);

  // На «чистом» телефоне возвращаем и настройки (сторона, повторы, упражнения).
  if (hadNone && data.settings) {
    const cur = store.loadSettings();
    store.saveSettings({ ...cur, ...data.settings, sync: cur.sync });
  }
  // Всё, что пришло с сервера, уже там — отмечаем как отправленное.
  const st = readState();
  for (const s of data.sessions || []) if (byId.get(s.id) === s) st.synced[s.id] = s.updatedAt;
  writeState(st);
  return { added, total: merged.length, settingsRestored: hadNone && !!data.settings };
}

export function status() {
  return readState();
}
