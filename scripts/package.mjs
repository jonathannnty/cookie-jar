// Produces an upload-ready Chrome Web Store zip containing ONLY the files the
// extension loads at runtime — no dev tooling, tests, docs, or node_modules.
// Run: npm run package  ->  dist/cookie-jar-v<version>.zip
import { createWriteStream, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
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
const DIRS = ['popup', 'options', 'fullpage', 'utils', 'styles', 'vendor/autoconsent'];

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
// Ship only the icon PNGs the manifest uses — not icons/generate-icons.html.
archive.glob('*.png', { cwd: path.join(root, 'icons') }, { prefix: 'icons' });

await archive.finalize();
await closed;
console.log(
  `Packaged cookie-jar v${version} -> ${path.relative(root, outFile)} ` +
  `(${(archive.pointer() / 1048576).toFixed(2)} MB)`,
);
