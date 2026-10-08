import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';
import { tr, normalizeLocale, readLocale, getLocale, setLocale, subscribeLocale,
  searchTerms, presetText, messageOptions, formatGemFeedback, LOCALE_STORAGE_KEY } from '../src/localization/zh.js';
import { getUnique, isCursed } from '../src/utils/upgrades.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const han = /\p{Script=Han}/u;
assert.equal(getLocale(), 'en', 'A fresh session defaults to English');
assert.equal(tr('Radial'), 'Radial');
assert.equal(tr('Radial', 'zh-CN'), '放射状');
assert.equal(tr('unregistered text', 'zh-CN'), 'unregistered text', 'Unknown translations fall back safely');
assert.equal(tr('未收录的文本', 'en'), '未收录的文本');
for (const value of ['zh-CN', 'ZH-cn', ' zh_cn ', 'zh']) assert.equal(normalizeLocale(value), 'zh-CN');
for (const value of ['en', 'EN', 'zh-TW', 'fr', '', null, 42]) assert.equal(normalizeLocale(value), 'en');
const values = new Map();
const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
let updates = 0;
const unsubscribe = subscribeLocale(() => updates++);
setLocale('ZH_cn', storage);
assert.equal(values.get(LOCALE_STORAGE_KEY), 'zh-CN');
assert.equal(readLocale(storage), 'zh-CN');
assert.equal(tr('Radial'), '放射状');
assert.deepEqual(['Radial', 'Triangle'].map(tr), ['放射状', '三角形'], 'Array.map indices cannot override language');
assert.equal(messageOptions().okLabel, '确定');
setLocale('en', storage);
assert.equal(readLocale(storage), 'en');
assert.equal(updates, 2);
unsubscribe();
const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
assert.equal(readLocale(blockedStorage), 'en');
setLocale('zh-CN', blockedStorage);
assert.equal(getLocale(), 'zh-CN', 'Restricted persistence still permits session language changes');
setLocale('en', storage);
for (const value of [0, 1, 64, 4294967295, null, undefined, true]) assert.equal(tr(value), value);
assert.equal(tr('可新增 25 颗。每颗独立创建，不替换已有宝石；删除后可继续添加。', 'en'),
  'Room for 25 new gems. Each gem is created separately without replacing existing gems; deletion frees capacity.');
assert.equal(tr('数量须为 1 到 23 之间的整数；未添加任何宝石。', 'en'),
  'Quantity must be a whole number from 1 to 23. No gems added.');
assert.equal(tr('当前背包最多可新增 3 颗，请减少数量。', 'en'), 'Inventory has room for at most 3 gems. Reduce the quantity.');
const success = tr('已向背包添加 2 颗「诅咒锻炼湿气血宝石（物理 27.2%）」。请关闭窗口后点击“保存存档”。', 'en');
assert.ok(success.includes('Added 2 gems') && !han.test(success));
assert.ok(tr(success, 'zh-CN').startsWith('已向背包添加 2 颗'), 'Stored feedback redraws after switching languages');
assert.ok(searchTerms('Tempering Damp Blood Gem (6)').some(term => han.test(term)));

const english = JSON.parse(read('src/localization/ui-en.json'));
for (const [source, target] of Object.entries(english)) {
  assert.equal(tr(source, 'en'), target, `English display mapping: ${source}`);
  assert.ok(!han.test(target), `English translation contains untranslated Chinese: ${source}`);
}
const presets = JSON.parse(read('src-tauri/resources/gem-presets.json'));
const presetSnapshot = JSON.stringify(presets);
assert.equal(presets.length, 117);
for (const preset of presets) {
  assert.equal(presetText(preset, 'name', 'en'), preset.englishName);
  assert.equal(presetText(preset, 'name', 'zh-CN'), preset.name);
  for (const field of ['category', 'notes']) {
    assert.ok(presetText(preset, field, 'en') && !han.test(presetText(preset, field, 'en')), `${preset.id}: ${field}`);
    assert.equal(presetText(preset, field, 'zh-CN'), preset[field]);
  }
}
assert.equal(JSON.stringify(presets), presetSnapshot, 'Display translations cannot mutate preset payloads');

