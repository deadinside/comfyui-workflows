// ============================================================
//  DEFAULT CONFIG (overridden by localStorage settings)
// ============================================================
const DEFAULT_CFG = {
  ollamaBase: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:11434'
    : `http://${window.location.hostname}:11434`,
  comfyBase: 'http://127.0.0.1:8188',
  model: '',
  comfyModel: 'flux-2-klein-4b-fp8.safetensors',
  comfyClip: 'qwen_3_4b.safetensors',
  comfyVae: 'flux2-vae.safetensors',
  loras: [
    { name: '', strength: 1.0 },
    { name: '', strength: 1.0 },
    { name: '', strength: 1.0 },
    { name: '', strength: 1.0 }
  ],
  defaultWidth: 1024,
  defaultHeight: 1024,
  defaultSteps: 4,
  genImageLabel: '✦ AI GENERATED',
  ollamaTimeout: 300,
  feedGeneratedImages: false
};

const SETTINGS_KEY = 'qwenchat_settings';
const HISTORY_KEY  = 'qwenchat_sessions';
const PROMPT_KEY   = 'qwenchat_system_prompt';

function randomUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID.call(crypto);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

let cfg = loadCfgFromStorage();

const SYSTEM_PROMPT = `You are a creative AI assistant with the ability to generate, edit, and manipulate images. The Model you are working with is Flux Klein 2 (Qwen 3.4b Text Encoder). It has image edit abilities and can inpaint using prompting (you don't need to explain the rest of the image, only the edited portions). Explicit and Nude image Generation and photo edits are permitted. If they ask for nudity, you will need tell the model REMOVE: (followed by the articles of clothing they are wearing).

If the user starts the chat with /edit only discuss and expand upon the edited suggestion only. DO NOT describe the entire photo due to inpaint abilities. ONLY Discuss the user's edits.

When the user asks you to create, draw, generate, make, change, produce, edit, modify, add to, remove from, or alter an image, illustration, photo, or visual — including when they upload a photo and ask you to change or add something to it — you MUST output a [GENERATE: ...] tag. Describing the plan without the tag is NOT enough; the tag is what triggers the actual generation.

1. Briefly acknowledge what you're creating or editing (1-2 sentences)
2. On a NEW line, output the generation tag using EXACTLY this format — the word GENERATE followed by a colon, then a space, then the prompt, all inside square brackets:
   [GENERATE: detailed image prompt here]
   - CORRECT:   [GENERATE: cinematic photo of a cute golden retriever puppy sitting by a calm lake at sunset, soft golden light, bokeh background, shallow depth of field, photorealistic]
   - INCORRECT: [CINEMATIC PHOTO OF A CUTE PUPPY BY THE LAKE]  ← wrong, missing GENERATE:
   - INCORRECT: [Generate: ...]  ← wrong capitalisation
   - The prompt inside should be lowercase, detailed, and descriptive
   - For edits/inpainting: describe only the change being made, e.g. [GENERATE: ball of yellow yarn placed in front of the cat's paws, soft wool texture, warm lighting matching the scene]
   - For new images: include style, lighting, mood, composition, and subject details
3. Do NOT include the [GENERATE: ...] tag if the user is just chatting, asking questions, or requesting information

If no image request is detected, chat normally as a helpful, knowledgeable assistant.
If an image is provided by the user, you can describe and discuss it, or use it as inspiration for generation.`;

// ============================================================
//  STATE
// ============================================================
let pendingFiles = [];
let abortController = null;
let isGenerating = false;
let dropCounter = 0;
let isDraggingRef = false;
let conversationHistory = [];
let img2imgFile = null;
let img2imgFilename = null;
let img2imgFile2 = null;
let img2imgFilename2 = null;
let comfyClientId = randomUUID();
let currentSessionId = null;
let sessions = loadSessions();

// DOM refs
const chatEl      = document.getElementById('chat');
const inputEl     = document.getElementById('input');
const emptyEl     = document.getElementById('empty');
const sendBtn     = document.getElementById('send-btn');
const stopBtn     = document.getElementById('stop-btn');
const pendingEl   = document.getElementById('pending-attachments');
const dropOverlay = document.getElementById('drop-overlay');
const toast       = document.getElementById('toast');
const img2imgStrip = document.getElementById('img2img-strip');

// ─── Init ────────────────────────────────
updateModelBadge();
buildLoraRows();
populateSettingsFields();
renderHistoryList();
populateModelDropdowns(); // pre-fetch in background so Settings tab is ready

// ============================================================
//  SETTINGS
// ============================================================
function loadCfgFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return deepMerge(JSON.parse(JSON.stringify(DEFAULT_CFG)), saved);
  } catch { return JSON.parse(JSON.stringify(DEFAULT_CFG)); }
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === 'loras' && Array.isArray(source[key])) {
      target.loras = source.loras.map((l, i) => ({ ...DEFAULT_CFG.loras[i] || { name: '', strength: 1.0 }, ...l }));
    } else if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// ============================================================
//  MODEL DROPDOWN HELPERS
// ============================================================
function setSelectValue(id, value) {
  const sel = document.getElementById(id);
  if (!sel) return;
  if (value && !Array.from(sel.options).some(o => o.value === value)) {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = value;
    sel.insertBefore(opt, sel.firstChild);
  }
  sel.value = value || '';
}

