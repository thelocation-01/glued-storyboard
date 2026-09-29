const state = {projects: [], project: null, health: null};
const $ = (selector) => document.querySelector(selector);
const toast = (message) => { const node = $('#toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 4200); };
const api = async (url, options = {}) => { const response = await fetch(url, options); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`); return data; };
const formatDuration = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

async function boot() {
  state.health = await api('/api/health');
  $('#engine-status').textContent = 'Offline voice and MP4 renderer ready';
  $('#voice').innerHTML = state.health.voices.map((voice) => `<option value="${escapeHtml(voice.id)}">${escapeHtml(voice.name)}</option>`).join('');
  await refreshProjects();
  if (state.projects[0]) await selectProject(state.projects[0].id);
  else showScriptStart();
}

function showScriptStart() {
  state.project = null;
  $('#empty-state').hidden = false;
  $('#project-view').hidden = true;
}

async function refreshProjects() {
  state.projects = await api('/api/projects');
  const list = $('#project-list');
  list.innerHTML = state.projects.map((project) => `<button class="project-item ${state.project?.id === project.id ? 'active' : ''}" data-id="${escapeHtml(project.id)}"><strong>${escapeHtml(project.title)}</strong><span>${project.sceneCount} scenes · ${formatDuration(project.duration)} · ${project.hasNarration ? 'narrated' : 'voice needed'}</span></button>`).join('');
  list.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => selectProject(button.dataset.id)));
}

async function selectProject(id) {
  state.project = await api(`/api/projects/${encodeURIComponent(id)}`);
  $('#empty-state').hidden = true;
  $('#project-view').hidden = false;
  $('#project-title').textContent = state.project.title;
  $('#script-title').value = state.project.title;
  $('#script-editor').value = state.project.script;
  $('#editorial-style').value = state.project.editorialStyle || 'documentary';
  $('#overlay-density').value = state.project.overlayDensity || 'balanced';
  $('#accent-color').value = state.project.accentColor || '#66f0c1';
  $('#show-progress').checked = state.project.showProgress !== false;
  if (state.project.voice && [...$('#voice').options].some((option) => option.value === state.project.voice)) $('#voice').value = state.project.voice;
  if (state.project.voiceRate !== undefined) $('#voice-rate').value = String(state.project.voiceRate);
  const duration = state.project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const missing = state.project.scenes.filter((scene) => !scene.imagePath).length;
  $('#project-stats').innerHTML = `<span class="stat">${state.project.scenes.length} scenes</span><span class="stat">${formatDuration(duration)}</span><span class="stat">${escapeHtml(state.project.editorialStyle || 'documentary')} edit</span><span class="stat">${missing ? `${missing} images missing` : 'Images complete'}</span><span class="stat">${state.project.narrationPath ? `${formatDuration(state.project.narrationDuration)} narration` : 'Narration needed'}</span>`;
  $('#render-note').textContent = state.project.narrationPath ? 'Scene timings will conform to the single continuous narration track.' : 'Create narration before the final render to avoid a silent video.';
  $('#scene-grid').innerHTML = state.project.scenes.map((scene, index) => {
    const editorial = scene.editorial || {type: 'minimal', label: '', value: ''};
    return `<article class="scene panel">${scene.imagePath ? `<img src="/${scene.imagePath}" alt="Scene ${index + 1}: ${escapeHtml(scene.title)}" />` : '<div class="missing">Image needed</div>'}<div class="scene-copy"><div class="scene-meta"><span>SCENE ${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(scene.motion.replaceAll('-', ' '))}</span></div><div class="editorial-chip">${escapeHtml(editorial.type)} overlay</div>${editorial.value ? `<strong class="scene-callout">${escapeHtml(editorial.value)}</strong>` : ''}<h4>${escapeHtml(scene.title)}</h4><p>${escapeHtml(scene.subtitle)}</p></div></article>`;
  }).join('');
  await refreshProjects();
}

$('#create-project').addEventListener('click', async () => {
  const button = $('#create-project');
  button.disabled = true;
  try {
    const result = await api('/api/projects', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title: $('#new-title').value, script: $('#new-script').value})});
    await refreshProjects();
    await selectProject(result.project.id);
    toast(`Storyboard created with ${result.project.scenes.length} scenes.`);
  } catch (error) { toast(error.message); }
  button.disabled = false;
});

$('#new-project').addEventListener('click', () => {
  $('#new-title').value = '';
  $('#new-script').value = '';
  showScriptStart();
  refreshProjects().catch((error) => toast(error.message));
  $('#new-title').focus();
});

$('#save-script').addEventListener('click', async () => {
  if (!state.project) return;
  const button = $('#save-script');
  button.disabled = true;
  try {
    const result = await api(`/api/projects/${encodeURIComponent(state.project.id)}/script`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title: $('#script-title').value, script: $('#script-editor').value})});
    await selectProject(result.project.id);
    toast(`Script saved and rebuilt into ${result.project.scenes.length} scenes.`);
  } catch (error) { toast(error.message); }
  button.disabled = false;
});

$('#save-style').addEventListener('click', async () => {
  if (!state.project) return;
  const button = $('#save-style');
  button.disabled = true;
  try {
    const result = await api(`/api/projects/${encodeURIComponent(state.project.id)}/style`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({editorialStyle: $('#editorial-style').value, overlayDensity: $('#overlay-density').value, accentColor: $('#accent-color').value, showProgress: $('#show-progress').checked})});
    await selectProject(result.project.id);
    toast(`Editorial style applied: ${result.project.editorialStyle} motion with ${result.project.overlayDensity} callouts.`);
  } catch (error) { toast(error.message); }
  button.disabled = false;
});

$('#choose-zip').addEventListener('click', () => $('#zip-input').click());
$('#zip-input').addEventListener('change', async () => {
  const file = $('#zip-input').files[0];
  if (!file) return;
  const form = new FormData();
  form.append('storyboard', file);
  try {
    toast('Importing and validating storyboard…');
    const result = await api('/api/import', {method: 'POST', body: form});
    await refreshProjects();
    await selectProject(result.project.id);
    toast('Storyboard imported as an editable project.');
  } catch (error) { toast(error.message); }
  $('#zip-input').value = '';
});

$('#import-images').addEventListener('click', () => $('#image-input').click());
$('#image-input').addEventListener('change', async () => {
  if (!state.project) return;
  const files = [...$('#image-input').files];
  if (!files.length) return;
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  try {
    toast(`Importing ${files.length} image${files.length === 1 ? '' : 's'} in filename order…`);
    const result = await api(`/api/projects/${encodeURIComponent(state.project.id)}/images`, {method: 'POST', body: form});
    await selectProject(result.project.id);
    toast(`${result.imported} image${result.imported === 1 ? '' : 's'} placed into the storyboard.`);
  } catch (error) { toast(error.message); }
  $('#image-input').value = '';
});

$('#generate-voice').addEventListener('click', async () => {
  if (!state.project) return;
  const button = $('#generate-voice');
  button.disabled = true;
  button.textContent = 'Creating narration…';
  try {
    const result = await api(`/api/projects/${encodeURIComponent(state.project.id)}/narration`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({voice: $('#voice').value, rate: Number($('#voice-rate').value)})});
    await selectProject(result.project.id);
    toast(`Narration ready: ${formatDuration(result.duration)} with ${$('#voice').selectedOptions[0].textContent}.`);
  } catch (error) { toast(error.message); }
  button.disabled = false;
  button.textContent = 'Create continuous narration';
});

$('#render-preview').addEventListener('click', () => startRender('preview'));
$('#render-full').addEventListener('click', () => {
  if (!state.project?.narrationPath && !confirm('This project has no narration. Render a silent 1080p video anyway?')) return;
  startRender('youtube');
});

async function startRender(profile) {
  if (!state.project) return;
  try {
    const result = await api(`/api/projects/${encodeURIComponent(state.project.id)}/render`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({profile, previewSeconds: 24})});
    await watchJob(result.jobId, profile === 'preview' ? 'Rendering 24-second preview' : 'Rendering 1080p upload master');
  } catch (error) { toast(error.message); }
}

async function watchJob(jobId, label) {
  $('#job-panel').hidden = false;
  $('#job-label').textContent = label;
  $('#job-error').textContent = '';
  while (true) {
    const job = await api(`/api/jobs/${jobId}`);
    $('#job-percent').textContent = `${job.progress || 0}%`;
    $('#job-progress').style.width = `${job.progress || 0}%`;
    $('#job-label').textContent = `${label} · ${job.status}`;
    if (job.status === 'complete') {
      if (job.url) {
        $('#video-panel').hidden = false;
        $('#video-result').src = job.url;
        $('#download-video').href = job.url;
      }
      toast('Finished successfully. Your MP4 is ready to download.');
      return;
    }
    if (job.status === 'failed') { $('#job-error').textContent = job.error || 'The job failed.'; toast('The job needs attention.'); return; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'}[character])); }
boot().catch((error) => toast(error.message));
