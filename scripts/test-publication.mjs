// Publication allowlist checks. Never traverse dependencies, build output or Git internals.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['node_modules', 'dist', 'target', '.git', '_codex_work', 'output', 'release']);
const files = [];
function walk(dir, relative = '') {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(item.name)) continue;
    const name = relative ? `${relative}/${item.name}` : item.name;
    assert(!item.isSymbolicLink(), `Unexpected publishable symlink: ${name}`);
    if (item.isDirectory()) { assert(!/^(?:saves|credentials|\.ssh|\.aws|\.codex|\.agents)$/i.test(item.name), `Private directory: ${name}`); walk(path.join(dir, item.name), name); }
    else files.push(name);
  }
}
walk(root);
if (fs.existsSync(path.join(root, '.git'))) {
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  assert.equal(tracked.status, 0, tracked.stderr);
  for (const name of tracked.stdout.split('\0').filter(Boolean)) {
    assert(!name.split('/').some(part => excluded.has(part)), `Excluded artifact tracked by Git: ${name}`);
    assert(files.includes(name), `Tracked path missing from source inventory: ${name}`);
  }
}
const forbidden = /(?:^|\/)(?:SPRJ[^/]*|testsave[^/]*|userdata\d+|id_rsa|id_ed25519|\.env(?:\.[^/]*)?|\.gitconfig|\.git-credentials|\.npmrc|\.netrc|\.pypirc|auth\.json|credentials\.json)$|\.(?:sav|save|sl2|bak|backup|otf|ttf|woff2?|exe|dll|pdb|dmp|key|pem|pfx|zip|7z|msi)$/i;
const textExtensions = /\.(?:jsx?|mjs|cjs|json|css|html|md|toml|lock|ps1|ya?ml|txt)$/i;
// Concatenate fragments so scanner definitions do not themselves resemble secrets.
const secret = new RegExp('(?:github' + '_pat_|gh' + '[pousr]_|AKIA)[A-Za-z0-9_]{18,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----');
const workstation = new RegExp('[A-Za-z]:\\\\(?:Users|Windows|Visual Studio|\\([^\\\\]+\\)|[^\r\n]*Codex Projects)' + '|/' + 'Users/' + '[^/]+/' + '|/' + 'home/' + '[^/]+/');
for (const name of files) {
  assert(!forbidden.test(name), `Forbidden publication file: ${name}`);
  if (textExtensions.test(name)) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert(!secret.test(text), `Possible credential in ${name}`);
    // Verbatim dependency licenses may contain generic example filesystem paths.
    // Their notices stay intact; credential and file-type checks still apply.
    if (!name.startsWith('licenses/')) assert(!workstation.test(text), `Workstation-specific path in ${name}`);
  }
}
const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json')));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const npmLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
assert.equal(config.version, '0.11.0'); assert.equal(pkg.version, config.version); assert.equal(npmLock.version, config.version);
const rustTauri = fs.readFileSync(path.join(root, 'src-tauri/Cargo.lock'), 'utf8')
  .split('[[package]]').find(block => /^name = "tauri"$/m.test(block));
const rustTauriVersion = rustTauri?.match(/^version = "([^"]+)"$/m)?.[1];
const apiVersion = npmLock.packages['node_modules/@tauri-apps/api']?.version;
assert(rustTauriVersion && apiVersion, 'Locked Rust and JavaScript Tauri versions are required');
assert.equal(apiVersion.split('.').slice(0, 2).join('.'), rustTauriVersion.split('.').slice(0, 2).join('.'),
  'Tauri JavaScript API and Rust crate must use the same major/minor release');
assert.equal(config.identifier, 'io.github.trit0n10.bloodborne-save-editor-gems');
assert.equal(config.app.windows[0].title, 'Bloodborne Save Editor Gems');
assert(!JSON.stringify(pkg).includes('@tauri-apps/plugin-updater'));
assert(!JSON.stringify(npmLock).includes('@tauri-apps/plugin-updater'));
assert(!fs.readFileSync(path.join(root, 'src-tauri/Cargo.toml'), 'utf8').includes('tauri-plugin-updater'));
assert(!fs.readFileSync(path.join(root, 'src-tauri/Cargo.lock'), 'utf8').includes('tauri-plugin-updater'));
assert(!fs.readFileSync(path.join(root, 'src-tauri/src/lib.rs'), 'utf8').includes('tauri_plugin_updater'));
for (const name of files.filter(x => x.startsWith('src-tauri/capabilities/'))) assert(!fs.readFileSync(path.join(root,name),'utf8').includes('updater:'));
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/assets-inventory.json')));
assert.equal(inventory.count, inventory.assets.length);
for (const item of inventory.assets) {
  const bytes = fs.readFileSync(path.join(root, item.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
  if (item.path.endsWith('.png')) { assert.equal(bytes.readUInt32BE(16), item.width, item.path); assert.equal(bytes.readUInt32BE(20), item.height, item.path); assert.equal(bytes[25], 6, 'RGBA icon required'); }
}
const generatedPaths = new Set(inventory.assets.map(x=>x.path));
for (const name of files.filter(x=>x.startsWith('public/') || x.startsWith('src-tauri/icons/'))) assert(generatedPaths.has(name), `Unaccounted public asset: ${name}`);
const allImages = JSON.parse(fs.readFileSync(path.join(root, 'src/context/allImages.json')));
for (const name of allImages.itemImages || []) assert(fs.existsSync(path.join(root, 'public/assets/itemImages', name)), `Missing item icon ${name}`);
const gemImages = fs.readFileSync(path.join(root, 'src/utils/gem-image-paths.js'), 'utf8').matchAll(/"(\/assets\/[^"\r\n]+\.png)"/g);
for (const [,name] of gemImages) assert(fs.existsSync(path.join(root,'public',name)), `Missing gem icon ${name}`);
const result = spawnSync(process.execPath, ['scripts/generate-artwork.mjs', '--check'], { cwd: root, encoding: 'utf8' });
assert.equal(result.status,0,result.stderr); process.stdout.write(result.stdout);
console.log(`Publication checks passed: ${files.length} source files; ${inventory.count} authored assets; no saves, fonts, binaries, credentials, local paths or updater dependencies.`);