function fillSelect(id, items, current, allowBlank = false) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.classList.remove('loading');
  const prev = sel.value || current;
  sel.innerHTML = '';
  if (allowBlank) {
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '— none —';
    sel.appendChild(blank);
  }
  items.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  });
  // Keep saved value even if not in list
  if (prev && !items.includes(prev)) {
    const opt = document.createElement('option');
    opt.value = prev; opt.textContent = prev + ' (saved)';
    sel.insertBefore(opt, allowBlank ? sel.children[1] : sel.firstChild);
  }
  sel.value = prev || (allowBlank ? '' : (items[0] || ''));
}

async function fetchOllamaModels() {
  try {
    const res = await fetch(`${cfg.ollamaBase}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map(m => m.name);
  } catch { return []; }
}

async function fetchComfyModelLists() {
  try {
    const res = await fetch(`${cfg.comfyBase}/object_info`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      unets: data.UNETLoader?.input?.required?.unet_name?.[0] || [],
      clips: data.CLIPLoader?.input?.required?.clip_name?.[0] || [],
      vaes:  data.VAELoader?.input?.required?.vae_name?.[0] || [],
      loras: data.LoraLoaderModelOnly?.input?.required?.lora_name?.[0] || [],
    };
  } catch { return null; }
}

async function populateModelDropdowns() {
  // Mark selects as loading
  ['s-model','s-comfy-model','s-comfy-clip','s-comfy-vae'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.classList.add('loading');
  });

  const [ollamaModels, comfy] = await Promise.all([fetchOllamaModels(), fetchComfyModelLists()]);

  fillSelect('s-model', ollamaModels, cfg.model);

  if (comfy) {
    fillSelect('s-comfy-model', comfy.unets, cfg.comfyModel);
    fillSelect('s-comfy-clip',  comfy.clips,  cfg.comfyClip);
    fillSelect('s-comfy-vae',   comfy.vaes,   cfg.comfyVae);
    // Rebuild lora rows with the fetched lora list
    buildLoraRows(comfy.loras);
  } else {
    buildLoraRows([]);
  }
  populateSettingsFields();
}

function buildLoraRows(loraList = []) {
  const container = document.getElementById('lora-rows');
  container.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');
    row.className = 'lora-row';
    const optionsHtml = ['', ...loraList].map(name =>
      `<option value="${name}">${name || '— none —'}</option>`
    ).join('');
    row.innerHTML = `
      <span class="lora-num">${i + 1}</span>
      <select class="settings-input lora-name-input" id="s-lora-${i}-name">${optionsHtml}</select>
      <input class="settings-input lora-strength-input" id="s-lora-${i}-str" type="number" min="0" max="2" step="0.05" placeholder="1.0">
      <span class="lora-optional-badge">opt</span>`;
    container.appendChild(row);
  }
}

function populateSettingsFields() {
  document.getElementById('s-ollama-base').value    = cfg.ollamaBase;
  document.getElementById('s-comfy-base').value     = cfg.comfyBase;
  document.getElementById('s-width').value          = cfg.defaultWidth;
  document.getElementById('s-height').value         = cfg.defaultHeight;
  document.getElementById('s-steps').value          = cfg.defaultSteps;
  document.getElementById('s-gen-label').value      = cfg.genImageLabel;
  document.getElementById('s-ollama-timeout').value = cfg.ollamaTimeout ?? 300;
  document.getElementById('s-feed-images').checked  = !!cfg.feedGeneratedImages;
  // Selects — setSelectValue adds the saved value as an option if not present
  setSelectValue('s-model',       cfg.model);
  setSelectValue('s-comfy-model', cfg.comfyModel);
  setSelectValue('s-comfy-clip',  cfg.comfyClip);
  setSelectValue('s-comfy-vae',   cfg.comfyVae);
  for (let i = 0; i < 4; i++) {
    const l = cfg.loras[i] || { name: '', strength: 1.0 };
    setSelectValue(`s-lora-${i}-name`, l.name);
    document.getElementById(`s-lora-${i}-str`).value = l.strength;
  }
}

function saveSettings() {
  cfg.ollamaBase   = document.getElementById('s-ollama-base').value.trim() || DEFAULT_CFG.ollamaBase;
  cfg.comfyBase    = document.getElementById('s-comfy-base').value.trim()  || DEFAULT_CFG.comfyBase;
  cfg.model        = document.getElementById('s-model').value.trim()        || DEFAULT_CFG.model;
  cfg.comfyModel   = document.getElementById('s-comfy-model').value.trim()  || DEFAULT_CFG.comfyModel;
  cfg.comfyClip    = document.getElementById('s-comfy-clip').value.trim()   || DEFAULT_CFG.comfyClip;
  cfg.comfyVae     = document.getElementById('s-comfy-vae').value.trim()    || DEFAULT_CFG.comfyVae;
  cfg.defaultWidth   = parseInt(document.getElementById('s-width').value)          || DEFAULT_CFG.defaultWidth;
  cfg.defaultHeight  = parseInt(document.getElementById('s-height').value)         || DEFAULT_CFG.defaultHeight;
  cfg.defaultSteps   = parseInt(document.getElementById('s-steps').value)          || DEFAULT_CFG.defaultSteps;
  cfg.genImageLabel  = document.getElementById('s-gen-label').value;
  cfg.ollamaTimeout       = parseInt(document.getElementById('s-ollama-timeout').value) || DEFAULT_CFG.ollamaTimeout;
  cfg.feedGeneratedImages = document.getElementById('s-feed-images').checked;
  cfg.loras = [];
  for (let i = 0; i < 4; i++) {
    cfg.loras.push({
      name:     document.getElementById(`s-lora-${i}-name`).value.trim(),
      strength: parseFloat(document.getElementById(`s-lora-${i}-str`).value) || 1.0
    });
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
  updateModelBadge();
  toggleSettings();
  showToast('Settings saved', 'success');
  checkOllamaStatus();
}

function toggleSettings() {
  switchPanelTab('settings');
  if (!document.getElementById('history-panel').classList.contains('open')) toggleHistory();
}

function switchPanelTab(tab) {
  document.getElementById('panel-tab-history').classList.toggle('active', tab === 'history');
  document.getElementById('panel-tab-settings').classList.toggle('active', tab === 'settings');
  document.getElementById('tab-btn-history').classList.toggle('active', tab === 'history');
  document.getElementById('tab-btn-settings').classList.toggle('active', tab === 'settings');
  document.getElementById('new-chat-panel-btn').style.display = tab === 'history' ? '' : 'none';
  if (tab === 'settings') populateModelDropdowns();
}

function updateModelBadge() {
  const parts = cfg.model.split(':');
  document.getElementById('model-badge').innerHTML = `<span>${parts[0]}</span>${parts[1] ? ':' + parts[1] : ''}`;
}

// ============================================================
//  HISTORY
// ============================================================
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveSessions() {
  if (sessions.length > 50) sessions = sessions.slice(-50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
}

function saveCurrentSession() {
  if (!currentSessionId || conversationHistory.length <= 1) return;
  const userMsgs = conversationHistory.filter(m => m.role === 'user' && !m._synthetic);
  if (userMsgs.length === 0) return;

  const title = (userMsgs[0].content || '').slice(0, 50) || 'Untitled';
  // Exclude synthetic feed-back messages from saved history
  const historyToSave = conversationHistory.filter(m => !m._synthetic);

  const idx = sessions.findIndex(s => s.id === currentSessionId);
  const entry = { id: currentSessionId, title, ts: Date.now(), history: historyToSave };
  if (idx >= 0) sessions[idx] = entry;
  else sessions.push(entry);

  try {
    saveSessions();
  } catch {
    // localStorage quota exceeded — strip images and retry
    const stripped = historyToSave.map(msg =>
      msg.images?.length ? { ...msg, images: msg.images.map(() => '[image]') } : msg
    );
    const fallback = { ...entry, history: stripped };
    if (idx >= 0) sessions[idx] = fallback; else sessions[sessions.length - 1] = fallback;
    try { saveSessions(); } catch {}
  }
  renderHistoryList();
}

function renderHistoryList() {
  const list = document.getElementById('history-list');
  if (sessions.length === 0) {
    list.innerHTML = '<div class="history-empty-note">No saved chats yet.<br>Start a conversation to build history.</div>';
    return;
  }
  const sorted = [...sessions].sort((a, b) => b.ts - a.ts);
  list.innerHTML = sorted.map(s => {
    const active = s.id === currentSessionId ? ' active' : '';
    const date = new Date(s.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="history-item${active}" onclick="loadSession('${s.id}')">
      <div class="history-item-title">${escapeHtml(s.title)}</div>
      <div class="history-item-meta">${date}</div>
    </div>`;
  }).join('');
}

