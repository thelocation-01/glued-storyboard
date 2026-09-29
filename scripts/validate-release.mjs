import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {editorialDefaults, planEditorialOverlay} from '../lib/project.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const required = [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CHANGELOG.md',
  'Setup-Glued-Storyboard.ps1',
  'Start-Glued-Storyboard.cmd',
  'server.mjs',
  'voice.config.json',
  'public/index.html',
  'public/app.js',
  'src/video.tsx',
  'assets/glued-storyboard-cover.png',
];

for (const file of required) {
  await fs.access(path.join(root, file));
}

const pkg = await readJson('package.json');
assert.equal(pkg.version, '1.1.0');
assert.equal(pkg.license, 'MIT');
assert.equal(pkg.engines.node, '>=22');
assert.equal(pkg.packageManager, 'pnpm@11.19.0');

const voice = await readJson('voice.config.json');
assert.equal(voice.provider, 'kokoro-onnx-local');
assert.equal(voice.voiceId, 'af_bella');
assert.equal(voice.language, 'en-us');
assert.equal(voice.speed, 0.85);
assert.equal(voice.sampleRate, 24000);

assert.deepEqual(editorialDefaults, {
  editorialStyle: 'documentary',
  overlayDensity: 'balanced',
  accentColor: '#66f0c1',
  showProgress: true,
});
assert.equal(planEditorialOverlay('First, the model became dramatically faster.', 0).type, 'chapter');
assert.equal(planEditorialOverlay('The system uses 320 billion parameters.', 1).type, 'stat');
assert.equal(planEditorialOverlay('What changes when the agent can see?', 2).type, 'question');
assert.equal(planEditorialOverlay('However, the practical result was different.', 3).type, 'contrast');

const tracked = execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'ls-files', '-z'], {cwd: root})
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));
const forbidden = tracked.filter((file) =>
  /(^|\/)\.env(?:\.|$)|(^|\/)(?:data|renders|models)(\/|$)|^public\/offline-media\//i.test(file),
);
assert.deepEqual(forbidden, [], `Generated or private files are tracked: ${forbidden.join(', ')}`);

console.log(`Glued Storyboard ${pkg.version} release validation passed (${tracked.length} tracked files checked).`);
