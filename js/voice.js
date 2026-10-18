// Голосовые подсказки. На iPhone синтез речи нужно «разбудить» касанием пользователя.
import { speechLang } from './i18n.js';

let enabled = true;
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const all = speechSynthesis.getVoices();
  const lang = speechLang();                       // 'ru-RU' | 'pl-PL'
  const prefix = lang.slice(0, 2);
  const preferred = prefix === 'pl' ? /Zosia/i : /Milena|Милена/i; // стандартные голоса iOS
  const same = (v) => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(prefix);
  voice = all.find((v) => same(v) && preferred.test(v.name)) || all.find(same) || null;
}

export function initVoice(on) {
  enabled = on;
  if (!('speechSynthesis' in window)) return;
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function setVoice(on) { enabled = on; if (!on) stop(); }

// Вызывать из обработчика касания (например, кнопки «Начать»).
export function unlock() {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function say(text, { interrupt = true } = {}) {
  if (!enabled || !('speechSynthesis' in window) || !text) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechLang();
  if (voice) u.voice = voice;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

export function stop() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
