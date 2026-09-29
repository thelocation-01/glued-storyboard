import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {DATA_DIR, GENERATED_DIR, RENDERS_DIR, ROOT, applyEditorialStyle, conformProjectToNarration, createProjectFromScript, ensureDirectories, listProjects, loadProject, normalizeProject, saveProject} from './lib/project.mjs';

const PORT = Number(process.env.PORT || 3210);
const app = express();
const upload = multer({storage: multer.memoryStorage(), limits: {fileSize: 250 * 1024 * 1024}});
const jobs = new Map();
let bundlePromise;

app.use(express.json({limit: '5mb'}));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/renders', express.static(RENDERS_DIR));

const runProcess = (executable, args) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, {windowsHide: true});
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(stderr) : reject(new Error(stderr || `Process exited with ${code}`)));
});

const probeDuration = async (file) => {
  const child = spawn(ffprobeStatic.path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], {windowsHide: true});
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  if (code !== 0) throw new Error(stderr || 'Could not read narration duration.');
  return Number.parseFloat(stdout.trim());
};

const safeExtract = async (buffer, destination) => {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const total = entries.reduce((sum, entry) => sum + Number(entry.header.size || 0), 0);
  if (total > 800 * 1024 * 1024) throw new Error('The uncompressed storyboard is larger than 800 MB.');
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, '/');
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('The ZIP contains an unsafe path.');
  }
  await fs.rm(destination, {recursive: true, force: true});
  await fs.mkdir(destination, {recursive: true});
  zip.extractAllTo(destination, true);
};

const voices = [
  {id: 'af_bella', name: 'Bella — warm and cinematic'},
];

app.get('/api/health', (_req, res) => res.json({ok: true, renderer: 'Remotion', narrationEngine: 'Kokoro (offline)', offline: true, defaultVoice: voices[0].id, voices}));
app.get('/api/projects', async (_req, res, next) => { try { res.json(await listProjects()); } catch (error) { next(error); } });
app.get('/api/projects/:id', async (req, res, next) => { try { res.json(await loadProject(req.params.id)); } catch (error) { next(error); } });

app.post('/api/projects', async (req, res, next) => {
  try { res.status(201).json({ok: true, project: await createProjectFromScript({title: req.body.title, script: req.body.script})}); }
  catch (error) { next(error); }
});

app.put('/api/projects/:id/script', async (req, res, next) => {
  try {
    const current = await loadProject(req.params.id);
    const project = await createProjectFromScript({title: req.body.title || current.title, script: req.body.script, project: current});
    res.json({ok: true, project});
  } catch (error) { next(error); }
});

app.put('/api/projects/:id/style', async (req, res, next) => {
  try {
    const project = applyEditorialStyle(await loadProject(req.params.id), req.body || {});
    await saveProject(project);
    bundlePromise = undefined;
    res.json({ok: true, project});
  } catch (error) { next(error); }
});

app.post('/api/import', upload.single('storyboard'), async (req, res, next) => {
  try {
    if (!req.file) throw new Error('Choose a storyboard ZIP first.');
    const sourceDir = path.join(DATA_DIR, `_import-${crypto.randomUUID()}`);
    await safeExtract(req.file.buffer, sourceDir);
    const project = await normalizeProject({sourceDir});
    await fs.rm(sourceDir, {recursive: true, force: true});
    res.json({ok: true, project});
  } catch (error) { next(error); }
});

app.post('/api/projects/:id/narration', async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!project.script.trim()) throw new Error('This project has no narration script.');
    const voice = String(req.body.voice || voices[0].id);
    if (!voices.some((item) => item.id === voice)) throw new Error('Unsupported offline narration voice.');
    const rate = Math.min(1, Math.max(-1, Number(req.body.rate ?? 0)));
    const speed = ({'-1': 0.78, '0': 0.85, '1': 0.96})[String(rate)] || 0.85;
    const mediaDir = path.join(GENERATED_DIR, project.id);
    await fs.mkdir(mediaDir, {recursive: true});
    const inputPath = path.join(mediaDir, 'narration-input.txt');
    const rawPath = path.join(mediaDir, 'narration-raw.wav');
    const finalPath = path.join(mediaDir, 'narration.mp3');
    await fs.writeFile(inputPath, project.script, 'utf8');
    const python = path.join(ROOT, '.venv-kokoro', 'Scripts', 'python.exe');
    const generator = path.join(ROOT, 'scripts', 'generate-bella-narration.py');
    const model = path.join(ROOT, 'models', 'kokoro', 'kokoro-v1.0.onnx');
    const voiceBank = path.join(ROOT, 'models', 'kokoro', 'voices-v1.0.bin');
    try { await Promise.all([fs.access(python), fs.access(generator), fs.access(model), fs.access(voiceBank)]); }
    catch { throw new Error('The bundled Kokoro Bella voice is missing. Reinstall this Glued Storyboard package.'); }
    await runProcess(python, [generator, '--input', inputPath, '--output', rawPath, '--speed', String(speed)]);
    await runProcess(ffmpegPath, ['-y', '-i', rawPath, '-af', 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB:stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB:stop_silence=0.08:detection=peak:window=0.02', '-c:a', 'libmp3lame', '-b:a', '192k', finalPath]);
    await fs.rm(rawPath, {force: true});
    project.narrationPath = `offline-media/${project.id}/narration.mp3`;
    project.narrationDuration = await probeDuration(finalPath);
    project.aiNarration = false;
    project.narrationEngine = 'Kokoro ONNX offline';
    project.voice = voice;
    project.voiceRate = rate;
    await saveProject(project);
    res.json({ok: true, duration: project.narrationDuration, voice, project});
  } catch (error) { next(error); }
});

