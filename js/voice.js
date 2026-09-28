// Голосовые подсказки. На iPhone синтез речи нужно «разбудить» касанием пользователя.
let enabled = true;
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const all = speechSynthesis.getVoices();
  voice = all.find((v) => v.lang === 'ru-RU' && /Milena|Милена/i.test(v.name)) || all.find((v) => v.lang && v.lang.startsWith('ru')) || null;
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
  u.lang = 'ru-RU';
  if (voice) u.voice = voice;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

export function stop() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
