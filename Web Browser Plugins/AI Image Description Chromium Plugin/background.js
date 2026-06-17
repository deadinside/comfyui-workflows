// ===========================================================================
// AI Image Description — background service worker
//
// The popup used to do all the work (upload + poll), which meant closing the
// popup killed the in-flight request. Now the service worker owns the request
// lifecycle and streams state into chrome.storage.local. The popup is just a
// view that reads `activeRequest` and listens for storage changes, so closing
// and reopening the popup never loses a result.
// ===========================================================================

const DEFAULT_PROMPT =
  "Describe this image. Describe the people pictured in this image if multiple. In detail, describe the person, the background, the lighting. Stick to only the information asked and do not add extra dialogue. Provide the information back in the form of a detailed image prompt.";

const HISTORY_LIMIT = 100;

// ---------------------------------------------------------------------------
// Context menus
// ---------------------------------------------------------------------------

const PRESET_PROMPTS = {
  preset1:
    "Describe this image in extreme detail, including subject appearance, clothing, pose, expression, background elements, lighting, camera angle, composition, color palette, and overall aesthetic style. Use precise, descriptive language suitable for AI image generation prompts. Do not use vague terms. Only return the prompts itself.",
  preset2:
    "Analyze this image as the starting frame for an image-to-video sequence. Do not restate or reinterpret the static elements already visible. Instead, describe the most natural next movements and micro-actions that would occur in the next five to ten seconds based strictly on posture, gaze direction, physical context, and environmental cues. Describe how the subject transitions from stillness into motion, including subtle gestures, shifts in weight, head movement, or changes in expression. Specify how the camera should behave-such as a slow push-in, a handheld follow, or a slight pan-using clear cinematic language. Describe the lighting continuity, atmosphere, and any natural environmental motion such as drifting dust, flickering light, or moving reflections. If relevant, describe ambient audio cues such as room tone, wind, footsteps, or environmental noise, but do not add dialogue. Provide the final output as a single, flowing, motion-aware video prompt written in present tense, with no extra commentary or reasoning. Tips for the prompt: What Works Well: Cinematic compositions Wide, medium, and close-up shots with thoughtful lighting, shallow depth of field, and natural motion.Emotive human moments: Strong single-subject emotional expressions, subtle gestures, and facial nuance. Atmosphere & setting: Fog, mist, golden-hour light, rain, reflections, ambient textures. Clear camera language: Explicit instructions like “slow dolly in” or “handheld tracking”. Stylized aesthetics: Painterly, noir, analog film, fashion editorial, pixelated animation. Lighting & mood control: Backlighting, color palettes, rim light, flickering lamps. What to Avoid: Internal emotional states: Use visual cues instead of labels like “sad” or “confused”. Text and logos: Readable text is not currently reliable. Complex physics: Chaotic motion can introduce artifacts (dancing is OK). Overloaded scenes: Too many characters or actions reduce clarity. Conflicting lighting: Mixed light logic confuses scene interpretation. Overcomplicated prompts: Start simple and layer complexity gradually. Present the prompt instructions only.",
  preset3:
    "Read all visible text in this image exactly as written. Preserve line breaks, punctuation, headings, and formatting where possible. Do not summarize, interpret, or add commentary. If the text is partially cut off or unclear, transcribe only the readable portion without guessing. Return the result as a clean, plain-text transcription.",
  preset4:
    "You are an image‑analysis model. Examine the provided image and detect AI‑generation mistakes with strict visual grounding. Focus on human anatomy issues such as incorrect finger count, fused or missing fingers, distorted hands or limbs, unnatural joint angles, facial asymmetry, misaligned eyes, or proportion errors. Also check for general AI artifacts including warped or duplicated objects, repeating textures, impossible reflections or shadows, distorted backgrounds, broken perspective, or clothing and texture glitches. Report only what is visibly confirmed in the image and avoid speculation or artistic description. If mistakes are present, list them clearly under ‘Mistakes:’ using bullet points; if none are found, output only ‘No mistakes detected.’ Follow this format exactly and do not add commentary or suggestions."
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "AIDescribe",
    title: "AI Image Description",
    contexts: ["image"]
  });

  chrome.contextMenus.create({ id: "preset1", title: "Img 2 Img Prompt", contexts: ["action"] });
  chrome.contextMenus.create({ id: "preset4", title: "AI Image Error Detection", contexts: ["action"] });
  chrome.contextMenus.create({ id: "preset2", title: "Img 2 Motion Aware Video Prompt", contexts: ["action"] });
  chrome.contextMenus.create({ id: "preset3", title: "OCR Text Reader", contexts: ["action"] });
  chrome.contextMenus.create({ id: "Custom", title: "Custom Prompt - Set in Options", contexts: ["action"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Preset menus just swap the active custom prompt.
  if (PRESET_PROMPTS[info.menuItemId]) {
    await chrome.storage.sync.set({ customPrompt: PRESET_PROMPTS[info.menuItemId] });
    return;
  }

  // "Custom" preset keeps whatever the user saved in Options.
  if (info.menuItemId === "Custom") return;

  // The actual image request.
  if (info.menuItemId === "AIDescribe") {
    // Open the popup immediately (this click is a user gesture) so the user
    // sees progress; the heavy lifting happens here in the worker regardless.
    try {
      await chrome.action.openPopup();
    } catch (e) {
      // openPopup can throw if no window is focused; not fatal.
      console.warn("openPopup failed:", e);
    }
    startRequest(info.srcUrl);
  }
});

// ---------------------------------------------------------------------------
// Request lifecycle
// ---------------------------------------------------------------------------

// Guards against two simultaneous requests stomping on each other.
let currentRequestId = null;

async function startRequest(imageUrl) {
  const id = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  currentRequestId = id;

  const { comfyUrl, gemmaModel, customPrompt } = await chrome.storage.sync.get([
    "comfyUrl",
    "gemmaModel",
    "customPrompt"
  ]);

  const promptText =
    customPrompt && customPrompt.trim().length > 0 ? customPrompt.trim() : DEFAULT_PROMPT;

  const request = {
    id,
    status: "uploading", // uploading | queued | running | done | error
    statusText: "Fetching image…",
    imageUrl,
    thumbnail: null,
    model: gemmaModel || null,
    prompt: promptText,
    progress: null, // { value, max }
    result: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null
  };

  await setActive(request);

  if (!comfyUrl) {
    return fail(request, "No ComfyUI URL configured. Open the extension Options to set it.");
  }

  const base = baseUrl(comfyUrl);

  // STEP 1 — fetch the image blob.
  let imgBlob;
  try {
    imgBlob = await fetch(imageUrl).then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    });
  } catch (err) {
    return fail(request, "Failed to fetch image: " + err.message);
  }

  // Generate a thumbnail for the popup + history (best effort).
  request.thumbnail = await makeThumbnail(imgBlob);
  await setActive(request);

  // STEP 2 — upload to ComfyUI.
  request.statusText = "Uploading image…";
  await setActive(request);

  let uploadedName;
  try {
    const form = new FormData();
    form.append("image", imgBlob, "upload.png");
    const uploadRes = await fetch(base + "/upload/image", { method: "POST", body: form });
    const uploadJson = JSON.parse(await uploadRes.text());
    uploadedName = uploadJson.name;
    if (!uploadedName) throw new Error("Upload returned no filename.");
  } catch (err) {
    return fail(request, "Image upload failed: " + err.message);
  }

  // STEP 3 — build the workflow payload.
  const payload = buildWorkflow(uploadedName, request.prompt, request.model);

  // STEP 4 — open the WebSocket BEFORE queuing so we don't miss early events.
  request.status = "queued";
  request.statusText = "Queued on ComfyUI…";
  await setActive(request);

  let promptId;
  let socket;
  let settled = false;

  const finish = async result => {
    if (settled) return;
    settled = true;
    try { socket && socket.close(); } catch {}
    if (currentRequestId !== id) return; // a newer request superseded us
    request.status = "done";
    request.statusText = "Done";
    request.progress = null;
    request.result = result || "No description returned.";
    request.finishedAt = Date.now();
    await setActive(request);
    await pushHistory(request);
  };

  const errored = async msg => {
    if (settled) return;
    settled = true;
    try { socket && socket.close(); } catch {}
    fail(request, msg);
  };

  try {
    socket = new WebSocket(wsUrl(base, clientId));

    socket.addEventListener("message", async ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; } // ignore binary preview frames
      const data = msg.data || {};
      // Only react to our own prompt once we know its id.
      if (data.prompt_id && promptId && data.prompt_id !== promptId) return;

      if (msg.type === "progress") {
        if (currentRequestId !== id) return;
        request.status = "running";
        request.progress = { value: data.value, max: data.max };
        request.statusText = `Generating… ${data.value}/${data.max}`;
        await setActive(request);
      } else if (msg.type === "executing") {
        if (currentRequestId !== id) return;
        if (data.node === null && data.prompt_id === promptId) {
          // Workflow finished — pull the final text from history to be safe.
          const text = await fetchResultText(base, promptId);
          await finish(text);
        } else if (data.node !== null) {
          request.status = "running";
          request.statusText = "Generating description…";
          await setActive(request);
        }
      } else if (msg.type === "executed") {
        if (data.prompt_id === promptId) {
          const text = extractText(data.output);
          if (text) await finish(text);
        }
      } else if (msg.type === "execution_error") {
        await errored("ComfyUI execution error: " + (data.exception_message || "unknown"));
      }
    });

    socket.addEventListener("error", () => {
      // The WS is best-effort for progress; if it fails we fall back to polling.
      console.warn("WebSocket error; falling back to history polling.");
    });

    // STEP 5 — queue the prompt.
    const queueRes = await fetch(base + "/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: payload, client_id: clientId })
    });
    const queueJson = await queueRes.json();
    promptId = queueJson.prompt_id;
    if (!promptId) {
      const errText = queueJson.error
        ? JSON.stringify(queueJson.error)
        : "No prompt_id returned from ComfyUI.";
      throw new Error(errText);
    }
  } catch (err) {
    return errored("Error sending workflow: " + err.message);
  }

  // STEP 6 — polling fallback. Runs alongside the WebSocket; whichever resolves
  // first wins via the `settled` guard. This covers the case where the WS never
  // connects or the node emits no progress/executed events.
  pollHistory(base, () => promptId, () => settled, finish, id);
}