app.post('/api/projects/:id/images', upload.array('images', 100), async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    const files = [...(req.files || [])].sort((a, b) => a.originalname.localeCompare(b.originalname, undefined, {numeric: true, sensitivity: 'base'}));
    if (!files.length) throw new Error('Choose one or more ChatGPT-generated images.');
    if (files.length > project.scenes.length) throw new Error(`This storyboard has ${project.scenes.length} scenes, but ${files.length} images were selected.`);
    const extensionFor = (file) => ({'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp'}[file.mimetype]);
    if (files.some((file) => !extensionFor(file))) throw new Error('Images must be PNG, JPG, or WebP files.');
    const imagesDir = path.join(GENERATED_DIR, project.id, 'images');
    await fs.mkdir(imagesDir, {recursive: true});
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fileName = `scene-${String(index + 1).padStart(3, '0')}${extensionFor(file)}`;
      await fs.writeFile(path.join(imagesDir, fileName), file.buffer);
      project.scenes[index].imagePath = `offline-media/${project.id}/images/${fileName}`;
    }
    await saveProject(project);
    res.json({ok: true, imported: files.length, project});
  } catch (error) { next(error); }
});

app.post('/api/projects/:id/render', async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (project.scenes.some((scene) => !scene.imagePath)) throw new Error('Every scene needs an image before rendering.');
    const jobId = crypto.randomUUID();
    const profile = req.body.profile === 'preview' ? 'preview' : 'youtube';
    jobs.set(jobId, {type: 'render', status: 'queued', progress: 0, projectId: project.id, profile});
    res.status(202).json({ok: true, jobId});
    void (async () => {
      try {
        jobs.set(jobId, {...jobs.get(jobId), status: 'bundling'});
        bundlePromise ||= bundle({entryPoint: path.join(ROOT, 'src', 'index.ts')});
        const serveUrl = await bundlePromise;
        const inputProps = conformProjectToNarration(project);
        if (profile === 'preview') {
          inputProps.totalFrames = Math.min(inputProps.totalFrames, Math.round(Math.max(8, Math.min(60, Number(req.body.previewSeconds || 24))) * inputProps.fps));
        }
        const composition = await selectComposition({serveUrl, id: 'GluedStoryboard', inputProps});
        const outputName = `${project.id}-${profile}-${Date.now()}.mp4`;
        const outputLocation = path.join(RENDERS_DIR, outputName);
        jobs.set(jobId, {...jobs.get(jobId), status: 'rendering', outputName});
        await renderMedia({composition, serveUrl, codec: 'h264', audioCodec: 'aac', outputLocation, inputProps, scale: profile === 'preview' ? 0.5 : 1, crf: profile === 'preview' ? 24 : 18, x264Preset: 'veryfast', concurrency: profile === 'preview' ? 2 : 4, onProgress: ({progress}) => jobs.set(jobId, {...jobs.get(jobId), status: 'rendering', progress: Math.round(progress * 100), outputName})});
        jobs.set(jobId, {...jobs.get(jobId), status: 'complete', progress: 100, outputName, url: `/renders/${encodeURIComponent(outputName)}`});
      } catch (error) {
        bundlePromise = undefined;
        jobs.set(jobId, {...jobs.get(jobId), status: 'failed', error: error.stack || error.message});
      }
    })();
  } catch (error) { next(error); }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({error: 'Job not found.'});
  res.json(job);
});
app.use((error, _req, res, _next) => { console.error(error); res.status(400).json({error: error.message || 'Something went wrong.'}); });

await ensureDirectories();
app.listen(PORT, () => console.log(`Glued Storyboard Studio is running at http://localhost:${PORT}`));