// Exercise the component's actual gemName function, without importing JSX into
// Node, so delete feedback covers its curse/unique-gem display logic as well.
const managerSource = read('src/components/GemManager.jsx');
const managerAst = parseAst(managerSource, { lang: 'jsx' });
const displayFunctions = managerAst.body.filter(node => node.type === 'FunctionDeclaration'
  && ['gemName', 'localeSpace'].includes(node.id.name));
assert.equal(displayFunctions.length, 2);
const renderGemName = runInNewContext(displayFunctions.map(node => managerSource.slice(node.start, node.end)).join('\n')
  + '\ngemName;', { tr, getUnique, isCursed });
setLocale('en', storage);
const addFeedback = { kind: 'add', quantity: 3, preset: presets[0] };
const deletedGem = { shape: 'Radial', source: 0,
  effects: [[126619, 'Physical ATK UP +27.2%'], [41219, 'Increases stamina costs 3.3%']],
  info: { name: 'Tempering Damp Blood Gem (6)' } };
const deleteFeedback = { kind: 'delete', gem: deletedGem };
const feedbackSnapshot = JSON.stringify([addFeedback, deleteFeedback]);
for (const containerKey of ['Inventory', 'Storage']) {
  setLocale('en', storage);
  const addEnglish = formatGemFeedback(addFeedback, containerKey, renderGemName);
  const deleteEnglish = formatGemFeedback(deleteFeedback, containerKey, renderGemName);
  assert.ok(addEnglish.includes(containerKey) && addEnglish.includes(presets[0].englishName));
  assert.ok(deleteEnglish.includes(containerKey) && deleteEnglish.includes('Cursed Tempering Damp Blood Gem (6)'));
  setLocale('zh-CN', storage);
  const containerChinese = containerKey === 'Inventory' ? '背包' : '仓库';
  assert.equal(formatGemFeedback(addFeedback, containerKey, renderGemName),
    `已向${containerChinese}添加 3 颗「${presets[0].name}」。请关闭窗口后点击“保存存档”。`);
  assert.equal(formatGemFeedback(deleteFeedback, containerKey, renderGemName),
    `已从${containerChinese}删除 1 颗「诅咒锻炼湿气血宝石 (6)」。请关闭窗口后点击“保存存档”。`);
  setLocale('en', storage);
  assert.equal(formatGemFeedback(addFeedback, containerKey, renderGemName), addEnglish);
  assert.equal(formatGemFeedback(deleteFeedback, containerKey, renderGemName), deleteEnglish);
}
assert.equal(JSON.stringify([addFeedback, deleteFeedback]), feedbackSnapshot, 'Locale switching preserves canonical feedback data');
const storedSuccessObjects = [];
walk(managerAst, node => {
  if (node.type === 'CallExpression' && node.callee.name === 'setSuccess' && node.arguments[0]?.type === 'ObjectExpression') {
    storedSuccessObjects.push(node.arguments[0]);
    walk(node.arguments[0], child => {
      assert.ok(child.type !== 'CallExpression', 'Success state must retain canonical data, without localized names');
    });
  }
});
assert.equal(storedSuccessObjects.length, 2, 'Add and delete both store structured success data');
assert.ok(managerSource.includes('formatGemFeedback(success, locationKey, gemName)'), 'Current-locale feedback is formatted during render');

function walk(node, visit, ancestors = []) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node, ancestors);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit, [...ancestors, node]));
    else if (value && typeof value === 'object') walk(value, visit, [...ancestors, node]);
  }
}
function normalized(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(normalized);
  return Object.fromEntries(Object.entries(node).filter(([key]) => !['start', 'end', 'raw', 'loc', 'comments'].includes(key))
    .map(([key, value]) => [key, normalized(value)]));
}
const files = fs.readdirSync(path.join(root, 'src'), { recursive: true })
  .map(file => file.replaceAll('\\', '/')).filter(file => file.endsWith('.jsx') && file !== 'Update.jsx' && !file.startsWith('localization/')).sort();