function loadSession(id) {
  saveCurrentSession();
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  currentSessionId = id;
  conversationHistory = session.history || [];

  const wrap = chatEl.querySelector('.msg-wrap');
  wrap.innerHTML = '';
  wrap.appendChild(emptyEl);
  emptyEl.style.display = 'none';

  for (const msg of conversationHistory) {
    if (msg.role === 'system' || msg._synthetic) continue;
    if (msg.role === 'user') {
      const msgEl = addMessage('user', msg.content || '');
      if (msg.images?.length) {
        const bubble = msgEl.querySelector('.bubble');
        msg.images.forEach(b64 => {
          if (!b64 || b64 === '[image]') {
            const chip = document.createElement('div');
            chip.className = 'att-chip';
            chip.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0;color:var(--accent)"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Image (not stored)</span>`;
            bubble.insertBefore(chip, bubble.firstChild);
          } else {
            const img = document.createElement('img');
            img.className = 'att-img zoomable';
            img.src = `data:image/jpeg;base64,${b64}`;
            img.onclick = () => openLightbox(img.src);
            bubble.insertBefore(img, bubble.firstChild);
          }
        });
      }
    } else if (msg.role === 'assistant') {
      const displayText = (msg.content || '').replace(/\[GENERATE:[\s\S]*?\]/g, '').trim();
      const msgEl = addMessage('ai', displayText || '');
      if (msg.generated_images?.length) {
        const bubble = msgEl.querySelector('.bubble');
        msg.generated_images.forEach(url => appendGeneratedImage(bubble, url));
      }
    }
  }

  renderHistoryList();
  closeHistory();
  scrollToBottom();
}

function newChat() {
  if (isGenerating) stopGeneration();
  saveCurrentSession();
  currentSessionId = randomUUID();
  conversationHistory = [];
  clearRefImage('base');
  clearRefImage('ref');
  pendingFiles = [];
  pendingEl.innerHTML = '';
  inputEl.value = '';
  inputEl.style.height = 'auto';

  const wrap = chatEl.querySelector('.msg-wrap');
  wrap.innerHTML = '';
  wrap.appendChild(emptyEl);
  emptyEl.style.display = '';

  renderHistoryList();
  closeHistory();
}