// Poll /history until the result appears (fallback / safety net).
async function pollHistory(base, getPromptId, isSettled, finish, id) {
  for (let i = 0; i < 600; i++) { // ~10 min max at 1s intervals
    if (isSettled() || currentRequestId !== id) return;
    const pid = getPromptId();
    if (pid) {
      const text = await fetchResultText(base, pid);
      if (text) return finish(text);
    }
    await sleep(1000);
  }
}

async function fetchResultText(base, promptId) {
  try {
    const res = await fetch(base + "/history/" + promptId);
    const hist = JSON.parse(await res.text());
    const entry = hist[promptId];
    if (!entry || !entry.outputs) return null;
    // Prefer node 5 (PreviewAny), but fall back to any node with text output.
    return extractText(entry.outputs["5"]) || extractFromOutputs(entry.outputs);
  } catch {
    return null;
  }
}

function extractFromOutputs(outputs) {
  for (const node of Object.values(outputs)) {
    const t = extractText(node);
    if (t) return t;
  }
  return null;
}

// Pull text out of a node output object (handles {text:[...]} and {text:"..."}).
function extractText(output) {
  if (!output) return null;
  const t = output.text;
  if (Array.isArray(t)) return t.join("\n");
  if (typeof t === "string") return t;
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWorkflow(uploadedName, promptText, model) {
  let seed = Math.floor(Math.random() * 9999) + 1; // avoid ComfyUI's cached 0
  return {
    "5": {
      inputs: { preview: "", previewMode: null, source: ["7", 0] },
      class_type: "PreviewAny"
    },
    "7": {
      inputs: {
        prompt: promptText,
        max_length: 2048,
        sampling_mode: "on",
        "sampling_mode.temperature": 0.7,
        "sampling_mode.top_k": 64,
        "sampling_mode.top_p": 0.95,
        "sampling_mode.min_p": 0.05,
        "sampling_mode.repetition_penalty": 1.05,
        "sampling_mode.seed": seed,
        clip: ["8", 0],
        image: ["12", 0],
        image_type: "rgb"
      },
      class_type: "TextGenerate"
    },
    "8": {
      inputs: { clip_name: model, type: "ltxv", device: "default" },
      class_type: "CLIPLoader"
    },
    "12": {
      inputs: { image: uploadedName },
      class_type: "LoadImage"
    }
  };
}

// Strip "/prompt" (and anything after) and trailing slashes to get the base.
function baseUrl(url) {
  return url.replace(/\/prompt.*$/, "").replace(/\/$/, "");
}

function wsUrl(base, clientId) {
  return base.replace(/^http/, "ws") + "/ws?clientId=" + clientId;
}

async function setActive(request) {
  await chrome.storage.local.set({ activeRequest: { ...request } });
}

async function fail(request, message) {
  if (currentRequestId !== request.id) return;
  request.status = "error";
  request.statusText = "Error";
  request.error = message;
  request.progress = null;
  request.finishedAt = Date.now();
  await setActive(request);
}

async function pushHistory(request) {
  const { history = [] } = await chrome.storage.local.get("history");
  history.unshift({
    id: request.id,
    thumbnail: request.thumbnail,
    model: request.model,
    prompt: request.prompt,
    result: request.result,
    startedAt: request.startedAt,
    finishedAt: request.finishedAt
  });
  await chrome.storage.local.set({ history: history.slice(0, HISTORY_LIMIT) });
}

// Downscale an image blob to a small JPEG data URL using OffscreenCanvas
// (no DOM in a service worker). Best effort — returns null on any failure.
async function makeThumbnail(blob, max = 200) {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    return await blobToDataURL(out);
  } catch (e) {
    console.warn("Thumbnail generation failed:", e);
    return null;
  }
}

async function blobToDataURL(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