const commands = [], numbers = [];
let chineseLiterals = 0;
for (const file of files) {
  walk(parseAst(read('src/' + file), { lang: 'jsx' }), (node, ancestors) => {
    if (node.type === 'JSXText') {
      assert.ok(!han.test(node.value), `${file}: untranslated JSX text`);
      if (file === 'components/GemManager.jsx') assert.ok(!/[（）]/.test(node.value), 'Gem count punctuation must follow locale');
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && han.test(node.value)) {
      chineseLiterals++;
      assert.ok(Object.hasOwn(english, node.value.trim()), `${file}: Chinese UI literal missing from dictionary: ${node.value}`);
      const insideFunction = ancestors.some(parent => /Function/.test(parent.type));
      const translated = ancestors.some(parent => parent.type === 'CallExpression' && parent.callee?.name === 'tr');
      const storedFeedback = ancestors.some(parent => parent.type === 'CallExpression' && ['setError', 'setSuccess', 'setLoadError'].includes(parent.callee?.name));
      assert.ok(!insideFunction || translated || storedFeedback, `${file}: untranslated Chinese literal in component`);
    }
    if (node.type === 'TemplateLiteral' && node.quasis.some(part => han.test(part.value.cooked))) {
      const key = node.quasis.map((part, i) => part.value.cooked + (i < node.expressions.length ? `{${i}}` : '')).join('');
      assert.ok(Object.hasOwn(english, key), `${file}: template missing from dictionary: ${key}`);
    }
    if (node.type === 'Literal' && typeof node.value === 'number') numbers.push([file, node.value]);
    if (node.type === 'CallExpression' && node.callee.name === 'invoke') commands.push([file, normalized(node.arguments)]);
  });
}
// Recorded from the isolated pre-localization source. Exact argument trees and
// numeric literals protect effect IDs, save enums, ranges and command payloads.
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(commands.length, 34);
assert.equal(numbers.length, 800);
assert.equal(hash(commands), '35c187c55cc8054705c1b4ae0b890ef0b13630cb38d077b825ca36a508088790');
assert.equal(hash(numbers), 'edb5f3d2243fff05c08dc5947cc15d05a9d28f44b52d11f43a6c7ab3090417f2');
let backendMessages = 0;
for (const file of fs.readdirSync(path.join(root, 'src-tauri/src'), { recursive: true }).filter(file => file.endsWith('.rs'))) {
  for (const match of read('src-tauri/src/' + file).matchAll(/"([^"\n]*[\p{Script=Han}][^"\n]*)"/gu)) {
    const key = match[1].replace(/\{\w+\}/g, '{0}');
    assert.ok(Object.hasOwn(english, key), `Backend message has no English display mapping: ${key}`);
    backendMessages++;
  }
}
assert.ok(read('src/App.jsx').includes('<LocaleProvider>'));
assert.ok(!/key=\{locale\}/.test(read('src/App.jsx')), 'Locale must not remount loaded save or edit state');
assert.ok(read('src/components/Item.jsx').includes('[item, isSmall, locale]'), 'Canvas redraws after locale change');
for (const file of fs.readdirSync(path.join(root, 'src'), { recursive: true }).filter(file => file.endsWith('.css'))) {
  assert.ok(!/content:\s*["'][^"']*[\p{Script=Han}]/u.test(read('src/' + file)), `${file}: untranslated CSS-generated label`);
}
assert.ok(read('src/components/Select.jsx').includes('data-label={tr(name)}'), 'Character select headings follow locale');
console.log(`PASS: default/persistent locale, fallback, live feedback templates, ${chineseLiterals} Chinese UI literals, ${backendMessages} backend messages, 117 preset names/categories/notes, 34 unchanged command payloads and 800 unchanged numeric literals.`);