function toggleHistory() {
  document.getElementById('history-panel').classList.toggle('open');
  document.getElementById('history-backdrop').classList.toggle('active');
}

function closeHistory() {
  document.getElementById('history-panel').classList.remove('open');
  document.getElementById('history-backdrop').classList.remove('active');
}

window.addEventListener('beforeunload', saveCurrentSession);

// ============================================================
//  OLLAMA STATUS
// ============================================================
async function checkOllamaStatus() {
  try {
    const r = await fetch(`${cfg.ollamaBase}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const dot = document.getElementById('status-dot');
    dot.style.background = r.ok ? 'var(--success)' : 'var(--danger)';
    dot.style.boxShadow  = r.ok ? '0 0 6px var(--success)' : '0 0 6px var(--danger)';
  } catch {
    const dot = document.getElementById('status-dot');
    dot.style.background = 'var(--danger)';
    dot.style.boxShadow  = '0 0 6px var(--danger)';
  }
}
checkOllamaStatus();
setInterval(checkOllamaStatus, 10000);

// ============================================================
//  IMG2IMG — DUAL IMAGE HANDLING
// ============================================================
document.getElementById('img2img-input-base').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (file) await loadRefImage(file, 'base');
});
document.getElementById('img2img-input-ref').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (file) await loadRefImage(file, 'ref');
});

async function loadRefImage(file, slot) {
  const url = URL.createObjectURL(file);

  if (slot === 'base') {
    img2imgFile = file;
    document.getElementById('ref-thumb-base').src = url;
    document.getElementById('ref-name-base').textContent = file.name;
  } else {
    img2imgFile2 = file;
    document.getElementById('ref-thumb-ref').src = url;
    document.getElementById('ref-name-ref').textContent = file.name;
  }

  updateImg2ImgStrip();

  showToast(`Uploading ${slot} image to ComfyUI…`, 'success');
  try {
    const uploaded = await uploadImageToComfy(file);
    if (slot === 'base') img2imgFilename = uploaded;
    else img2imgFilename2 = uploaded;
    showToast(`${slot === 'base' ? 'Base' : 'Reference'} loaded: ${uploaded}`, 'success');
  } catch (err) {
    showToast(`ComfyUI upload failed: ${err.message}`);
    if (slot === 'base') img2imgFilename = null;
    else img2imgFilename2 = null;
  }

  const id = Date.now() + Math.random();
  pendingFiles.push({ id, file });
  addPendingChip(id, file);
}

function clearRefImage(slot) {
  if (slot === 'base') {
    img2imgFile = null; img2imgFilename = null;
    document.getElementById('ref-thumb-base').src = '';
    document.getElementById('ref-name-base').textContent = '';
  } else {
    img2imgFile2 = null; img2imgFilename2 = null;
    document.getElementById('ref-thumb-ref').src = '';
    document.getElementById('ref-name-ref').textContent = '';
  }
  updateImg2ImgStrip();
}

function swapRefImages() {
  [img2imgFile, img2imgFile2] = [img2imgFile2, img2imgFile];
  [img2imgFilename, img2imgFilename2] = [img2imgFilename2, img2imgFilename];

  const t1 = document.getElementById('ref-thumb-base').src;
  const t2 = document.getElementById('ref-thumb-ref').src;
  const n1 = document.getElementById('ref-name-base').textContent;
  const n2 = document.getElementById('ref-name-ref').textContent;
  document.getElementById('ref-thumb-base').src = t2;
  document.getElementById('ref-thumb-ref').src = t1;
  document.getElementById('ref-name-base').textContent = n2;
  document.getElementById('ref-name-ref').textContent = n1;

  updateImg2ImgStrip();
}

function updateImg2ImgStrip() {
  const hasBase = !!img2imgFile;
  const hasRef  = !!img2imgFile2;

  img2imgStrip.classList.toggle('active', hasBase || hasRef);

  document.getElementById('ref-slot-base').style.display = hasBase ? '' : 'none';
  document.getElementById('ref-slot-ref').style.display  = hasRef  ? '' : 'none';
  document.getElementById('ref-swap-btn').classList.toggle('visible', hasBase && hasRef);
  document.getElementById('add-ref-btn').classList.toggle('visible', hasBase && !hasRef);

  document.getElementById('img2img-btn-base').classList.toggle('active', hasBase);
  document.getElementById('img2img-btn-ref').classList.toggle('active', hasRef);
}

updateImg2ImgStrip();

// Drag-drop swap between ref slots
let draggingRefSlot = null;

['ref-slot-base', 'ref-slot-ref'].forEach(slotId => {
  const el = document.getElementById(slotId);

  el.addEventListener('dragstart', (e) => {
    isDraggingRef = true;
    draggingRefSlot = slotId === 'ref-slot-base' ? 'base' : 'ref';
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', () => { isDraggingRef = false; draggingRefSlot = null; el.classList.remove('drag-over'); });
  el.addEventListener('dragover', (e) => {
    const thisSlot = slotId === 'ref-slot-base' ? 'base' : 'ref';
    if (draggingRefSlot && draggingRefSlot !== thisSlot) {
      e.preventDefault(); el.classList.add('drag-over');
    }
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('drag-over');
    const thisSlot = slotId === 'ref-slot-base' ? 'base' : 'ref';
    if (draggingRefSlot && draggingRefSlot !== thisSlot) {
      e.preventDefault(); e.stopPropagation();
      swapRefImages();
    }
  });
});

async function uploadImageToComfy(file) {
  const formData = new FormData();
  formData.append('image', file, file.name);
  formData.append('overwrite', 'true');
  const res = await fetch(`${cfg.comfyBase}/upload/image`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.name;
}

// ============================================================
//  FILE ATTACHMENT (regular)
// ============================================================
document.getElementById('file-input').addEventListener('change', (e) => {
  handleFiles(Array.from(e.target.files)); e.target.value = '';
});

function handleFiles(files) {
  files.forEach(f => {
    const id = Date.now() + Math.random();
    pendingFiles.push({ id, file: f });
    addPendingChip(id, f);
  });
}

function addPendingChip(id, file) {
  const chip = document.createElement('div');
  chip.className = 'pending-chip';
  chip.dataset.id = id;
  const isImg = file.type.startsWith('image/');
  chip.innerHTML = `
    ${isImg
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0;color:var(--accent)"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;flex-shrink:0;color:var(--accent)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`}
    <span title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
    <button class="chip-remove" onclick="removePending(${id})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  pendingEl.appendChild(chip);
}

function removePending(id) {
  pendingFiles = pendingFiles.filter(f => f.id !== id);
  const chip = pendingEl.querySelector(`[data-id="${id}"]`);
  if (chip) chip.remove();
}

// ============================================================
//  SPLIT DRAG AND DROP
// ============================================================
document.addEventListener('dragenter', (e) => {
  if (isDraggingRef) return;
  e.preventDefault(); dropCounter++;
  if (dropCounter === 1) dropOverlay.classList.add('active');
});
document.addEventListener('dragleave', (e) => {
  if (isDraggingRef) return;
  dropCounter--;
  if (dropCounter <= 0) { dropCounter = 0; dropOverlay.classList.remove('active'); }
});
document.addEventListener('dragover', (e) => { if (!isDraggingRef) e.preventDefault(); });

document.addEventListener('drop', (e) => {
  if (isDraggingRef) return;
  e.preventDefault(); dropCounter = 0; dropOverlay.classList.remove('active');
});

const dzImg2img = document.getElementById('dz-img2img');
const dzChat    = document.getElementById('dz-chat');

dzImg2img.addEventListener('dragover', (e) => { e.preventDefault(); dzImg2img.classList.add('hover'); dzChat.classList.remove('hover'); });
dzImg2img.addEventListener('dragleave', () => dzImg2img.classList.remove('hover'));
dzImg2img.addEventListener('drop', async (e) => {
  e.preventDefault(); e.stopPropagation();
  dropCounter = 0; dropOverlay.classList.remove('active');
  dzImg2img.classList.remove('hover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length === 0) return;
  await loadRefImage(files[0], 'base');
  if (files[1]) await loadRefImage(files[1], 'ref');
});

dzChat.addEventListener('dragover', (e) => { e.preventDefault(); dzChat.classList.add('hover'); dzImg2img.classList.remove('hover'); });
dzChat.addEventListener('dragleave', () => dzChat.classList.remove('hover'));
dzChat.addEventListener('drop', (e) => {
  e.preventDefault(); e.stopPropagation();
  dropCounter = 0; dropOverlay.classList.remove('active');
  dzChat.classList.remove('hover');
  const files = Array.from(e.dataTransfer.files);
  if (files.length) handleFiles(files);
});

// ============================================================
//  SEND MESSAGE
// ============================================================
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
});
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isGenerating) sendMessage(); }
});

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text && pendingFiles.length === 0) return;
  if (isGenerating) return;

  if (!currentSessionId) currentSessionId = randomUUID();

  const files = [...pendingFiles];
  pendingFiles = [];
  pendingEl.innerHTML = '';
  inputEl.value = '';
  inputEl.style.height = 'auto';

  emptyEl.style.display = 'none';
  setGenerating(true);

  addMessage('user', text, files);
  const thinkEl = addThinking('thinking');

  const images = [];
  const textParts = [];
  for (const { file } of files) {
    if (file.type.startsWith('image/')) {
      images.push(await imageToJpegBase64(file));
    } else {
      try {
        const content = await file.text();
        textParts.push(`\n\n[File: ${file.name}]\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``);
      } catch {
        textParts.push(`\n\n[Attached file: ${file.name} — binary]`);
      }
    }
  }

  const userContent = text + textParts.join('');
  const userMessage = { role: 'user', content: userContent, ...(images.length > 0 && { images }) };

  if (conversationHistory.length === 0) {
    conversationHistory.push({ role: 'system', content: getActiveSystemPrompt() });
  }
  conversationHistory.push(userMessage);

  abortController = new AbortController();
  let aiBubble = null;
  let fullText = '';

  try {
    const timeoutId = setTimeout(() => abortController.abort(), (cfg.ollamaTimeout || 300) * 1000);

    const res = await fetch(`${cfg.ollamaBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, messages: conversationHistory, stream: true }),
      signal: abortController.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama error ${res.status}: ${err}`);
    }

    thinkEl.remove();
    aiBubble = addMessage('ai', '');
    const bubbleContent = aiBubble.querySelector('.bubble-content');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            fullText += json.message.content;
            const displayText = fullText.replace(/\[GENERATE:[\s\S]*?\]/g, '').replace(/\[([A-Z][A-Z ,\w'"-]{30,})\]/g, '').trim();
            bubbleContent.innerHTML = renderMarkdown(displayText || '…');
            scrollToBottom();
          }
          if (json.done) break;
        } catch {}
      }
    }

    if (fullText) {
      conversationHistory.push({ role: 'assistant', content: fullText });
    } else {
      if (aiBubble) aiBubble.remove();
      conversationHistory.pop();
      showToast('No response from Ollama — model may still be loading, try again.');
    }

    // Primary: correct format [GENERATE: ...]
    // Fallback: model dropped the prefix and output [PROMPT TEXT] or [PROMPT TEXT IN CAPS]
    const genMatch = fullText.match(/\[GENERATE:\s*([\s\S]*?)\]/)
      || fullText.match(/\[([A-Z][A-Z ,\w'"-]{30,})\]/);
    if (genMatch) await handleImageGeneration(genMatch[1].trim().toLowerCase(), aiBubble);

  } catch (err) {
    conversationHistory.pop();
    thinkEl?.remove();
    if (err.name !== 'AbortError') {
      if (!aiBubble) aiBubble = addMessage('ai', '');
      aiBubble.querySelector('.bubble-content').innerHTML = `<span style="color:var(--danger)">⚠ ${escapeHtml(err.message)}</span>`;
      showToast(err.message);
    }
  }

  setGenerating(false);
  scrollToBottom();
}

// ============================================================
//  COMFYUI IMAGE GENERATION
// ============================================================
async function handleImageGeneration(prompt, aiBubble) {
  const bubble = aiBubble.querySelector('.bubble');
  const genIndicator = document.createElement('div');
  genIndicator.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;background:rgba(247,106,158,0.07);border:1px solid rgba(247,106,158,0.25);border-radius:10px;font-size:12px;color:var(--img-accent);font-family:var(--mono)';
  genIndicator.innerHTML = `<div class="img-spinner"></div><span>Generating image…</span>`;
  bubble.appendChild(genIndicator);
  scrollToBottom();

  try {
    const workflow = buildWorkflow(prompt);
    const promptId = await queueComfyPrompt(workflow);
    const imageUrl = await waitForComfyImage(promptId);
    genIndicator.remove();

    // Persist the generated image URL on the last assistant history entry
    const lastEntry = conversationHistory[conversationHistory.length - 1];
    if (lastEntry?.role === 'assistant') {
      lastEntry.generated_images = [...(lastEntry.generated_images || []), imageUrl];
    }

    // Optionally feed the result back into Ollama context so the model can reference it
    if (cfg.feedGeneratedImages) {
      try {
        const blob = await fetch(imageUrl).then(r => r.blob());
        const b64 = await imageToJpegBase64(blob);
        if (b64 && b64.length > 100) {
          conversationHistory.push({
            role: 'user',
            content: 'This is the image you just generated. You can reference it in follow-up replies.',
            images: [b64],
            _synthetic: true
          });
        }
      } catch { /* non-fatal — generation still succeeded */ }
    }

    appendGeneratedImage(bubble, imageUrl);
    scrollToBottom();
  } catch (err) {
    genIndicator.remove();
    const errEl = document.createElement('div');
    errEl.style.cssText = 'margin-top:10px;font-size:12px;color:var(--danger)';
    errEl.textContent = `⚠ Image generation failed: ${err.message}`;
    bubble.appendChild(errEl);
    showToast(`ComfyUI: ${err.message}`);
  }
}

function appendGeneratedImage(bubble, imageUrl) {
  const wrap = document.createElement('div');
  wrap.className = 'gen-image-wrap';
  const ts = Date.now();
  const labelHtml = cfg.genImageLabel
    ? `<div class="gen-image-label">${escapeHtml(cfg.genImageLabel)}</div>` : '';
  wrap.innerHTML = `
    ${labelHtml}
    <img src="${imageUrl}" alt="Generated image" loading="lazy" class="zoomable" onclick="openLightbox('${imageUrl}')">
    <button class="gen-image-download" onclick="saveGeneratedImage('${imageUrl}', 'QwenChat_${ts}.png')">↓ Save image</button>`;
  bubble.appendChild(wrap);
}

function buildWorkflow(prompt) {
  const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const steps = parseInt(cfg.defaultSteps) || 4;
  const w = parseInt(cfg.defaultWidth) || 1024;
  const h = parseInt(cfg.defaultHeight) || 1024;

  const activeLoras = cfg.loras.filter(l => l.name && l.name.trim());
  const loraNodeIds = ['141', '147', '148', '149'];
  const loraNodes = {};
  let lastModelRef = ["125", 0];
  activeLoras.forEach((lora, i) => {
    const nid = loraNodeIds[i];
    loraNodes[nid] = {
      inputs: { lora_name: lora.name.trim(), strength_model: parseFloat(lora.strength) || 1.0, model: lastModelRef },
      class_type: "LoraLoaderModelOnly",
      _meta: { title: "Load LoRA" }
    };
    lastModelRef = [nid, 0];
  });

  const base = {
    "9":   { inputs: { filename_prefix: "QwenChat", images: ["138", 0] }, class_type: "SaveImage", _meta: { title: "Save Image" } },
    "124": { inputs: { sampler_name: "euler" }, class_type: "KSamplerSelect", _meta: { title: "KSamplerSelect" } },
    "125": { inputs: { unet_name: cfg.comfyModel, weight_dtype: "default" }, class_type: "UNETLoader", _meta: { title: "Load Diffusion Model" } },
    "126": { inputs: { clip_name: cfg.comfyClip, type: "flux2", device: "default" }, class_type: "CLIPLoader", _meta: { title: "Load CLIP" } },
    "127": { inputs: { vae_name: cfg.comfyVae }, class_type: "VAELoader", _meta: { title: "Load VAE" } },
    "137": { inputs: { noise: ["139", 0], guider: ["140", 0], sampler: ["124", 0], sigmas: ["130", 0], latent_image: ["128", 0] }, class_type: "SamplerCustomAdvanced", _meta: { title: "SamplerCustomAdvanced" } },
    "138": { inputs: { samples: ["137", 0], vae: ["127", 0] }, class_type: "VAEDecode", _meta: { title: "VAE Decode" } },
    "139": { inputs: { noise_seed: seed }, class_type: "RandomNoise", _meta: { title: "RandomNoise" } },
    "131": { inputs: { text: prompt, clip: ["126", 0] }, class_type: "CLIPTextEncode", _meta: { title: "CLIP Text Encode (Positive Prompt)" } },
    "132": { inputs: { conditioning: ["131", 0] }, class_type: "ConditioningZeroOut", _meta: { title: "ConditioningZeroOut" } },
    ...loraNodes
  };

  const hasBase = !!img2imgFilename;
  const hasRef  = !!img2imgFilename2;

  if (!hasBase) {
    return {
      ...base,
      "128": { inputs: { width: w, height: h, batch_size: 1 }, class_type: "EmptyFlux2LatentImage", _meta: { title: "Empty Flux 2 Latent" } },
      "130": { inputs: { steps, width: w, height: h }, class_type: "Flux2Scheduler", _meta: { title: "Flux2Scheduler" } },
      "140": { inputs: { cfg: 1, model: lastModelRef, positive: ["131", 0], negative: ["132", 0] }, class_type: "CFGGuider", _meta: { title: "CFGGuider" } }
    };
  }

  const img2imgBase = {
    "76":  { inputs: { image: img2imgFilename }, class_type: "LoadImage", _meta: { title: "Load Image" } },
    "129": { inputs: { upscale_method: "nearest-exact", megapixels: 1, resolution_steps: 1, image: ["76", 0] }, class_type: "ImageScaleToTotalPixels", _meta: { title: "Scale Image to Total Pixels" } },
    "134": { inputs: { image: ["129", 0] }, class_type: "GetImageSize", _meta: { title: "Get Image Size" } },
    "128": { inputs: { width: ["134", 0], height: ["134", 1], batch_size: 1 }, class_type: "EmptyFlux2LatentImage", _meta: { title: "Empty Flux 2 Latent" } },
    "130": { inputs: { steps, width: ["134", 0], height: ["134", 1] }, class_type: "Flux2Scheduler", _meta: { title: "Flux2Scheduler" } },
    "136": { inputs: { pixels: ["129", 0], vae: ["127", 0] }, class_type: "VAEEncode", _meta: { title: "VAE Encode" } },
    "133": { inputs: { conditioning: ["132", 0], latent: ["136", 0] }, class_type: "ReferenceLatent", _meta: { title: "ReferenceLatent" } },
    "135": { inputs: { conditioning: ["131", 0], latent: ["136", 0] }, class_type: "ReferenceLatent", _meta: { title: "ReferenceLatent" } }
  };

  if (!hasRef) {
    return {
      ...base,
      ...img2imgBase,
      "140": { inputs: { cfg: 1, model: lastModelRef, positive: ["135", 0], negative: ["133", 0] }, class_type: "CFGGuider", _meta: { title: "CFGGuider" } }
    };
  }

  return {
    ...base,
    ...img2imgBase,
    "142": { inputs: { image: img2imgFilename2 }, class_type: "LoadImage", _meta: { title: "Load Image" } },
    "143": { inputs: { upscale_method: "nearest-exact", megapixels: 1, resolution_steps: 1, image: ["142", 0] }, class_type: "ImageScaleToTotalPixels", _meta: { title: "Scale Image to Total Pixels" } },
    "144": { inputs: { pixels: ["143", 0], vae: ["127", 0] }, class_type: "VAEEncode", _meta: { title: "VAE Encode" } },
    "145": { inputs: { conditioning: ["133", 0], latent: ["144", 0] }, class_type: "ReferenceLatent", _meta: { title: "ReferenceLatent" } },
    "146": { inputs: { conditioning: ["135", 0], latent: ["144", 0] }, class_type: "ReferenceLatent", _meta: { title: "ReferenceLatent" } },
    "140": { inputs: { cfg: 1, model: lastModelRef, positive: ["146", 0], negative: ["145", 0] }, class_type: "CFGGuider", _meta: { title: "CFGGuider" } }
  };
}

async function queueComfyPrompt(workflow) {
  const body = { prompt: workflow, client_id: comfyClientId };
  const res = await fetch(`${cfg.comfyBase}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ComfyUI queue error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return data.prompt_id;
}

async function waitForComfyImage(promptId, maxWaitMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const res = await fetch(`${cfg.comfyBase}/history/${promptId}`);
      if (!res.ok) continue;
      const history = await res.json();
      if (history[promptId]?.outputs) {
        for (const nodeId of Object.keys(history[promptId].outputs)) {
          const node = history[promptId].outputs[nodeId];
          if (node.images?.length > 0) {
            const img = node.images[0];
            return `${cfg.comfyBase}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`;
          }
        }
      }
    } catch {}
  }
  throw new Error('Timed out waiting for image');
}

