// Языки интерфейса. Исходный текст — русский: он же ключ перевода (как в gettext).
// Если перевода нет, показывается русский текст — приложение никогда не «ломается».
import { PL } from './i18n-pl.js';

const DICTS = { pl: PL };
export const LANGS = ['ru', 'pl'];
let lang = 'ru';

export function setLang(l) {
  lang = LANGS.includes(l) ? l : 'ru';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
export const getLang = () => lang;
export const locale = () => (lang === 'pl' ? 'pl-PL' : 'ru-RU');
export const speechLang = () => (lang === 'pl' ? 'pl-PL' : 'ru-RU');

// Плюральные формы: 'one' | 'few' | 'many'.
export function pluralForm(n, l = lang) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (l === 'pl') {
    if (n === 1) return 'one';
    if (b >= 2 && b <= 4 && !(a >= 12 && a <= 14)) return 'few';
    return 'many';
  }
  if (a > 10 && a < 20) return 'many';
  if (b === 1) return 'one';
  if (b >= 2 && b <= 4) return 'few';
  return 'many';
}

// t('Сегодня {n} из {max}', { n: 2, max: 3 })
// Значение в словаре может быть функцией (для склонений по числу).
export function t(key, params) {
  const d = DICTS[lang];
  let v = d && Object.prototype.hasOwnProperty.call(d, key) ? d[key] : key;
  if (typeof v === 'function') v = v(params || {});
  if (params) v = String(v).replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
  return v;
}

export const normalize = (s) => s.replace(/\s+/g, ' ').trim();

// Перевод статичного HTML: текстовые узлы и подписи (placeholder, aria-label, title).
export function translateDom(root) {
  if (lang === 'ru' || !root) return;
  const d = DICTS[lang];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && !n.parentElement.closest('script, style, [data-no-i18n]') && /[А-Яа-яЁё]/.test(n.nodeValue)
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const key = normalize(n.nodeValue);
    if (typeof d[key] === 'string') {
      const lead = n.nodeValue.match(/^\s*/)[0], trail = n.nodeValue.match(/\s*$/)[0];
      n.nodeValue = lead + d[key] + trail;
    }
  }
  for (const el of root.querySelectorAll('[placeholder], [aria-label], [title]')) {
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      const v = el.getAttribute(attr);
      if (v && typeof d[normalize(v)] === 'string') el.setAttribute(attr, d[normalize(v)]);
    }
  }
}
