import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const removed = new Set();
let fields = 0;
function visit(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'item_desc' && typeof item === 'string') {
      if (item) { removed.add(item); removed.add(item.trim().replace(/\r\n/g, '\n')); fields++; }
      value[key] = '';
    } else visit(item);
  }
}
for (const filename of ['items.json', 'weapons.json', 'armors.json']) {
  const target = path.join(root, 'src-tauri', 'resources', filename);
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  visit(data);
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
}
let dictionaryEntries = 0;
for (const filename of fs.readdirSync(path.join(root, 'src', 'localization')).filter(name => name.endsWith('.json'))) {
  const target = path.join(root, 'src', 'localization', filename);
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (Array.isArray(data)) continue;
  for (const key of Object.keys(data)) if (removed.has(key)) { delete data[key]; dictionaryEntries++; }
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
}
console.log(JSON.stringify({ clearedNarrativeFields: fields, removedDictionaryEntries: dictionaryEntries }));