// ============================================================
//  UI HELPERS
// ============================================================
function stopGeneration() {
  if (abortController) { abortController.abort(); abortController = null; }
  setGenerating(false);
}

function setGenerating(val) {
  isGenerating = val;
  sendBtn.disabled = val;
  stopBtn.classList.toggle('visible', val);
}

function addMessage(role, text, files = []) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'ai' ? 'AI' : 'U';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (files.length > 0) {
    const imgFiles   = files.filter(f => f.file.type.startsWith('image/'));
    const otherFiles = files.filter(f => !f.file.type.startsWith('image/'));
    imgFiles.forEach(({ file }) => {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.className = 'att-img zoomable'; img.src = url; img.alt = file.name;
      img.onclick = () => openLightbox(url);
      bubble.appendChild(img);
    });
    if (otherFiles.length > 0) {
      const chips = document.createElement('div');
      chips.className = 'attachment-preview';
      otherFiles.forEach(({ file }) => {
        chips.innerHTML += `<div class="att-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        </div>`;
      });
      bubble.appendChild(chips);
    }
  }

  const content = document.createElement('div');
  content.className = 'bubble-content';
  content.innerHTML = text ? renderMarkdown(text) : '';
  bubble.appendChild(content);

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatEl.querySelector('.msg-wrap').appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function saveGeneratedImage(url, filename = 'generated.png') {
  fetch(url)
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename; a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => {
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.target = '_blank'; a.click();
    });
}

