// Хранение на устройстве. Видео и фото не сохраняются — только числа.
import { EXERCISES } from './exercises.js';

const K = { settings: 'mimika.settings.v1', sessions: 'mimika.sessions.v1', notes: 'mimika.notes.v1' };

export const DEFAULT_SETTINGS = {
  affected: 'r',        // поражённая сторона: 'r' — правая, 'l' — левая
  swapSides: false,     // на случай, если точки легли не на ту сторону
  sideConfirmed: false,
  reps: 5,
  tempo: 'slow',        // 'gentle' | 'slow' | 'slower'
  voice: true,
  maxSessionsPerDay: 3,
  sync: null,           // { url, token } — резервная копия на Raspberry Pi
  enabled: Object.fromEntries(EXERCISES.map((e) => [e.id, true])),
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function loadSettings() {
  const s = read(K.settings, {});
  const out = { ...DEFAULT_SETTINGS, ...s, enabled: { ...DEFAULT_SETTINGS.enabled, ...(s.enabled || {}) } };
  // Старые значения темпа ('calm', 'normal') были слишком быстрыми — переводим на новый темп по умолчанию.
  if (!['gentle', 'slow', 'slower'].includes(out.tempo)) out.tempo = 'slow';
  return out;
}
export const saveSettings = (s) => write(K.settings, s);

export const loadSessions = () => read(K.sessions, []);
export function saveSession(session) {
  session.updatedAt = new Date().toISOString(); // для синхронизации: какая копия новее
  const all = loadSessions();
  const i = all.findIndex((x) => x.id === session.id);
  if (i >= 0) all[i] = session; else all.push(session);
  return write(K.sessions, all);
}

export const replaceSessions = (list) => write(K.sessions, list);
export const replaceNotes = (list) => write(K.notes, list);

// Заметки: дни отдыха из-за подёргиваний и т. п.
export const loadNotes = () => read(K.notes, []);
export function addNote(note) {
  const all = loadNotes();
  all.push({ at: new Date().toISOString(), ...note });
  return write(K.notes, all);
}

export function sessionsToday(sessions = loadSessions()) {
  const d = new Date().toDateString();
  return sessions.filter((s) => s.completed && new Date(s.startedAt).toDateString() === d);
}

// Последняя отметка «подёргивания / напряжение» за последние 48 часов.
export function recentTwitch() {
  const since = Date.now() - 48 * 3600 * 1000;
  const fromNotes = loadNotes().filter((n) => n.type === 'twitch' && Date.parse(n.at) > since);
  return fromNotes.length ? fromNotes[fromNotes.length - 1] : null;
}

export function exportAll() {
  const { sync, ...settings } = loadSettings(); // ключ доступа к серверу в файл не попадает
  return JSON.stringify({ exportedAt: new Date().toISOString(), settings, sessions: loadSessions(), notes: loadNotes() }, null, 2);
}

export function clearAll() {
  Object.values(K).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem('mimika.syncstate.v1');
}
