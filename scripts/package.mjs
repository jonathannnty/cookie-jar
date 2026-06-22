// Produces an upload-ready Chrome Web Store zip containing ONLY the files the
// extension loads at runtime — no dev tooling, tests, docs, or node_modules.
// Run: npm run package  ->  dist/cookie-jar-v<version>.zip
import { createWriteStream, mkdirSync, readdirSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import archiver from 'archiver';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));

// The vendored engine must be built before packaging.
if (!existsSync(path.join(root, 'vendor/autoconsent/content.bundle.js'))) {
  console.error('Missing vendor/autoconsent/content.bundle.js — run `npm run build` first.');
  process.exit(1);
}

const outDir = path.join(root, 'dist');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `cookie-jar-v${version}.zip`);
rmSync(outFile, { force: true });

// Exactly the runtime files/dirs the manifest references.
const FILES = ['manifest.json', 'background.js', 'content.js'];
const DIRS = ['popup', 'options', 'fullpage', 'utils', 'styles', 'vendor/autoconsent', 'figma/svg'];
// Icon assets the UI uses — manifest PNGs plus the cookie-*.svg thumbnails
// referenced by popup/options. Excludes any dev-only HTML in icons/.
const ICON_EXTS = new Set(['.png', '.svg']);

// --- Determine the exact set of files that will ship (root-relative, posix). ---
const shipped = new Set();
const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');
const walk = (abs) => {
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) walk(child);
    else shipped.add(rel(child));
  }
};
for (const f of FILES) shipped.add(f);
for (const d of DIRS) walk(path.join(root, d));
const iconFiles = readdirSync(path.join(root, 'icons'))
  .filter((n) => ICON_EXTS.has(path.extname(n).toLowerCase()));
for (const n of iconFiles) shipped.add(`icons/${n}`);

// --- Regression guard: every asset referenced by a shipped HTML/CSS page must
// itself be shipped, or the published build renders broken (404) images. ---
const refRe = /(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
const missing = [];
for (const p of shipped) {
  if (!/\.(html|css)$/i.test(p)) continue;
  const text = readFileSync(path.join(root, p), 'utf8');
  const baseDir = path.posix.dirname(p);
  for (const m of text.matchAll(refRe)) {
    const raw = (m[1] ?? m[2] ?? '').trim();
    // Skip remote, inline-data, anchors, and SVG filter refs like url('#hd').
    if (!raw || /^(https?:|data:|mailto:|tel:|#)/i.test(raw)) continue;
    const resolved = path.posix.normalize(path.posix.join(baseDir, raw.split(/[?#]/)[0]));
    if (!shipped.has(resolved)) missing.push(`${p}  ->  ${raw}  (resolves to ${resolved})`);
  }
}
if (missing.length) {
  console.error('Refusing to package: referenced assets are not in the build:');
  for (const line of [...new Set(missing)]) console.error(`  ${line}`);
  process.exit(1);
}

// --- Build the zip. ---
const output = createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });
const closed = new Promise((resolve, reject) => {
  output.on('close', resolve);
  archive.on('error', reject);
  archive.on('warning', (err) => { if (err.code !== 'ENOENT') reject(err); });
});
archive.pipe(output);

for (const f of FILES) archive.file(path.join(root, f), { name: f });
for (const d of DIRS) archive.directory(path.join(root, d), d);
for (const n of iconFiles) archive.file(path.join(root, 'icons', n), { name: `icons/${n}` });

await archive.finalize();
await closed;
console.log(
  `Packaged cookie-jar v${version} -> ${path.relative(root, outFile)} ` +
  `(${(archive.pointer() / 1048576).toFixed(2)} MB, ${shipped.size} files, ` +
  `${[...shipped].filter((p) => /\.(html|css)$/i.test(p)).length} pages verified)`,
);
