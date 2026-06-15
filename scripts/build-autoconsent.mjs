import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'vendor', 'autoconsent');
const rulesOut = path.join(outDir, 'rules');
mkdirSync(rulesOut, { recursive: true });

await build({
  entryPoints: {
    'content.bundle': path.join(root, 'src/autoconsent/content.entry.js'),
    'background-helpers.bundle': path.join(root, 'src/autoconsent/background-helpers.entry.js'),
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome102',
  outdir: outDir,
  legalComments: 'inline',
});

// Rules: resolve via the package's exported subpaths (known to resolve from Task 1).
let pkgRulesDir = null;
for (const f of ['compact-rules.json', 'rules.json', 'consentomatic.json']) {
  const srcPath = require.resolve('@duckduckgo/autoconsent/rules/' + f);
  pkgRulesDir = path.dirname(srcPath);
  copyFileSync(srcPath, path.join(rulesOut, f));
}

// License/attribution: rules/ is a direct child of the package root.
const licenseSrc = path.join(pkgRulesDir, '..', 'LICENSE');
if (existsSync(licenseSrc)) {
  copyFileSync(licenseSrc, path.join(outDir, 'LICENSE'));
} else {
  writeFileSync(
    path.join(outDir, 'LICENSE'),
    'This directory contains a bundled build of @duckduckgo/autoconsent,\n' +
    'licensed under the Mozilla Public License 2.0 (MPL-2.0).\n' +
    'See https://github.com/duckduckgo/autoconsent and https://www.mozilla.org/MPL/2.0/\n',
  );
  console.warn('autoconsent LICENSE not found in package; wrote MPL-2.0 attribution stub.');
}

console.log('autoconsent build complete ->', outDir);