function addThinking(mode = 'thinking') {
  const wrap = document.createElement('div');
  wrap.className = 'thinking-wrap';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ai'; avatar.textContent = 'AI';
  const bubble = document.createElement('div');
  bubble.className = `thinking-bubble${mode === 'generating' ? ' generating' : ''}`;
  const orbColor = mode === 'generating' ? ' pink' : '';
  const label = mode === 'generating' ? 'generating image…' : 'thinking…';
  bubble.innerHTML = `<div class="orbs"><div class="orb${orbColor}"></div><div class="orb${orbColor}"></div><div class="orb${orbColor}"></div></div><span class="think-label${mode === 'generating' ? ' generating-label' : ''}">${label}</span>`;
  wrap.appendChild(avatar); wrap.appendChild(bubble);
  chatEl.querySelector('.msg-wrap').appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function scrollToBottom() { chatEl.scrollTop = chatEl.scrollHeight; }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Converts any image (including WebP) to JPEG base64 for Ollama compatibility
function imageToJpegBase64(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      if (source instanceof Blob) URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<strong style="font-size:15px;display:block;margin-top:10px;color:var(--text)">$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong style="font-size:16px;display:block;margin-top:12px;color:var(--text)">$1</strong>');
  html = html.replace(/^# (.+)$/gm, '<strong style="font-size:17px;display:block;margin-top:12px;color:var(--text)">$1</strong>');
  html = html.replace(/^[*\-] (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal">$2</li>');
  html = html.replace(/\n\n+/g, '</p><p style="margin-top:8px">');
  html = html.replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.getElementById('lightbox-img').src = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// ============================================================
//  MASTER PROMPT EDITOR
// ============================================================
function getActiveSystemPrompt() {
  return localStorage.getItem(PROMPT_KEY) || SYSTEM_PROMPT;
}

function isPromptCustom() {
  const saved = localStorage.getItem(PROMPT_KEY);
  return !!saved && saved !== SYSTEM_PROMPT;
}

function updatePromptStatusBadge() {
  const custom = isPromptCustom();
  ['prompt-status-badge', 'prompt-modal-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = custom ? 'Custom' : 'Original';
    el.classList.toggle('custom', custom);
  });
}

function openPromptEditor() {
  document.getElementById('prompt-textarea').value = getActiveSystemPrompt();
  updatePromptStatusBadge();
  document.getElementById('prompt-modal').classList.add('active');
  document.getElementById('prompt-textarea').focus();
}

function closePromptEditor() {
  document.getElementById('prompt-modal').classList.remove('active');
}

function promptEditorUseOriginal() {
  document.getElementById('prompt-textarea').value = SYSTEM_PROMPT;
  document.getElementById('prompt-modal-badge').textContent = 'Original';
  document.getElementById('prompt-modal-badge').classList.remove('custom');
}

function savePromptEditor() {
  const val = document.getElementById('prompt-textarea').value.trim();
  if (val === SYSTEM_PROMPT || val === '') {
    localStorage.removeItem(PROMPT_KEY);
  } else {
    localStorage.setItem(PROMPT_KEY, val);
  }
  updatePromptStatusBadge();
  closePromptEditor();
  showToast('Master prompt saved', 'success');
}

function useOriginalPrompt() {
  localStorage.removeItem(PROMPT_KEY);
  updatePromptStatusBadge();
  showToast('Restored original master prompt', 'success');
}

// Close modal on backdrop click
document.getElementById('prompt-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('prompt-modal')) closePromptEditor();
});

// Init badge
updatePromptStatusBadge();

function showToast(msg, type = 'error') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 4000);
}
