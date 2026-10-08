import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cargoHome = process.env.CARGO_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.cargo');
const output = path.join(root, 'licenses');
fs.mkdirSync(output, { recursive: true });
const declarations = [];
function notices(folder, label) {
  if (!fs.existsSync(folder)) return [];
  const result = [];
  for (const file of fs.readdirSync(folder)) {
    if (!/^(licen[sc]e|copying|notice|copyright)([.\-_]|$)/i.test(file)) continue;
    const source = path.join(folder, file);
    if (!fs.statSync(source).isFile()) continue;
    const target = label.replace(/[^a-zA-Z0-9._-]/g, '_') + '__' + file;
    fs.copyFileSync(source, path.join(output, target));
    result.push('licenses/' + target);
  }
  return result;
}
const npmLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
for (const [relative, metadata] of Object.entries(npmLock.packages || {})) {
  if (!relative || !metadata.version) continue;
  const directory = path.join(root, relative);
  const manifest = path.join(directory, 'package.json');
  const installed = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : {};
  const name = installed.name || relative.replace(/^.*node_modules\//, '');
  declarations.push({ ecosystem: 'npm', name, version: metadata.version,
    license: installed.license || metadata.license || 'not declared',
    notices: notices(directory, 'npm_' + name + '_' + metadata.version) });
}
const registryRoot = path.join(cargoHome, 'registry', 'src');
const registries = fs.existsSync(registryRoot) ? fs.readdirSync(registryRoot).map(name => path.join(registryRoot, name)) : [];
const cargoLock = fs.readFileSync(path.join(root, 'src-tauri', 'Cargo.lock'), 'utf8');
for (const block of cargoLock.split('[[package]]').slice(1)) {
  const name = block.match(/^name = "([^"]+)"/m)?.[1];
  const version = block.match(/^version = "([^"]+)"/m)?.[1];
  if (!name || !version || !/^source = "registry\+/m.test(block)) continue;
  const directory = registries.map(registry => path.join(registry, `${name}-${version}`)).find(candidate => fs.existsSync(candidate));
  const manifest = directory ? fs.readFileSync(path.join(directory, 'Cargo.toml'), 'utf8') : '';
  declarations.push({ ecosystem: 'cargo', name, version,
    license: manifest.match(/^license = "([^"]+)"/m)?.[1] || 'not declared',
    notices: directory ? notices(directory, 'cargo_' + name + '_' + version) : [] });
}
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'dependency-licenses.json'), JSON.stringify({
  scope: 'Installed npm metadata and cached registry crates matched to lockfiles; individual license texts authoritative.',
  dependencies: declarations,
}, null, 2) + '\n');
console.log(JSON.stringify({ dependencyDeclarations: declarations.length, noticeFiles: fs.readdirSync(output).length }));
