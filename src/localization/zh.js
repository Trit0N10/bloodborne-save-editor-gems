import game from './game-catalog.json' with { type: 'json' };
import menu from './menu-catalog.json' with { type: 'json' };
import ui from './ui-zh.json' with { type: 'json' };
import supplements from './supplements.json' with { type: 'json' };
import english from './ui-en.json' with { type: 'json' };

// Presentation only. Never pass translated values to a save model, enum,
// resource lookup, asset path, or Tauri command.
export const LOCALE_STORAGE_KEY = 'bloodborne-save-editor.locale';
export function normalizeLocale(value) {
  return typeof value === 'string' && /^zh(?:[-_]cn)?$/i.test(value.trim()) ? 'zh-CN' : 'en';
}
function browserStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function readLocale(storage = browserStorage()) {
  try { return normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY)); } catch { return 'en'; }
}
let locale = readLocale();
const listeners = new Set();
export const getLocale = () => locale;
export function subscribeLocale(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function setLocale(value, storage = browserStorage()) {
  const next = normalizeLocale(value);
  try { storage?.setItem(LOCALE_STORAGE_KEY, next); } catch { /* Session selection still works. */ }
  if (locale !== next) { locale = next; listeners.forEach(listener => listener()); }
}
const chinese = { ...ui, ...menu, ...game, ...supplements };
const en = { ...Object.fromEntries(Object.entries(chinese).map(([key, value]) => [value, key])), ...english };
const zh = { ...chinese, ...Object.fromEntries(Object.entries(english).map(([key, value]) => [value, key])) };
// Several labels share the English word Inventory; feedback uses this container name.
zh.Inventory = '背包';
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function templates(dictionary) {
  return Object.entries(dictionary).filter(([key]) => /\{\d+\}/.test(key)).map(([key, target]) => {
    const indices = [];
    let expression = '', last = 0;
    for (const match of key.matchAll(/\{(\d+)\}/g)) {
      expression += escapeRegex(key.slice(last, match.index)) + '(.*?)';
      indices.push(Number(match[1])); last = match.index + match[0].length;
    }
    return { regex: new RegExp('^' + expression + escapeRegex(key.slice(last)) + '$', 's'), indices, target };
  });
}
const patterns = { en: templates(en), 'zh-CN': templates(zh) };
export function tr(value, requestedLocale) {
  if (typeof value !== 'string' || !value) return value;
  // Array.map passes a numeric index here; it must never select a locale.
  const language = typeof requestedLocale === 'string' ? normalizeLocale(requestedLocale) : locale;
  const dictionary = language === 'en' ? en : zh;
  if (Object.hasOwn(dictionary, value)) return dictionary[value];
  const normalized = value.trim().replace(/\r\n/g, '\n');
  if (Object.hasOwn(dictionary, normalized)) return dictionary[normalized];
  for (const { regex, indices, target } of patterns[language]) {
    const match = regex.exec(normalized);
    if (!match) continue;
    const values = {};
    indices.forEach((index, i) => { values[index] = tr(match[i + 1], language); });
    return target.replace(/\{(\d+)\}/g, (_, index) => values[index] ?? '');
  }
  const tier = normalized.match(/^(.*?)\s*\(Tier (\d+)\)$/);
  if (tier && language === 'zh-CN') return `${tr(tier[1], language)}（第 ${tier[2]} 级）`;
  const upgraded = normalized.match(/^(.*?)(\s*\+\d+)$/);
  if (upgraded && Object.hasOwn(dictionary, upgraded[1])) return dictionary[upgraded[1]] + upgraded[2];
  const cut = normalized.match(/^\[CUT\]\s*(.*)$/);
  if (cut && language === 'zh-CN') return '[未采用内容] ' + tr(cut[1], language);
  return value;
}
export function hasTranslation(value) { return typeof value === 'string' && tr(value) !== value; }
export function messageOptions(options = {}) {
  return { title: tr('Bloodborne Save Editor · Gems'), okLabel: tr('OK'), ...options };
}
export function searchTerms(value) { return [value, tr(value, 'en'), tr(value, 'zh-CN')]; }
export function presetText(preset, field = 'name', requestedLocale = locale) {
  if (!preset) return '';
  if (field === 'name' && normalizeLocale(requestedLocale) === 'en') return preset.englishName || tr(preset.name, 'en');
  return tr(preset[field] || '', requestedLocale);
}
export function formatGemFeedback(feedback, containerKey, gemDisplayName) {
  if (!feedback) return '';
  // Translate the template before interpolating current-locale display values.
  // Feedback state holds original models, never a string from a past locale.
  const template = feedback.kind === 'add'
    ? 'Added {1} gems of “{2}” to {0}. Close this window, then click Save file.'
    : 'Deleted 1 “{1}” gem from {0}. Close this window, then click Save file.';
  const values = feedback.kind === 'add'
    ? [tr(containerKey), feedback.quantity, presetText(feedback.preset)]
    : [tr(containerKey), gemDisplayName(feedback.gem)];
  return tr(template).replace(/\{(\d+)\}/g, (_, index) => String(values[index] ?? ''));
}
