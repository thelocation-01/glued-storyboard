import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data', 'offline-projects');
export const GENERATED_DIR = path.join(ROOT, 'public', 'offline-media');
export const RENDERS_DIR = path.join(ROOT, 'renders');
export const ensureDirectories = async () => Promise.all([DATA_DIR, GENERATED_DIR, RENDERS_DIR].map((dir) => fs.mkdir(dir, {recursive: true})));

const safeName = (value) => String(value || 'project').normalize('NFKD').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) || 'project';
const normalizeScript = (value) => String(value || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const wordCount = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length;
const motionPresets = ['slow-zoom-in', 'pan-right', 'slow-zoom-out', 'pan-left'];

const sentenceParts = (script) => {
  const sentences = normalizeScript(script).split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  return sentences.flatMap((sentence) => {
    const words = sentence.split(/\s+/);
    if (words.length <= 48) return [sentence];
    const chunks = [];
    for (let index = 0; index < words.length; index += 40) chunks.push(words.slice(index, index + 40).join(' '));
    return chunks;
  });
};

export const splitScriptIntoScenes = (script, previousScenes = []) => {
  const groups = [];
  for (const sentence of sentenceParts(script)) {
    const latest = groups.at(-1);
    if (latest && wordCount(`${latest} ${sentence}`) <= 38) groups[groups.length - 1] = `${latest} ${sentence}`;
    else groups.push(sentence);
  }
  let cursor = 0;
  return groups.map((narration, index) => {
    const words = narration.split(/\s+/);
    const duration = Math.min(18, Math.max(6, words.length / 2.25));
    const scene = {
      id: previousScenes[index]?.id || `scene-${index + 1}`,
      narration,
      duration,
      transition: index ? 'crossfade' : 'cut',
      motion: motionPresets[index % motionPresets.length],
      title: words.slice(0, 7).join(' ').replace(/[.,!?;:]$/, '') || `Scene ${index + 1}`,
      subtitle: narration,
      imagePath: previousScenes[index]?.imagePath || '',
      focalX: Number(previousScenes[index]?.focalX ?? 50),
      focalY: Number(previousScenes[index]?.focalY ?? 50),
      zoom: Number(previousScenes[index]?.zoom ?? 1),
    };
    scene.caption = {start: cursor, end: cursor + duration, text: narration};
    cursor += duration;
    return scene;
  });
};

export const createProjectFromScript = async ({title, script, project}) => {
  const cleanScript = normalizeScript(script);
  if (!cleanScript) throw new Error('Paste a narration script before creating the storyboard.');
  const cleanTitle = String(title || '').trim() || 'Untitled Storyboard';
  const id = project?.id || `${safeName(cleanTitle)}-${crypto.randomUUID().slice(0, 8)}`;
  const scenesWithCaptions = splitScriptIntoScenes(cleanScript, project?.scenes || []);
  const scenes = scenesWithCaptions.map(({caption, ...scene}) => scene);
  const captions = scenesWithCaptions.map(({caption}) => caption);
  const next = {
    ...(project || {}), id, title: cleanTitle, script: cleanScript, fps: 30, width: 1920, height: 1080, scenes, captions,
    narrationPath: '', narrationDuration: null, voice: project?.voice || 'af_bella',
  };
  await fs.mkdir(path.join(DATA_DIR, id), {recursive: true});
  await saveProject(next);
  return next;
};
const srtTime = (value) => {
  const match = value.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000 : 0;
};
export const parseSrt = (text) => text.replace(/\r/g, '').trim().split(/\n\s*\n/).map((block) => {
  const lines = block.split('\n');
  const timingIndex = lines.findIndex((line) => line.includes('-->'));
  if (timingIndex < 0) return null;
  const [start, end] = lines[timingIndex].split('-->').map((value) => srtTime(value.trim()));
  return {start, end, text: lines.slice(timingIndex + 1).join(' ').trim()};
}).filter(Boolean);

const findFile = async (dir, target) => {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === target.toLowerCase()) return full;
    if (entry.isDirectory()) {
      const found = await findFile(full, target);
      if (found) return found;
    }
  }
  return null;
};

