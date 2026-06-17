// Built-in defaults, used only when ComfyUI is unreachable and nothing has
// been cached yet.
const DEFAULT_MODELS = [
  "qwen3.5_4b_bf16.safetensors",
  "qwen3.5_9b_bf16.safetensors",
  "gemma_3_12B_it_fp4_mixed.safetensors",
  "gemma_3_12B_it_fp8_scaled.safetensors",
  "gemma_3_12B_it_fpmixed.safetensors",
  "gemma_3_12B_it.safetensors"
];

document.addEventListener("DOMContentLoaded", async () => {
  const urlInput = document.getElementById("urlInput");
  const modelSelect = document.getElementById("modelSelect");
  const modelStatus = document.getElementById("modelStatus");
  const status = document.getElementById("status");
  const testStatus = document.getElementById("testStatus");

  // Load saved settings
  const { comfyUrl, gemmaModel } = await chrome.storage.sync.get(["comfyUrl", "gemmaModel"]);
  if (comfyUrl) urlInput.value = comfyUrl.replace(/\/prompt.*$/, "");

  function normalizeUrl(raw) {
    let url = raw.trim().replace(/\/$/, "").replace(/\/prompt.*$/, "");
    return url + "/prompt";
  }
  function baseUrl(raw) {
    return raw.trim().replace(/\/$/, "").replace(/\/prompt.*$/, "");
  }

  // Populate the dropdown from a list of model filenames, keeping the saved
  // selection if it's still present.
  function populateModels(models, selected) {
    modelSelect.innerHTML = "";
    if (!models || models.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No models found";
      modelSelect.appendChild(opt);
      return;
    }
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m.replace(/\.safetensors$/, "");
      modelSelect.appendChild(opt);
    }
    // Keep the saved model selected even if it's not in the fetched list.
    if (selected) {
      if (!models.includes(selected)) {
        const opt = document.createElement("option");
        opt.value = selected;
        opt.textContent = selected.replace(/\.safetensors$/, "") + " (saved)";
        modelSelect.appendChild(opt);
      }
      modelSelect.value = selected;
    }
  }

  // Fetch the real text_encoders list from ComfyUI's /object_info/CLIPLoader.
  async function fetchModels(base) {
    const res = await fetch(base + "/object_info/CLIPLoader");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const clipName = json?.CLIPLoader?.input?.required?.clip_name;
    // clip_name is [ [ "a.safetensors", "b.safetensors", ... ], {options} ]
    const list = Array.isArray(clipName) ? clipName[0] : null;
    if (!Array.isArray(list)) throw new Error("Unexpected /object_info shape");
    return list;
  }

  async function loadModels({ live }) {
    const { gemmaModel: saved } = await chrome.storage.sync.get("gemmaModel");
    const base = baseUrl(urlInput.value || comfyUrl || "");

    if (live && base) {
      modelStatus.textContent = "Fetching models from ComfyUI…";
      try {
        const models = await fetchModels(base);
        await chrome.storage.local.set({ cachedModels: models });
        populateModels(models, saved);
        modelStatus.style.color = "green";
        modelStatus.textContent = `Loaded ${models.length} model(s) from ComfyUI ✓`;
        return;
      } catch (err) {
        console.warn("Model fetch failed:", err);
        modelStatus.style.color = "#b36b00";
        modelStatus.textContent = "Couldn't reach ComfyUI — showing cached/default list.";
      }
    }

    // Fallback: cached list, then built-in defaults.
    const { cachedModels } = await chrome.storage.local.get("cachedModels");
    const fallback = cachedModels && cachedModels.length ? cachedModels : DEFAULT_MODELS;
    populateModels(fallback, saved);
    if (!modelStatus.textContent) {
      modelStatus.style.color = "#666";
      modelStatus.textContent = cachedModels?.length
        ? "Showing cached model list."
        : "Showing default model list.";
    }
  }

  // Initial load: try live, fall back automatically.
  await loadModels({ live: true });

  document.getElementById("refreshModelsBtn").addEventListener("click", () => {
    modelStatus.textContent = "";
    loadModels({ live: true });
  });

  // Save settings
  document.getElementById("saveBtn").addEventListener("click", () => {
    chrome.storage.sync.set(
      { comfyUrl: normalizeUrl(urlInput.value), gemmaModel: modelSelect.value },
      () => {
        status.textContent = "Saved!";
        setTimeout(() => (status.textContent = ""), 1500);
      }
    );
  });

  // Dark mode
  const { darkMode } = await chrome.storage.sync.get("darkMode");
  document.getElementById("darkModeToggle").checked = !!darkMode;
  if (darkMode) document.body.classList.add("dark");
  document.getElementById("darkModeToggle").addEventListener("change", e => {
    chrome.storage.sync.set({ darkMode: e.target.checked });
    document.body.classList.toggle("dark", e.target.checked);
  });

  // Custom prompt
  const { customPrompt } = await chrome.storage.sync.get("customPrompt");
  document.getElementById("customPrompt").value = customPrompt || "";
  document.getElementById("customPrompt").addEventListener("input", e => {
    chrome.storage.sync.set({ customPrompt: e.target.value });
  });

  // Test Connection
  document.getElementById("testBtn").addEventListener("click", async () => {
    const base = baseUrl(urlInput.value);
    testStatus.style.color = "#444";
    testStatus.textContent = "Testing...";
    try {
      const res = await fetch(base + "/object_info", { method: "GET" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      await res.json();
      testStatus.style.color = "green";
      testStatus.textContent = "Connected ✓";
      // A successful test is a good moment to refresh the model list too.
      loadModels({ live: true });
    } catch (err) {
      testStatus.style.color = "red";
      testStatus.textContent = "Connection failed ✗";
      console.warn("Connection test error:", err);
    }
  });
});