export const normalizeProject = async ({sourceDir, forcedId}) => {
  const projectJsonPath = await findFile(sourceDir, 'project.json');
  if (!projectJsonPath) throw new Error('The ZIP does not contain project.json. Export the storyboard ZIP from Lumen or Glued and try again.');
  const sourceRoot = path.dirname(projectJsonPath);
  const raw = JSON.parse(await fs.readFile(projectJsonPath, 'utf8'));
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) throw new Error('project.json has no scenes.');
  const id = forcedId || `${safeName(raw.title)}-${crypto.randomUUID().slice(0, 8)}`;
  const assetRoot = path.join(GENERATED_DIR, id);
  const imagesDir = path.join(assetRoot, 'images');
  await fs.rm(assetRoot, {recursive: true, force: true});
  await fs.mkdir(imagesDir, {recursive: true});
  const scenes = [];
  for (let index = 0; index < raw.scenes.length; index += 1) {
    const sourceScene = raw.scenes[index];
    const candidate = sourceScene.exportedImage || (sourceScene.image?.fileName ? path.join('images', sourceScene.image.fileName) : '');
    let imagePath = '';
    if (candidate) {
      const normalized = path.normalize(candidate).replace(/^([/\\])+/, '');
      const full = path.resolve(sourceRoot, normalized);
      if (!full.startsWith(path.resolve(sourceRoot) + path.sep)) throw new Error(`Unsafe image path in scene ${index + 1}.`);
      try {
        await fs.access(full);
        const destName = `${String(index + 1).padStart(3, '0')}-${safeName(path.parse(full).name)}${path.extname(full).toLowerCase() || '.png'}`;
        await fs.copyFile(full, path.join(imagesDir, destName));
        imagePath = `offline-media/${id}/images/${destName}`;
      } catch { imagePath = ''; }
    }
    scenes.push({
      id: sourceScene.id || `scene-${index + 1}`, narration: String(sourceScene.narration || ''),
      duration: Math.max(1, Number(sourceScene.duration) || 8),
      transition: String(sourceScene.transition || (index ? 'crossfade' : 'cut')),
      motion: String(sourceScene.motion || (index % 2 ? 'pan-right' : 'slow-zoom-in')),
      title: String(sourceScene.title || `Scene ${index + 1}`), subtitle: String(sourceScene.subtitle || ''),
      imagePath, focalX: Number(sourceScene.focalX ?? 50), focalY: Number(sourceScene.focalY ?? 50), zoom: Number(sourceScene.zoom ?? 1),
    });
  }
  const srtPath = await findFile(sourceRoot, 'captions.srt');
  const captions = srtPath ? parseSrt(await fs.readFile(srtPath, 'utf8')) : [];
  const normalized = {id, title: String(raw.title || 'Untitled Storyboard'), script: String(raw.script || scenes.map((scene) => scene.narration).join(' ')), fps: 30, width: 1920, height: 1080, scenes, captions};
  await fs.mkdir(path.join(DATA_DIR, id), {recursive: true});
  await fs.writeFile(path.join(DATA_DIR, id, 'project.json'), JSON.stringify(normalized, null, 2));
  return normalized;
};

export const loadProject = async (id) => {
  const safeId = safeName(id);
  if (safeId !== id) throw new Error('Invalid project identifier.');
  return JSON.parse(await fs.readFile(path.join(DATA_DIR, safeId, 'project.json'), 'utf8'));
};
export const saveProject = async (project) => fs.writeFile(path.join(DATA_DIR, project.id, 'project.json'), JSON.stringify(project, null, 2));
export const listProjects = async () => {
  await ensureDirectories();
  const ids = await fs.readdir(DATA_DIR).catch(() => []);
  const projects = [];
  for (const id of ids) {
    try {
      const project = await loadProject(id);
      projects.push({id: project.id, title: project.title, sceneCount: project.scenes.length, duration: project.scenes.reduce((sum, scene) => sum + scene.duration, 0), missingImages: project.scenes.filter((scene) => !scene.imagePath).length, hasNarration: Boolean(project.narrationPath), narrationDuration: project.narrationDuration || null});
    } catch {}
  }
  return projects;
};
export const conformProjectToNarration = (project) => {
  const originalDuration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const desiredDuration = project.narrationDuration ? project.narrationDuration + 0.35 : originalDuration;
  const scale = desiredDuration / originalDuration;
  const captions = project.captions.flatMap((caption) => {
    const words = caption.text.trim().split(/\s+/);
    const chunks = [];
    for (let index = 0; index < words.length; index += 10) chunks.push(words.slice(index, index + 10).join(' '));
    const sourceDuration = Math.max(0.2, caption.end - caption.start);
    return chunks.map((text, index) => ({
      text,
      start: (caption.start + sourceDuration * index / chunks.length) * scale,
      end: (caption.start + sourceDuration * (index + 1) / chunks.length) * scale,
    }));
  });
  return {...project, scenes: project.scenes.map((scene) => ({...scene, duration: scene.duration * scale})), captions, totalFrames: Math.ceil(desiredDuration * project.fps)};
};
